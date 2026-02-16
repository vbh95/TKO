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

export function setupSocketIO(httpServer: Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    socket.on("join:tournament", async (data: { tournamentId: number; userId?: number }) => {
      const tournamentId = typeof data === 'number' ? data : data.tournamentId;
      socket.join(`tournament:${tournamentId}`);
      const cached = getLiveScoringForTournament(tournamentId);
      for (const scoring of cached) {
        socket.emit("leg:scoring", scoring);
      }
    });

    socket.on("join:board", async (data: { tournamentId: number; boardNumber: number; shareToken?: string }) => {
      if (data.shareToken) {
        const tournament = await storage.getTournamentByShareToken(data.shareToken);
        if (tournament && tournament.id === data.tournamentId) {
          socket.join(`board:${data.tournamentId}:${data.boardNumber}`);
        }
      } else {
        socket.join(`board:${data.tournamentId}:${data.boardNumber}`);
      }
    });

    socket.on("join:public", async (shareToken: string) => {
      const tournament = await storage.getTournamentByShareToken(shareToken);
      if (tournament) {
        socket.join(`public:${shareToken}`);
        const cached = getLiveScoringForTournament(tournament.id);
        for (const scoring of cached) {
          socket.emit("leg:scoring", scoring);
        }
      }
    });

    socket.on("join:scorer", async (data: { accessToken: string }) => {
      try {
        const session = await storage.getBoardSessionByAccessToken(data.accessToken);
        if (session && session.pairedAt) {
          if (session.expiresAt && new Date() > session.expiresAt) {
            return;
          }

          const roomName = `board:${session.tournamentId}:${session.boardNumber}`;
          socket.join(roomName);
          socket.join(`tournament:${session.tournamentId}`);
          (socket as any).boardSession = session;

          const key = `${session.tournamentId}:${session.boardNumber}`;
          boardSocketCounts.set(key, (boardSocketCounts.get(key) || 0) + 1);

          io!.to(`tournament:${session.tournamentId}`).emit("board:status", {
            boardNumber: session.boardNumber,
            tournamentId: session.tournamentId,
            online: true,
          });
        }
      } catch (err) {
        console.error("[socket.io] scorer join error:", err);
      }
    });

    socket.on("disconnect", () => {
      const session = (socket as any).boardSession;
      if (session) {
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
      }
    });
  });

  return io;
}

export function emitMatchUpdate(tournamentId: number, shareToken: string | null, matchData: any) {
  if (!io) return;
  io.to(`tournament:${tournamentId}`).emit("match:updated", matchData);
  if (shareToken) {
    io.to(`public:${shareToken}`).emit("match:updated", matchData);
  }
}

export function emitTournamentUpdate(tournamentId: number, shareToken: string | null, data: any) {
  if (!io) return;
  io.to(`tournament:${tournamentId}`).emit("tournament:updated", data);
  if (shareToken) {
    io.to(`public:${shareToken}`).emit("tournament:updated", data);
  }
}

export function emitBoardMatchUpdate(tournamentId: number, boardNumber: number, matchData: any) {
  if (!io) return;
  io.to(`board:${tournamentId}:${boardNumber}`).emit("match:updated", matchData);
}

export function emitLegScoring(tournamentId: number, boardNumber: number, shareToken: string | null, scoringData: any) {
  if (!io) return;
  if (scoringData.matchId) {
    liveScoringCache.set(scoringData.matchId, { ...scoringData, tournamentId });
  }
  io.to(`board:${tournamentId}:${boardNumber}`).emit("leg:scoring", scoringData);
  io.to(`tournament:${tournamentId}`).emit("leg:scoring", scoringData);
  if (shareToken) {
    io.to(`public:${shareToken}`).emit("leg:scoring", scoringData);
  }
}

export function clearLiveScoringCache(matchId: number) {
  liveScoringCache.delete(matchId);
}

export function getLiveScoringForTournament(tournamentId: number): any[] {
  const results: any[] = [];
  liveScoringCache.forEach((data) => {
    if (data.tournamentId === tournamentId) {
      results.push(data);
    }
  });
  return results;
}
