import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { generateMatches } from "./match-generator";
import type { TournamentSettings } from "@shared/schema";
import { emitMatchUpdate, emitTournamentUpdate, emitBoardMatchUpdate, emitLegScoring, clearLiveScoringCache, clearLiveScoringForTournament } from "./socket";

const scryptAsync = promisify(scrypt);

interface PromoteGroupParams {
  tournamentId: number;
  completedGroupId: number;
  currentMatchId: number;
  currentMatchWinnerId: number | null;
  ptsWin: number;
  ptsLoss: number;
  shareToken: string | null;
}

async function promoteGroupToKnockout(params: PromoteGroupParams) {
  const { tournamentId, completedGroupId, currentMatchId, currentMatchWinnerId, ptsWin, ptsLoss, shareToken } = params;

  const allMatches = await storage.getMatchesByTournamentId(tournamentId);
  const groupMatches = allMatches.filter(m => m.stage === 'GROUP');
  const knockoutMatches = allMatches.filter(m => m.stage === 'KNOCKOUT');
  if (knockoutMatches.length === 0) return;

  const groupsList = await storage.getGroupsByTournamentId(tournamentId);
  const playersList = await storage.getPlayersByTournamentId(tournamentId);
  const memberships = await storage.getGroupMembershipsByTournamentId(tournamentId);
  if (groupsList.length === 0) return;

  const sorted = [...knockoutMatches].sort((a: any, b: any) => a.order - b.order);
  const roundKeys: string[] = [];
  for (const m of sorted) {
    if (!roundKeys.includes(m.roundKey)) roundKeys.push(m.roundKey);
  }
  const firstRoundKey = roundKeys[0];
  const firstRoundMatches = sorted.filter(m => m.roundKey === firstRoundKey);

  const calcGroupStandings = (groupId: number) => {
    const memberPlayerIds = memberships.filter(gm => gm.groupId === groupId).map(gm => gm.playerId);
    const groupPlayers = playersList.filter(p => memberPlayerIds.includes(p.id));
    const gMatches = groupMatches.filter(m => m.groupId === groupId);
    const completedGMatches = gMatches.filter(m => m.status === 'COMPLETED' || m.id === currentMatchId);

    const stats = groupPlayers.map(player => {
      const playerMs = completedGMatches.filter(m => m.playerAId === player.id || m.playerBId === player.id);
      let played = 0, won = 0, lost = 0, legsFor = 0, legsAgainst = 0;
      playerMs.forEach(m => {
        played++;
        const isA = m.playerAId === player.id;
        const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
        const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
        legsFor += myScore;
        legsAgainst += oppScore;
        const mWinnerId = m.id === currentMatchId ? currentMatchWinnerId : m.winnerId;
        if (mWinnerId === player.id) won++;
        else lost++;
      });
      return { id: player.id, played, pts: (won * ptsWin) + (lost * ptsLoss), legsFor, legsAgainst, diff: legsFor - legsAgainst };
    });

    stats.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor;
      return a.id - b.id;
    });

    let i = 0;
    while (i < stats.length) {
      let j = i + 1;
      while (j < stats.length && stats[j].pts === stats[i].pts && stats[j].diff === stats[i].diff && stats[j].legsFor === stats[i].legsFor) {
        j++;
      }
      if (j - i > 1) {
        const tiedGroup = stats.slice(i, j);
        const tiedIds = new Set(tiedGroup.map(p => p.id));
        const h2hMatches = completedGMatches.filter(m =>
          m.playerAId !== null && m.playerBId !== null &&
          tiedIds.has(m.playerAId) && tiedIds.has(m.playerBId)
        );
        const expectedPairings = tiedGroup.length * (tiedGroup.length - 1) / 2;
        const pairingSet = new Set<string>();
        h2hMatches.forEach(m => {
          const pair = [m.playerAId!, m.playerBId!].sort((a, b) => a - b).join('-');
          pairingSet.add(pair);
        });

        let resolved = false;
        if (pairingSet.size >= expectedPairings) {
          const matchCounts = new Map<number, number>();
          tiedGroup.forEach(p => matchCounts.set(p.id, 0));
          h2hMatches.forEach(m => {
            matchCounts.set(m.playerAId!, (matchCounts.get(m.playerAId!) || 0) + 1);
            matchCounts.set(m.playerBId!, (matchCounts.get(m.playerBId!) || 0) + 1);
          });
          const counts: number[] = [];
          matchCounts.forEach(v => counts.push(v));
          if (counts.every(c => c === counts[0])) {
            const h2hStats = tiedGroup.map(player => {
              const playerH2H = h2hMatches.filter(m => m.playerAId === player.id || m.playerBId === player.id);
              let hWon = 0, hFor = 0, hAgainst = 0;
              playerH2H.forEach(m => {
                const isA = m.playerAId === player.id;
                const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
                const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
                hFor += myScore;
                hAgainst += oppScore;
                const mWinnerId = m.id === currentMatchId ? currentMatchWinnerId : m.winnerId;
                if (mWinnerId === player.id) hWon++;
              });
              return { id: player.id, pts: hWon * ptsWin, diff: hFor - hAgainst, legsFor: hFor, played: player.played };
            });
            h2hStats.sort((a, b) => {
              if (b.pts !== a.pts) return b.pts - a.pts;
              if (b.diff !== a.diff) return b.diff - a.diff;
              if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor;
              if (a.played !== b.played) return a.played - b.played;
              return a.id - b.id;
            });
            const reordered = h2hStats.map(h => tiedGroup.find(p => p.id === h.id)!);
            for (let k = 0; k < reordered.length; k++) {
              stats[i + k] = reordered[k];
            }
            resolved = true;
          }
        }
        if (!resolved) {
          const fallback = tiedGroup.sort((a, b) => {
            if (a.played !== b.played) return a.played - b.played;
            return a.id - b.id;
          });
          for (let k = 0; k < fallback.length; k++) {
            stats[i + k] = fallback[k];
          }
        }
      }
      i = j;
    }

    return stats;
  };

  const completedGroupIdx = groupsList.findIndex(g => g.id === completedGroupId);
  if (completedGroupIdx < 0) return;

  const standings = calcGroupStandings(completedGroupId);
  if (standings.length < 2) return;

  const groupCount = groupsList.length;
  type Pairing = { aGroupIdx: number; aPos: number; bGroupIdx: number; bPos: number };
  const pairings: Pairing[] = [];
  for (let i = 0; i < groupCount; i += 2) {
    const oppIdx = i + 1;
    if (oppIdx < groupCount) {
      pairings.push(
        { aGroupIdx: i, aPos: 0, bGroupIdx: oppIdx, bPos: 1 },
        { aGroupIdx: i, aPos: 1, bGroupIdx: oppIdx, bPos: 0 },
      );
    } else {
      pairings.push(
        { aGroupIdx: i, aPos: 0, bGroupIdx: i, bPos: 1 },
      );
    }
  }

  const promotedPerGroup = 2;
  const promotedPlayerIds = new Set<number>();
  for (let pos = 0; pos < promotedPerGroup && pos < standings.length; pos++) {
    promotedPlayerIds.add(standings[pos].id);
  }
  const completedGroupMemberIds = memberships
    .filter(gm => gm.groupId === completedGroupId)
    .map(gm => gm.playerId);
  const nonPromotedFromGroup = playersList.filter(
    p => completedGroupMemberIds.includes(p.id) && !promotedPlayerIds.has(p.id)
  );

  const updatedQFIds: number[] = [];
  let lastAssignedScorerId: number | null = null;
  for (let i = 0; i < firstRoundMatches.length && i < pairings.length; i++) {
    const pairing = pairings[i];
    const updates: any = {};
    let needsUpdate = false;

    if (pairing.aGroupIdx === completedGroupIdx) {
      const playerId = standings[pairing.aPos]?.id;
      if (playerId) { updates.playerAId = playerId; needsUpdate = true; }
    }
    if (pairing.bGroupIdx === completedGroupIdx) {
      const playerId = standings[pairing.bPos]?.id;
      if (playerId) { updates.playerBId = playerId; needsUpdate = true; }
    }

    if (needsUpdate) {
      updates.boardNumber = i + 1;

      if (pairing.aGroupIdx === completedGroupIdx || pairing.bGroupIdx === completedGroupIdx) {
        let scorerPool = nonPromotedFromGroup.filter(p => p.id !== lastAssignedScorerId);
        if (scorerPool.length === 0) scorerPool = [...nonPromotedFromGroup];
        if (scorerPool.length > 0) {
          const chosen = scorerPool[Math.floor(Math.random() * scorerPool.length)];
          updates.scorerId = chosen.id;
          updates.scorerName = chosen.name;
          lastAssignedScorerId = chosen.id;
        }
      }

      await storage.updateMatch(firstRoundMatches[i].id, updates);
      updatedQFIds.push(firstRoundMatches[i].id);
    }
  }

  const sfBoardMap: Record<number, number> = { 0: 2, 1: 3 };
  const fBoardMap: Record<number, number> = { 0: 3 };
  for (const km of sorted) {
    if (km.roundKey === firstRoundKey) continue;
    const roundMatches = sorted.filter(m => m.roundKey === km.roundKey);
    const idx = roundMatches.findIndex(m => m.id === km.id);
    let assignedBoard: number | undefined;
    if (km.roundKey === 'SF') assignedBoard = sfBoardMap[idx];
    else if (km.roundKey === 'F') assignedBoard = fBoardMap[idx];
    else if (km.roundKey === 'GF') assignedBoard = fBoardMap[idx];
    if (assignedBoard != null && !km.boardNumber) {
      await storage.updateMatch(km.id, { boardNumber: assignedBoard } as any);
    }
  }

  try {
    const updatedKnockouts = await storage.getMatchesByTournamentId(tournamentId);
    const koMatches = updatedKnockouts.filter(m => m.stage === 'KNOCKOUT');
    for (const km of koMatches) {
      emitMatchUpdate(tournamentId, shareToken, km);
      if ((km as any).boardNumber) {
        emitBoardMatchUpdate(tournamentId, (km as any).boardNumber, km);
      }
    }
  } catch {}
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // AUTH SETUP
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "default_secret_change_me",
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false);
        
        const isValid = await comparePassword(password, user.password);
        if (!isValid) return done(null, false);
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // HELPER: Auth Middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  // === AUTH ROUTES ===
  app.post(api.auth.signup.path, async (req, res) => {
    try {
      const input = api.auth.signup.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after signup" });
        res.status(201).json(user);
      });
    } catch (err) {
       if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  const resetAttempts = new Map<string, { count: number; lastAttempt: number }>();

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ message: "Email and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const now = Date.now();
      const attempt = resetAttempts.get(email);
      if (attempt && attempt.count >= 5 && now - attempt.lastAttempt < 15 * 60 * 1000) {
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }
      resetAttempts.set(email, {
        count: (attempt && now - attempt.lastAttempt < 15 * 60 * 1000) ? attempt.count + 1 : 1,
        lastAttempt: now,
      });

      const user = await storage.getUserByUsername(email);
      if (!user) {
        return res.json({ message: "If an account exists with that email, the password has been reset." });
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(email, hashedPassword);
      res.json({ message: "If an account exists with that email, the password has been reset." });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    if (req.body.rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
    } else {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24; // 1 day
    }
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, isAuthenticated, (req, res) => {
    res.json(req.user);
  });

  // === TOURNAMENT ROUTES ===
  app.post(api.tournaments.bulkPlayers.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

      const { players: playerList, replace } = api.tournaments.bulkPlayers.input.parse(req.body);

      if (replace) {
        const existingPlayers = await storage.getPlayersByTournamentId(id);
        // Cascading delete handles related records if configured, otherwise be careful.
        // For now, assume cascade delete is fine as per schema.
        for (const p of existingPlayers) {
          // Add deletePlayer to storage if needed, or use raw db
        }
      }

      const createdPlayers = [];
      for (const p of playerList) {
        const newPlayer = await storage.createPlayer({
          name: p.name,
          tournamentId: id,
          seed: p.seed,
        });
        createdPlayers.push(newPlayer);
      }

      res.json(createdPlayers);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/tournaments/:id/players/:playerId", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playerId = parseInt(req.params.playerId);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      const tournamentPlayers = await storage.getPlayersByTournamentId(id);
      const playerExists = tournamentPlayers.find(p => p.id === playerId);
      if (!playerExists) return res.status(404).json({ message: "Player not found in this tournament" });
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) return res.status(400).json({ message: "Name is required" });
      const updated = await storage.updatePlayer(playerId, { name: name.trim() });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.tournaments.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const tournaments = await storage.getTournamentsByUserId(userId);
    res.json(tournaments);
  });

  app.get(api.tournaments.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const tournament = await storage.getTournament(id);
    
    if (!tournament) return res.status(404).json({ message: "Not found" });
    if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
    
    const players = await storage.getPlayersByTournamentId(id);
    const groups = await storage.getGroupsByTournamentId(id);
    const matches = await storage.getMatchesByTournamentId(id);
    const groupMemberships = await storage.getGroupMembershipsByTournamentId(id);
    
    res.json({ tournament, players, groups, matches, groupMemberships });
  });

  app.post(api.tournaments.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.tournaments.create.input.parse(req.body);
      const userId = (req.user as any).id;
      
      const tournament = await storage.createTournament({
        name: input.name,
        type: input.type,
        userId,
        settings: input.settings,
        status: "NOT_STARTED"
      });
      
      // Create players
      const playerInputs = input.playerNames.map((name, index) => ({
        name,
        tournamentId: tournament.id,
        seed: input.randomize ? undefined : index + 1 // Simple seed logic
      }));

      // If randomize, shuffle playerInputs before creating? 
      // User said: "add players by name (manual list) + option to randomize order"
      // We can just shuffle the names if randomize is true.
      if (input.randomize) {
        for (let i = playerInputs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerInputs[i], playerInputs[j]] = [playerInputs[j], playerInputs[i]];
        }
      }
      
      const createdPlayers = [];
      for (const p of playerInputs) {
        const created = await storage.createPlayer(p);
        createdPlayers.push(created);
      }
      
      await generateMatches(tournament.id, createdPlayers, input.type, input.settings as TournamentSettings);
      
      await storage.updateTournament(tournament.id, { status: "IN_PROGRESS" });
      
      res.status(201).json(tournament);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put(api.tournaments.update.path, isAuthenticated, async (req, res) => {
     const id = parseInt(req.params.id);
     const tournament = await storage.getTournament(id);
     if (!tournament) return res.status(404).json({ message: "Not found" });
     if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

     const updated = await storage.updateTournament(id, req.body);
     res.json(updated);
  });

  app.post('/api/tournaments/:id/reset', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

      const { name, settings } = req.body;

      await storage.updateTournament(id, {
        ...(name ? { name } : {}),
        ...(settings ? { settings } : {}),
      });

      const updatedTournament = await storage.getTournament(id);

      clearLiveScoringForTournament(id);

      await storage.resetTournamentData(id);

      const existingPlayers = await storage.getPlayersByTournamentId(id);

      for (let i = existingPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [existingPlayers[i], existingPlayers[j]] = [existingPlayers[j], existingPlayers[i]];
      }

      await generateMatches(id, existingPlayers, updatedTournament!.type, (updatedTournament!.settings || {}) as TournamentSettings);

      await storage.updateTournament(id, { status: "IN_PROGRESS" });

      const finalTournament = await storage.getTournament(id);
      emitTournamentUpdate(id, finalTournament?.shareToken || null, finalTournament);

      res.json({ success: true });
    } catch (err) {
      console.error("Tournament reset error:", err);
      res.status(500).json({ message: "Failed to reset tournament" });
    }
  });

  app.delete(api.tournaments.delete.path, isAuthenticated, async (req, res) => {
     const id = parseInt(req.params.id);
     const tournament = await storage.getTournament(id);
     if (!tournament) return res.status(404).json({ message: "Not found" });
     if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

     await storage.deleteTournament(id);
     res.sendStatus(204);
  });

  // === MATCH NOTES (admin) ===
  app.get('/api/matches/:matchId/notes', isAuthenticated, async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      const tournament = await storage.getTournament(match.tournamentId);
      if (!tournament || tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      const note = await storage.getMatchNote(matchId);
      res.json(note || null);
    } catch (err) {
      console.error("Match notes error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === MATCH SCORER UPDATE ===
  app.patch('/api/matches/:id/scorer', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const match = await storage.getMatch(id);
      if (!match) return res.status(404).json({ message: "Not found" });

      const tournament = await storage.getTournament(match.tournamentId);
      if (!tournament || tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

      const { scorerName } = req.body;
      const updatedMatch = await storage.updateMatch(id, {
        scorerName: typeof scorerName === 'string' ? scorerName.trim() || null : null,
      });
      res.json(updatedMatch);
    } catch (err) {
      console.error("Update scorer error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === MATCHES ===
  app.put(api.matches.update.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const match = await storage.getMatch(id);
    if (!match) return res.status(404).json({ message: "Not found" });
    
    // Check ownership via tournament
    const tournament = await storage.getTournament(match.tournamentId);
    if (!tournament || tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
    
    const input = api.matches.update.input.parse(req.body);
    
    const isReset = input.scoreA === 0 && input.scoreB === 0;

    let winnerId: number | null = null;
    if (!isReset) {
      if (input.scoreA > input.scoreB && match.playerAId) {
        winnerId = match.playerAId;
      } else if (input.scoreB > input.scoreA && match.playerBId) {
        winnerId = match.playerBId;
      }
    }

    const updatedMatch = await storage.updateMatch(id, {
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        winnerId,
        status: isReset ? "PENDING" : "COMPLETED"
    });
    clearLiveScoringCache(id);
    
    if (input.notes) {
        const noteValues = Object.fromEntries(
          Object.entries(input.notes).filter(([, v]) => v !== undefined)
        );
        if (Object.keys(noteValues).length > 0) {
          await storage.updateMatchNote(id, noteValues);
        }
    }

    // === AUTO-PROGRESSION LOGIC ===
    try {
      const allMatches = await storage.getMatchesByTournamentId(match.tournamentId);
      const tournamentData = await storage.getTournament(match.tournamentId);
      const settings = (tournamentData?.settings || {}) as any;
      const ptsWin = settings.pointsForWin ?? 2;
      const ptsLoss = settings.pointsForLoss ?? 0;

      if (match.stage === 'GROUP' && match.groupId) {
        const groupMatches = allMatches.filter(m => m.stage === 'GROUP');
        const thisGroupMatches = groupMatches.filter(m => m.groupId === match.groupId);
        const thisGroupDone = thisGroupMatches.every(m => m.status === 'COMPLETED' || m.id === id);

        if (thisGroupDone) {
          await promoteGroupToKnockout({
            tournamentId: match.tournamentId,
            completedGroupId: match.groupId,
            currentMatchId: id,
            currentMatchWinnerId: winnerId,
            ptsWin,
            ptsLoss,
            shareToken: tournamentData?.shareToken || null,
          });
        }
      } else if (match.stage === 'KNOCKOUT' && winnerId) {
        // Progress winner to next knockout round
        const knockoutMatches = allMatches.filter(m => m.stage === 'KNOCKOUT');
        const sorted = [...knockoutMatches].sort((a: any, b: any) => a.order - b.order);
        const roundKeys: string[] = [];
        for (const m of sorted) {
          if (!roundKeys.includes(m.roundKey)) roundKeys.push(m.roundKey);
        }

        const currentRoundIdx = roundKeys.indexOf(match.roundKey);
        if (currentRoundIdx >= 0 && currentRoundIdx < roundKeys.length - 1) {
          const nextRoundKey = roundKeys[currentRoundIdx + 1];
          const currentRoundMatches = sorted.filter(m => m.roundKey === match.roundKey);
          const nextRoundMatches = sorted.filter(m => m.roundKey === nextRoundKey);

          const matchIndexInRound = currentRoundMatches.findIndex(m => m.id === id);
          const nextMatchIndex = Math.floor(matchIndexInRound / 2);
          const isTopSlot = matchIndexInRound % 2 === 0;

          if (nextMatchIndex < nextRoundMatches.length) {
            const nextMatch = nextRoundMatches[nextMatchIndex];
            const updatedNextMatch = await storage.updateMatch(nextMatch.id, isTopSlot
              ? { playerAId: winnerId } as any
              : { playerBId: winnerId } as any
            );
            // Emit update for the next-round match so boards/spectators see the new player
            try {
              const t = await storage.getTournament(match.tournamentId);
              emitMatchUpdate(match.tournamentId, t?.shareToken || null, updatedNextMatch);
              if ((updatedNextMatch as any).boardNumber) {
                emitBoardMatchUpdate(match.tournamentId, (updatedNextMatch as any).boardNumber, updatedNextMatch);
              }
            } catch {}
          }
        }
      }
    } catch (progressionError) {
      console.error("Auto-progression error (non-fatal):", progressionError);
    }

    // Emit real-time updates
    try {
      const tournamentForEmit = await storage.getTournament(match.tournamentId);
      emitMatchUpdate(match.tournamentId, tournamentForEmit?.shareToken || null, updatedMatch);
      if (match.groupId) {
        const groupsList = await storage.getGroupsByTournamentId(match.tournamentId);
        const sortedGroups = groupsList.sort((a, b) => a.name.localeCompare(b.name));
        const boardIdx = sortedGroups.findIndex(g => g.id === match.groupId);
        if (boardIdx >= 0) {
          emitBoardMatchUpdate(match.tournamentId, boardIdx + 1, updatedMatch);
        }
      } else if ((updatedMatch as any).boardNumber) {
        emitBoardMatchUpdate(match.tournamentId, (updatedMatch as any).boardNumber, updatedMatch);
      }
    } catch (emitError) {
      console.error("WebSocket emit error (non-fatal):", emitError);
    }
    
    res.json(updatedMatch);
  });

  // === SHARE ===
  app.post(api.tournaments.share.enable.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const tournament = await storage.getTournament(id);
    if (!tournament || tournament.userId !== (req.user as any).id) return res.status(404).json({ message: "Not found" });

    const shareToken = tournament.shareToken || randomBytes(16).toString("hex");
    const updated = await storage.updateTournament(id, {
      shareEnabled: true,
      shareToken,
    } as any);
    res.json(updated);
  });

  app.post(api.tournaments.share.disable.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const tournament = await storage.getTournament(id);
    if (!tournament || tournament.userId !== (req.user as any).id) return res.status(404).json({ message: "Not found" });

    const updated = await storage.updateTournament(id, {
      shareEnabled: false,
    } as any);
    res.json(updated);
  });

  // === PUBLIC ===
  app.get(api.public.get.path, async (req, res) => {
    const { shareToken } = req.params;
    const tournament = await storage.getTournamentByShareToken(shareToken);
    if (!tournament) return res.status(404).json({ message: "Tournament not found" });

    const [playersList, groupsList, matchesList] = await Promise.all([
      storage.getPlayersByTournamentId(tournament.id),
      storage.getGroupsByTournamentId(tournament.id),
      storage.getMatchesByTournamentId(tournament.id),
    ]);

    res.json({
      tournament,
      players: playersList,
      groups: groupsList,
      matches: matchesList,
    });
  });

  // === BOARD SESSION ROUTES ===
  app.post('/api/tournaments/:id/board-sessions', isAuthenticated, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

      const { boardNumber } = req.body;
      if (!boardNumber || typeof boardNumber !== 'number') {
        return res.status(400).json({ message: "boardNumber is required" });
      }

      const existingSessions = await storage.getBoardSessionsByTournamentId(tournamentId);
      const existing = existingSessions.find(s => s.boardNumber === boardNumber);
      if (existing) {
        await storage.deleteBoardSession(existing.id);
      }

      const pairingToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const session = await storage.createBoardSession({
        tournamentId,
        boardNumber,
        pairingToken,
        expiresAt,
        accessToken: null,
        pairedAt: null,
      });

      res.json({ session, pairingToken });
    } catch (err) {
      console.error("Create board session error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/tournaments/:id/board-sessions', isAuthenticated, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

      const sessions = await storage.getBoardSessionsByTournamentId(tournamentId);
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete('/api/board-sessions/:id', isAuthenticated, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      await storage.deleteBoardSession(sessionId);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === PAIRING ENDPOINT ===
  app.get('/pair', async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).send("Missing pairing token");
      }

      const boardSession = await storage.getBoardSessionByToken(token);
      if (!boardSession) {
        return res.status(404).send("Invalid or expired pairing token");
      }

      if (boardSession.expiresAt && new Date() > boardSession.expiresAt) {
        return res.status(410).send("Pairing token has expired");
      }

      const accessToken = randomBytes(32).toString("hex");
      await storage.markBoardSessionPaired(boardSession.id, accessToken);

      res.cookie("boardAccessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24,
        path: "/",
      });

      res.redirect(`/scorer/${boardSession.tournamentId}/${boardSession.boardNumber}`);
    } catch (err) {
      console.error("Pairing error:", err);
      res.status(500).send("Pairing failed");
    }
  });

  // === SCORER API (board-authenticated) ===
  const isBoardAuthenticated = async (req: any, res: any, next: any) => {
    const accessToken = req.cookies?.boardAccessToken;
    if (!accessToken) return res.status(401).json({ message: "No board access token" });

    const boardSession = await storage.getBoardSessionByAccessToken(accessToken);
    if (!boardSession || !boardSession.pairedAt) {
      return res.status(401).json({ message: "Invalid board session" });
    }
    if (boardSession.expiresAt && new Date() > boardSession.expiresAt) {
      return res.status(401).json({ message: "Board session has expired" });
    }
    req.boardSession = boardSession;
    next();
  };

  app.get('/api/scorer/board-data', isBoardAuthenticated, async (req: any, res) => {
    try {
      const { tournamentId, boardNumber } = req.boardSession;
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });

      const [playersList, groupsList, allMatches, allMemberships] = await Promise.all([
        storage.getPlayersByTournamentId(tournamentId),
        storage.getGroupsByTournamentId(tournamentId),
        storage.getMatchesByTournamentId(tournamentId),
        storage.getGroupMembershipsByTournamentId(tournamentId),
      ]);

      const sortedGroups = groupsList.sort((a, b) => a.name.localeCompare(b.name));
      const group = sortedGroups[boardNumber - 1];
      if (!group) return res.status(404).json({ message: "Board not found" });

      const groupMatches = allMatches.filter(m => m.groupId === group.id);
      const knockoutBoardMatches = allMatches.filter(m => m.stage === 'KNOCKOUT' && (m as any).boardNumber === boardNumber);
      const boardMatches = [...groupMatches, ...knockoutBoardMatches];

      const groupMembershipPlayerIds = allMemberships
        .filter(m => m.groupId === group.id)
        .map(m => m.playerId);
      const knockoutPlayerIds = knockoutBoardMatches.flatMap(m => [m.playerAId, m.playerBId].filter(Boolean)) as number[];
      const allRelevantPlayerIds = new Set([...groupMembershipPlayerIds, ...knockoutPlayerIds]);
      const boardPlayers = playersList.filter(p => allRelevantPlayerIds.has(p.id));

      res.json({
        tournament,
        group,
        boardNumber,
        totalBoards: sortedGroups.length,
        players: boardPlayers,
        matches: boardMatches,
        accessToken: req.cookies?.boardAccessToken,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/scorer/matches/:matchId/start', isBoardAuthenticated, async (req: any, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const { tournamentId, boardNumber } = req.boardSession;
      if (match.tournamentId !== tournamentId) {
        return res.status(403).json({ message: "Match does not belong to this tournament" });
      }

      if (match.status !== 'PENDING') {
        return res.status(400).json({ message: "Match is not in PENDING status" });
      }

      const allMatches = await storage.getMatchesByTournamentId(tournamentId);
      const boardGroups = await storage.getGroupsByTournamentId(tournamentId);
      const sortedGroups = boardGroups.sort((a, b) => a.name.localeCompare(b.name));
      const boardGroup = sortedGroups[boardNumber - 1];
      if (!boardGroup) {
        return res.status(404).json({ message: "Board group not found" });
      }
      const isGroupMatch = match.groupId === boardGroup.id;
      const isKnockoutOnBoard = match.stage === 'KNOCKOUT' && (match as any).boardNumber === boardNumber;
      if (!isGroupMatch && !isKnockoutOnBoard) {
        return res.status(403).json({ message: "Match is not assigned to this board" });
      }
      const boardMatches = [
        ...allMatches.filter(m => m.groupId === boardGroup.id),
        ...allMatches.filter(m => m.stage === 'KNOCKOUT' && (m as any).boardNumber === boardNumber),
      ];
      const existingInProgress = boardMatches.find(m => m.status === 'IN_PROGRESS' && m.id !== matchId);
      if (existingInProgress) {
        return res.status(400).json({ message: "Another match is already in progress on this board" });
      }

      const updatedMatch = await storage.updateMatch(matchId, {
        status: "IN_PROGRESS",
        scoreA: 0,
        scoreB: 0,
      });

      const tournament = await storage.getTournament(tournamentId);
      emitMatchUpdate(tournamentId, tournament?.shareToken || null, updatedMatch);
      emitBoardMatchUpdate(tournamentId, boardNumber, updatedMatch);

      res.json(updatedMatch);
    } catch (err) {
      console.error("Scorer match start error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put('/api/scorer/matches/:matchId', isBoardAuthenticated, async (req: any, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const { tournamentId, boardNumber } = req.boardSession;
      if (match.tournamentId !== tournamentId) {
        return res.status(403).json({ message: "Match does not belong to this tournament" });
      }

      const { scoreA, scoreB } = req.body;
      if (typeof scoreA !== 'number' || typeof scoreB !== 'number') {
        return res.status(400).json({ message: "scoreA and scoreB are required" });
      }

      if (match.status !== 'IN_PROGRESS') {
        return res.status(400).json({ message: "Match must be IN_PROGRESS to update scores" });
      }

      const matchBestOf = match.bestOf || 3;
      const legsToWin = Math.ceil(matchBestOf / 2);
      const isFinished = scoreA >= legsToWin || scoreB >= legsToWin;

      let winnerId: number | null = null;
      let status: string = "IN_PROGRESS";
      if (isFinished) {
        status = "COMPLETED";
        if (scoreA > scoreB && match.playerAId) winnerId = match.playerAId;
        else if (scoreB > scoreA && match.playerBId) winnerId = match.playerBId;
      }

      const updatedMatch = await storage.updateMatch(matchId, {
        scoreA,
        scoreB,
        winnerId,
        status,
      });
      if (status === "COMPLETED") {
        clearLiveScoringCache(matchId);
      }

      if (req.body.notes) {
        const noteValues = Object.fromEntries(
          Object.entries(req.body.notes).filter(([, v]) => v !== undefined)
        );
        if (Object.keys(noteValues).length > 0) {
          await storage.updateMatchNote(matchId, noteValues);
        }
      }

      const tournament = await storage.getTournament(tournamentId);
      emitMatchUpdate(tournamentId, tournament?.shareToken || null, updatedMatch);
      emitBoardMatchUpdate(tournamentId, boardNumber, updatedMatch);

      if (status === "COMPLETED" && match.stage === 'GROUP' && match.groupId) {
        try {
          const allMatches = await storage.getMatchesByTournamentId(tournamentId);
          const thisGroupMatches = allMatches.filter(m => m.stage === 'GROUP' && m.groupId === match.groupId);
          const thisGroupDone = thisGroupMatches.every(m => m.status === 'COMPLETED' || m.id === matchId);

          if (thisGroupDone) {
            const settings = (tournament?.settings || {}) as any;
            const ptsWin = settings.pointsForWin ?? 2;
            const ptsLoss = settings.pointsForLoss ?? 0;
            await promoteGroupToKnockout({
              tournamentId,
              completedGroupId: match.groupId,
              currentMatchId: matchId,
              currentMatchWinnerId: winnerId,
              ptsWin,
              ptsLoss,
              shareToken: tournament?.shareToken || null,
            });
          }
        } catch (progressionError) {
          console.error("Scorer auto-progression error (non-fatal):", progressionError);
        }
      }

      if (status === "COMPLETED" && match.stage === 'KNOCKOUT' && winnerId) {
        try {
          const allMatches = await storage.getMatchesByTournamentId(tournamentId);
          const knockoutMatches = allMatches.filter(m => m.stage === 'KNOCKOUT');
          const sorted = [...knockoutMatches].sort((a: any, b: any) => a.order - b.order);
          const roundKeys: string[] = [];
          for (const m of sorted) {
            if (!roundKeys.includes(m.roundKey)) roundKeys.push(m.roundKey);
          }
          const currentRoundIdx = roundKeys.indexOf(match.roundKey);
          if (currentRoundIdx >= 0 && currentRoundIdx < roundKeys.length - 1) {
            const nextRoundKey = roundKeys[currentRoundIdx + 1];
            const currentRoundMatches = sorted.filter(m => m.roundKey === match.roundKey);
            const nextRoundMatches = sorted.filter(m => m.roundKey === nextRoundKey);
            const matchIndexInRound = currentRoundMatches.findIndex(m => m.id === matchId);
            const nextMatchIndex = Math.floor(matchIndexInRound / 2);
            const isTopSlot = matchIndexInRound % 2 === 0;

            if (nextMatchIndex < nextRoundMatches.length) {
              const nextMatch = nextRoundMatches[nextMatchIndex];
              const updatedNextMatch = await storage.updateMatch(nextMatch.id, isTopSlot
                ? { playerAId: winnerId } as any
                : { playerBId: winnerId } as any
              );
              emitMatchUpdate(tournamentId, tournament?.shareToken || null, updatedNextMatch);
              if ((updatedNextMatch as any).boardNumber) {
                emitBoardMatchUpdate(tournamentId, (updatedNextMatch as any).boardNumber, updatedNextMatch);
              }
            }
          }
        } catch (progressionError) {
          console.error("Scorer knockout progression error (non-fatal):", progressionError);
        }
      }

      res.json(updatedMatch);
    } catch (err) {
      console.error("Scorer match update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/scorer/matches/:matchId/leg-scoring', isBoardAuthenticated, async (req: any, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const { tournamentId, boardNumber } = req.boardSession;
      if (match.tournamentId !== tournamentId) {
        return res.status(403).json({ message: "Match does not belong to this tournament" });
      }

      const tournament = await storage.getTournament(tournamentId);
      emitLegScoring(tournamentId, boardNumber, tournament?.shareToken || null, {
        matchId,
        ...req.body,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Scorer leg scoring error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/public/t/:shareToken/match/:matchId/notes', async (req, res) => {
    try {
      const { shareToken, matchId } = req.params;
      const mid = parseInt(matchId, 10);
      if (isNaN(mid)) return res.status(400).json({ message: "Invalid match ID" });

      const tournament = await storage.getTournamentByShareToken(shareToken);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });

      const match = await storage.getMatch(mid);
      if (!match || match.tournamentId !== tournament.id) return res.status(404).json({ message: "Match not found" });

      const note = await storage.getMatchNote(mid);
      res.json(note || null);
    } catch (err) {
      console.error("Public match notes error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Board-specific public endpoint: returns data for a single group/board
  app.get('/api/public/t/:shareToken/board/:boardNumber', async (req, res) => {
    const { shareToken, boardNumber } = req.params;
    const boardNum = parseInt(boardNumber, 10);
    if (isNaN(boardNum) || boardNum < 1) return res.status(400).json({ message: "Invalid board number" });

    const tournament = await storage.getTournamentByShareToken(shareToken);
    if (!tournament) return res.status(404).json({ message: "Tournament not found" });

    const [playersList, groupsList, allMatches, allMemberships] = await Promise.all([
      storage.getPlayersByTournamentId(tournament.id),
      storage.getGroupsByTournamentId(tournament.id),
      storage.getMatchesByTournamentId(tournament.id),
      storage.getGroupMembershipsByTournamentId(tournament.id),
    ]);

    // Sort groups alphabetically (Group A = board 1, Group B = board 2, etc.)
    const sortedGroups = groupsList.sort((a, b) => a.name.localeCompare(b.name));
    const group = sortedGroups[boardNum - 1];
    if (!group) return res.status(404).json({ message: `Board ${boardNum} not found. This tournament has ${sortedGroups.length} group(s).` });

    const groupMatches = allMatches.filter(m => m.groupId === group.id);
    const knockoutBoardMatches = allMatches.filter(m => m.stage === 'KNOCKOUT' && (m as any).boardNumber === boardNum);
    const boardMatches = [...groupMatches, ...knockoutBoardMatches];

    const groupMembershipPlayerIds = allMemberships
      .filter(m => m.groupId === group.id)
      .map(m => m.playerId);
    const knockoutPlayerIds = knockoutBoardMatches.flatMap(m => [m.playerAId, m.playerBId].filter(Boolean)) as number[];
    const allRelevantPlayerIds = new Set([...groupMembershipPlayerIds, ...knockoutPlayerIds]);
    const boardPlayers = playersList.filter(p => allRelevantPlayerIds.has(p.id));

    res.json({
      tournament,
      group,
      boardNumber: boardNum,
      totalBoards: sortedGroups.length,
      players: boardPlayers,
      matches: boardMatches,
    });
  });

  return httpServer;
}
