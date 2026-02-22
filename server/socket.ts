import { Server as SocketIOServer } from "socket.io";
import type { Server } from "http";
import { storage } from "./storage";

let io: SocketIOServer | null = null;

const boardSocketCounts = new Map<string, number>();
const liveScoringCache = new Map<number, any>();

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

function isExpired(expiresAt?: Date | string | null) {
  if (!expiresAt) return false;
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return new Date() > d;
}

export function setupSocketIO(httpServer: Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    // Since your site is served from the same Render URL, lock this down.
    // If you need local dev too, change to:
    // origin: ["https://tko-ockl.onrender.com", "http://localhost:5173"]
    cors: {
      origin: "https://tko-ockl.onrender.com",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    /**
     * PUBLIC VIEWERS
     * - Only allow joining public rooms via shareToken.
     * - They can receive match/tournament updates + live scoring replay for that tournament.
     */
    socket.on("join:public", async (shareToken: string) => {
      try {
        if (!shareToken) return;

        const tournament = await storage.getTournamentByShareToken(shareToken);
        if (!tournament) return;

        socket.join(`public:${shareToken}`);

        // Replay any cached live scoring for this tournament
        const cached = getLiveScoringForTournament(tournament.id);
        for (const scoring of cached) {
          socket.emit("leg:scoring", scoring);
        }
      } catch (err) {
        console.error("[socket.io] join:public error:", err);
      }
    });

    /**
     * PUBLIC BOARD VIEW (READ-ONLY)
     * - Only allow joining a board room if the shareToken is valid for that tournament.
     * - This is for read-only board displays (e.g., public board view).
     * - Scorer tablets should NOT use this. They use join:scorer(accessToken).
     */
    socket.on(
      "join:board",
      async (data: { tournamentId: number; boardNumber: number; shareToken?: string }) => {
        try {
          if (!data?.shareToken) return;

          const tournament = await storage.getTournamentByShareToken(data.shareToken);
          if (!tournament) return;
          if (tournament.id !== data.tournamentId) return;

          socket.join(`board:${data.tournamentId}:${data.boardNumber}`);
        } catch (err) {
          console.error("[socket.io] join:board error:", err);
        }
      }
    );

    /**
     * SCORER TABLETS (WRITE CAPABILITY)
     * - Only allow joining scorer rooms if they present a valid board accessToken.
     * - Requires session.pairedAt and not expired.
     * - Joins:
     *   - board:<tournamentId>:<boardNumber>
     *   - tournament:<tournamentId> (private scorer/admin channel)
     */
    socket.on("join:scorer", async (data: { accessToken: string }) => {
      try {
        const accessToken = data?.accessToken;
        if (!accessToken) return;

        const session = await storage.getBoardSessionByAccessToken(accessToken);
        if (!session) return;

        // Must be paired/activated
        if (!session.pairedAt) return;

        // Must not be expired
        if (isExpired(session.expiresAt)) return;

        const roomName = `board:${session.tournamentId}:${session.boardNumber}`;
        socket.join(roomName);

        // Scorers also join tournament room to receive "board:status" + other private updates
        socket.join(`tournament:${session.tournamentId}`);

        (socket as any).boardSession = session;

        // Track online count per board
        const key = `${session.tournamentId}:${session.boardNumber}`;
        boardSocketCounts.set(key, (boardSocketCounts.get(key) || 0) + 1);

        io!.to(`tournament:${session.tournamentId}`).emit("board:status", {
          boardNumber: session.boardNumber,
          tournamentId: session.tournamentId,
          online: true,
        });

        // Replay cached live scoring for that tournament (optional but useful for reconnects)
        const cached = getLiveScoringForTournament(session.tournamentId);
        for (const scoring of cached) {
          socket.emit("leg:scoring", scoring);
        }
      } catch (err) {
        console.error("[socket.io] join:scorer error:", err);
      }
    });

    socket.on("disconnect", () => {
      const session = (socket as any).boardSession;
      if (!session) return;

      const key = `${session.tournamentId}:${session.boardNumber}`;
      const count = (boardSocketCounts.get(key) || 1) - 1;
      boardSocketCounts.set(key, Math.max(0, count));

      if (count <= 0) {
        boardSocketCounts.delete(key);
        io!.to(`tournament:${session.tournamentId}`).emit("board:status", {
          boardNumber: session.boardNumber,
          tournamentId: session.tournamentId,
          online: false,
        });
      }
    });
  });

  return io;
}

/**
 * EMITTERS
 * These are called by your server when data changes.
 */

export function emitMatchUpdate(tournamentId: number, shareToken: string | null, matchData: any) {
  if (!io) return;

  // Private (scorers/admins only)
  io.to(`tournament:${tournamentId}`).emit("match:updated", matchData);

  // Public spectators
  if (shareToken) {
    io.to(`public:${shareToken}`).emit("match:updated", matchData);
  }
}

export function emitTournamentUpdate(tournamentId: number, shareToken: string | null, data: any) {
  if (!io) return;

  // Private (scorers/admins only)
  io.to(`tournament:${tournamentId}`).emit("tournament:updated", data);

  // Public spectators
  if (shareToken) {
    io.to(`public:${shareToken}`).emit("tournament:updated", data);
  }
}

export function emitBoardMatchUpdate(tournamentId: number, boardNumber: number, matchData: any) {
  if (!io) return;
  io.to(`board:${tournamentId}:${boardNumber}`).emit("match:updated", matchData);
}

export function emitLegScoring(
  tournamentId: number,
  boardNumber: number,
  shareToken: string | null,
  scoringData: any
) {
  if (!io) return;

  // Cache by matchId so reconnects can replay last-known scoring state
  if (scoringData?.matchId) {
    liveScoringCache.set(scoringData.matchId, { ...scoringData, tournamentId });
  }

  // Board room (public board view + scorer tablet both join this)
  io.to(`board:${tournamentId}:${boardNumber}`).emit("leg:scoring", scoringData);

  // Private tournament room (scorers/admins)
  io.to(`tournament:${tournamentId}`).emit("leg:scoring", scoringData);

  // Public spectators
  if (shareToken) {
    io.to(`public:${shareToken}`).emit("leg:scoring", scoringData);
  }
}

export function clearLiveScoringCache(matchId: number) {
  liveScoringCache.delete(matchId);
}

export function clearLiveScoringForTournament(tournamentId: number) {
  const toDelete: number[] = [];
  liveScoringCache.forEach((data, matchId) => {
    if (data?.tournamentId === tournamentId) toDelete.push(matchId);
  });
  toDelete.forEach((id) => liveScoringCache.delete(id));
}

export function getLiveScoringForTournament(tournamentId: number): any[] {
  const results: any[] = [];
  liveScoringCache.forEach((data) => {
    if (data?.tournamentId === tournamentId) results.push(data);
  });
  return results;
}