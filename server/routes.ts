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
import { generateMatches, regenerateGroupMatchesFromMemberships } from "./match-generator";
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

async function backfillKnockoutScorers() {
  try {
    const allTournaments = await storage.getAllTournaments();
    for (const tournament of allTournaments) {
      if (tournament.type !== 'MULTI_STAGE') continue;
      if (tournament.status !== 'IN_PROGRESS' && tournament.status !== 'COMPLETED') continue;

      const allMatches = await storage.getMatchesByTournamentId(tournament.id);
      const knockoutMatches = allMatches.filter(m => m.stage === 'KNOCKOUT');
      const qfMatches = knockoutMatches
        .filter(m => m.roundKey === 'QF' && m.scorerId === null && (m.playerAId || m.playerBId))
        .sort((a: any, b: any) => a.order - b.order);

      if (qfMatches.length === 0) continue;

      const groupsList = await storage.getGroupsByTournamentId(tournament.id);
      const playersList = await storage.getPlayersByTournamentId(tournament.id);
      const memberships = await storage.getGroupMembershipsByTournamentId(tournament.id);
      const groupMatches = allMatches.filter(m => m.stage === 'GROUP');
      const settings = (tournament.settings || {}) as any;
      const ptsWin = settings.pointsForWin ?? 2;
      const ptsLoss = settings.pointsForLoss ?? 0;

      const promotedIds = new Set<number>();
      for (const group of groupsList) {
        const memberIds = memberships.filter(gm => gm.groupId === group.id).map(gm => gm.playerId);
        const gPlayers = playersList.filter(p => memberIds.includes(p.id));
        const gMatches = groupMatches.filter(m => m.groupId === group.id && m.status === 'COMPLETED');
        const stats = gPlayers.map(player => {
          const pMatches = gMatches.filter(m => m.playerAId === player.id || m.playerBId === player.id);
          let won = 0, legsFor = 0, legsAgainst = 0;
          pMatches.forEach(m => {
            const isA = m.playerAId === player.id;
            legsFor += isA ? (m.scoreA || 0) : (m.scoreB || 0);
            legsAgainst += isA ? (m.scoreB || 0) : (m.scoreA || 0);
            if (m.winnerId === player.id) won++;
          });
          return { id: player.id, pts: won * ptsWin, diff: legsFor - legsAgainst, legsFor };
        });
        stats.sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.legsFor - a.legsFor);
        for (let i = 0; i < 2 && i < stats.length; i++) promotedIds.add(stats[i].id);
      }

      let lastScorerId: number | null = null;
      for (const qf of qfMatches) {
        const playerAGroupId = memberships.find(gm => gm.playerId === qf.playerAId)?.groupId;
        const playerBGroupId = memberships.find(gm => gm.playerId === qf.playerBId)?.groupId;
        const scorerGroupId = playerAGroupId || playerBGroupId;
        if (!scorerGroupId) continue;

        const groupMemberIds = memberships.filter(gm => gm.groupId === scorerGroupId).map(gm => gm.playerId);
        const nonPromoted = playersList.filter(p => groupMemberIds.includes(p.id) && !promotedIds.has(p.id));
        if (nonPromoted.length === 0) continue;

        let pool = nonPromoted.filter(p => p.id !== lastScorerId);
        if (pool.length === 0) pool = [...nonPromoted];
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        await storage.updateMatch(qf.id, { scorerId: chosen.id, scorerName: chosen.name } as any);
        lastScorerId = chosen.id;
      }
      console.log(`Backfilled knockout scorers for tournament ${tournament.id} (${tournament.name})`);
    }
  } catch (err) {
    console.error("Backfill knockout scorers error:", err);
  }
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
      const { email, memorableWord, newPassword } = req.body;
      if (!email || !memorableWord || !newPassword) {
        return res.status(400).json({ message: "Email, memorable word, and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const now = Date.now();
      const attempt = resetAttempts.get(email);
      if (attempt && attempt.count >= 5 && now - attempt.lastAttempt < 15 * 60 * 1000) {
        return res.status(429).json({ message: "Too many attempts. Please try again in 15 minutes." });
      }
      resetAttempts.set(email, {
        count: (attempt && now - attempt.lastAttempt < 15 * 60 * 1000) ? attempt.count + 1 : 1,
        lastAttempt: now,
      });

      const user = await storage.getUserByUsername(email);
      if (!user || !user.memorableWord) {
        return res.status(400).json({ message: "The details you entered don't match our records. Please try again." });
      }
      const wordValid = await comparePassword(memorableWord.toLowerCase().trim(), user.memorableWord);
      if (!wordValid) {
        return res.status(400).json({ message: "The details you entered don't match our records. Please try again." });
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(email, hashedPassword);
      res.json({ message: "Password has been reset successfully." });
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
    const user = req.user as any;
    const { password, memorableWord, ...safeUser } = user;
    res.json({ ...safeUser, hasMemorableWord: !!memorableWord });
  });

  // === ACCOUNT ROUTES ===
  app.put(api.account.updateProfile.path, isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const input = api.account.updateProfile.input.parse(req.body);
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.dateOfBirth !== undefined) updateData.dateOfBirth = input.dateOfBirth;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.billingAddress !== undefined) updateData.billingAddress = input.billingAddress;
      const updated = await storage.updateUser(user.id, updateData);
      const { password, memorableWord, ...safeUser } = updated;
      res.json({ ...safeUser, hasMemorableWord: !!memorableWord });
    } catch {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put(api.account.updateEmail.path, isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const input = api.account.updateEmail.input.parse(req.body);
      const isValid = await comparePassword(input.currentPassword, user.password);
      if (!isValid) return res.status(400).json({ message: "Current password is incorrect" });
      const existing = await storage.getUserByUsername(input.email);
      if (existing && existing.id !== user.id) return res.status(400).json({ message: "Email already in use" });
      const updated = await storage.updateUser(user.id, { email: input.email });
      const { password, memorableWord, ...safeUser } = updated;
      res.json({ ...safeUser, hasMemorableWord: !!memorableWord });
    } catch {
      res.status(500).json({ message: "Failed to update email" });
    }
  });

  app.put(api.account.updatePassword.path, isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const input = api.account.updatePassword.input.parse(req.body);
      const isValid = await comparePassword(input.currentPassword, user.password);
      if (!isValid) return res.status(400).json({ message: "Current password is incorrect" });
      if (input.newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hashed = await hashPassword(input.newPassword);
      await storage.updateUserPassword(user.email, hashed);
      res.json({ message: "Password updated" });
    } catch {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.put(api.account.setMemorableWord.path, isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const input = api.account.setMemorableWord.input.parse(req.body);
      const isValid = await comparePassword(input.currentPassword, user.password);
      if (!isValid) return res.status(400).json({ message: "Current password is incorrect" });
      if (input.memorableWord.length < 3) return res.status(400).json({ message: "Memorable word must be at least 3 characters" });
      const hashed = await hashPassword(input.memorableWord.toLowerCase().trim());
      await storage.updateUser(user.id, { memorableWord: hashed });
      res.json({ message: "Memorable word set" });
    } catch {
      res.status(500).json({ message: "Failed to set memorable word" });
    }
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
        if (playerList.length > existingPlayers.length) {
          return res.status(400).json({ message: `Cannot exceed ${existingPlayers.length} players (tournament size).` });
        }
        const resultPlayers = [];

        for (let i = 0; i < playerList.length; i++) {
          if (i < existingPlayers.length) {
            const updated = await storage.updatePlayer(existingPlayers[i].id, { name: playerList[i].name });
            resultPlayers.push(updated);
          } else {
            const newPlayer = await storage.createPlayer({
              name: playerList[i].name,
              tournamentId: id,
              seed: playerList[i].seed,
            });
            resultPlayers.push(newPlayer);
          }
        }

        for (let i = playerList.length; i < existingPlayers.length; i++) {
          await storage.deletePlayer(existingPlayers[i].id);
        }

        return res.json(resultPlayers);
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

  app.delete("/api/tournaments/:id/players/:playerId", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playerId = parseInt(req.params.playerId);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      if (!tournament.isLegacy) return res.status(400).json({ message: "Player deletion is only available for legacy tournaments" });
      const tournamentPlayers = await storage.getPlayersByTournamentId(id);
      if (!tournamentPlayers.find(p => p.id === playerId)) return res.status(404).json({ message: "Player not found in this tournament" });
      await storage.deletePlayer(playerId);
      res.json({ message: "Player deleted" });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/tournaments/:id/players/:playerId/group", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playerId = parseInt(req.params.playerId);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      if (!tournament.isLegacy) return res.status(400).json({ message: "Group reassignment is only available for legacy tournaments" });
      const tournamentPlayers = await storage.getPlayersByTournamentId(id);
      if (!tournamentPlayers.find(p => p.id === playerId)) return res.status(404).json({ message: "Player not found in this tournament" });
      const { groupId } = req.body;
      if (!groupId || typeof groupId !== "number") return res.status(400).json({ message: "groupId is required" });
      const tournamentGroups = await storage.getGroupsByTournamentId(id);
      const targetGroup = tournamentGroups.find(g => g.id === groupId);
      if (!targetGroup) return res.status(404).json({ message: "Group not found in this tournament" });
      await storage.deleteGroupMembershipsByPlayerId(playerId);
      const membership = await storage.createGroupMembership({ groupId, playerId });
      res.json(membership);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/tournaments/:id/matches/manual", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      if (!tournament.isLegacy) return res.status(400).json({ message: "Manual match creation is only available for legacy tournaments" });
      const { playerAId, playerBId, stage, roundKey, groupId, bestOf } = req.body;
      if (!playerAId || !playerBId) return res.status(400).json({ message: "Both players are required" });
      if (playerAId === playerBId) return res.status(400).json({ message: "Cannot match a player against themselves" });
      const tournamentPlayers = await storage.getPlayersByTournamentId(id);
      const playerIds = tournamentPlayers.map(p => p.id);
      if (!playerIds.includes(playerAId) || !playerIds.includes(playerBId)) {
        return res.status(400).json({ message: "Players must belong to this tournament" });
      }
      if (groupId) {
        const tournamentGroups = await storage.getGroupsByTournamentId(id);
        if (!tournamentGroups.find(g => g.id === groupId)) {
          return res.status(400).json({ message: "Group not found in this tournament" });
        }
      }
      const existingMatches = await storage.getMatchesByTournamentId(id);
      const maxOrder = existingMatches.length > 0 ? Math.max(...existingMatches.map(m => m.order)) : 0;
      const match = await storage.createMatch({
        tournamentId: id,
        stage: stage || "GROUP",
        roundKey: roundKey || "group",
        groupId: groupId || null,
        playerAId,
        playerBId,
        scoreA: 0,
        scoreB: 0,
        bestOf: bestOf || (tournament.settings as any)?.matchFormat || 3,
        status: "PENDING",
        winnerId: null,
        order: maxOrder + 1,
        boardNumber: null,
        scorerId: null,
        scorerName: null,
      });
      res.json(match);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/tournaments/:id/matches/:matchId", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const matchId = parseInt(req.params.matchId);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      if (!tournament.isLegacy) return res.status(400).json({ message: "Match deletion is only available for legacy tournaments" });
      const existingMatches = await storage.getMatchesByTournamentId(id);
      if (!existingMatches.find(m => m.id === matchId)) {
        return res.status(404).json({ message: "Match not found in this tournament" });
      }
      await storage.deleteMatch(matchId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/tournaments/:id/matches/:matchId/players", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const matchId = parseInt(req.params.matchId);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      if (!tournament.isLegacy) return res.status(400).json({ message: "Only available for legacy tournaments" });
      const existingMatches = await storage.getMatchesByTournamentId(id);
      const match = existingMatches.find(m => m.id === matchId);
      if (!match) return res.status(404).json({ message: "Match not found in this tournament" });
      const { playerAId, playerBId } = req.body;
      if (playerAId !== undefined && playerAId !== null) {
        const tournamentPlayers = await storage.getPlayersByTournamentId(id);
        if (!tournamentPlayers.find(p => p.id === playerAId)) {
          return res.status(400).json({ message: "Player A not found in tournament" });
        }
      }
      if (playerBId !== undefined && playerBId !== null) {
        const tournamentPlayers = await storage.getPlayersByTournamentId(id);
        if (!tournamentPlayers.find(p => p.id === playerBId)) {
          return res.status(400).json({ message: "Player B not found in tournament" });
        }
      }
      const updateData: any = {};
      if (playerAId !== undefined) updateData.playerAId = playerAId;
      if (playerBId !== undefined) updateData.playerBId = playerBId;
      const updated = await storage.updateMatch(matchId, updateData);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/tournaments/:id/matches/recalculate", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tournament = await storage.getTournament(id);
      if (!tournament) return res.status(404).json({ message: "Not found" });
      if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });
      if (!tournament.isLegacy) return res.status(400).json({ message: "Recalculate is only available for legacy tournaments" });
      const settings = (tournament.settings || {}) as TournamentSettings;
      await regenerateGroupMatchesFromMemberships(id, settings);
      res.json({ success: true });
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
      
      if (input.leagueId) {
        const league = await storage.getLeague(input.leagueId);
        if (!league || league.userId !== userId) {
          return res.status(400).json({ message: "League not found" });
        }
      }

      const tournament = await storage.createTournament({
        name: input.name,
        type: input.type,
        userId,
        settings: input.settings,
        status: "NOT_STARTED",
        leagueId: input.leagueId || null,
        isLegacy: input.isLegacy || false,
        eventDate: input.eventDate || null,
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

      const { name, settings, eventDate } = req.body;

      await storage.updateTournament(id, {
        ...(name ? { name } : {}),
        ...(settings ? { settings } : {}),
        ...(eventDate !== undefined ? { eventDate: eventDate || null } : {}),
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

    // Auto-complete tournament when final match has a winner
    try {
      if (winnerId && !isReset) {
        const allMatchesForComplete = await storage.getMatchesByTournamentId(match.tournamentId);
        const isFinalMatch = (
          (match.stage === 'KNOCKOUT' && (match.roundKey === 'F' || match.roundKey === 'GF')) ||
          match.stage === 'GRAND_FINAL'
        );

        const allRoundRobin = allMatchesForComplete.every(m => m.stage === 'GROUP');
        const allCompleted = allMatchesForComplete.every(m => m.status === 'COMPLETED' || m.id === id);

        if (isFinalMatch || (allRoundRobin && allCompleted)) {
          await storage.updateTournament(match.tournamentId, { status: "COMPLETED" });
        }
      }
    } catch (completeError) {
      console.error("Auto-complete error (non-fatal):", completeError);
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

      // Auto-complete tournament when final match has a winner
      if (status === "COMPLETED" && winnerId) {
        try {
          const isFinalMatch = (
            (match.stage === 'KNOCKOUT' && (match.roundKey === 'F' || match.roundKey === 'GF')) ||
            match.stage === 'GRAND_FINAL'
          );

          const allMatchesCheck = await storage.getMatchesByTournamentId(tournamentId);
          const allRoundRobin = allMatchesCheck.every(m => m.stage === 'GROUP');
          const allDone = allMatchesCheck.every(m => m.status === 'COMPLETED' || m.id === matchId);

          if (isFinalMatch || (allRoundRobin && allDone)) {
            await storage.updateTournament(tournamentId, { status: "COMPLETED" });
          }
        } catch (completeError) {
          console.error("Scorer auto-complete error (non-fatal):", completeError);
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

  // === LEAGUE ROUTES ===

  app.get("/api/leagues", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const leaguesList = await storage.getLeaguesByUserId(userId);
    res.json(leaguesList);
  });

  app.post("/api/leagues", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const { name, startDate, endDate } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: "League name is required" });
    }
    const league = await storage.createLeague({
      userId,
      name: name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
    });
    res.json(league);
  });

  app.put("/api/leagues/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const leagueId = parseInt(req.params.id);
    const league = await storage.getLeague(leagueId);
    if (!league || league.userId !== userId) return res.status(404).json({ message: "League not found" });
    const { name, startDate, endDate, promotionCount, relegationCount } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: "League name is required" });
    }
    const updateData: any = { name: name.trim() };
    if (startDate !== undefined) updateData.startDate = startDate || null;
    if (endDate !== undefined) updateData.endDate = endDate || null;
    if (promotionCount !== undefined) updateData.promotionCount = Math.max(0, parseInt(promotionCount) || 0);
    if (relegationCount !== undefined) updateData.relegationCount = Math.max(0, parseInt(relegationCount) || 0);
    const updated = await storage.updateLeague(leagueId, updateData);
    res.json(updated);
  });

  app.delete("/api/leagues/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const leagueId = parseInt(req.params.id);
    const league = await storage.getLeague(leagueId);
    if (!league || league.userId !== userId) return res.status(404).json({ message: "League not found" });
    await storage.deleteLeague(leagueId);
    res.json({ success: true });
  });

  app.get("/api/leagues/:id/standings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const leagueId = parseInt(req.params.id);
    const league = await storage.getLeague(leagueId);
    if (!league || league.userId !== userId) return res.status(404).json({ message: "League not found" });

    const leagueTournaments = await storage.getTournamentsByLeagueId(leagueId);

    const STAGE_POINTS: Record<string, number> = {
      'GROUP': 5,
      'QF': 10,
      'SF': 20,
      'RUNNER_UP': 30,
      'WINNER': 40,
    };

    const playerAgg: Record<string, { name: string; points: number; legsWon: number; legsLost: number; tournaments: number }> = {};

    for (const t of leagueTournaments) {
      const allMatches = await storage.getMatchesByTournamentId(t.id);
      const playersList = await storage.getPlayersByTournamentId(t.id);
      const completedMatches = allMatches.filter(m => m.status === 'COMPLETED');

      const eliminationMatches = completedMatches.filter(m =>
        m.stage === 'KNOCKOUT' || m.stage === 'WINNERS_BRACKET' || m.stage === 'LOSERS_BRACKET' || m.stage === 'GRAND_FINAL'
      );
      const finalMatch = eliminationMatches.find(m => m.roundKey === 'F' || m.stage === 'GRAND_FINAL');
      const sfMatches = eliminationMatches.filter(m => m.roundKey === 'SF');
      const qfMatches = eliminationMatches.filter(m => m.roundKey === 'QF');

      for (const player of playersList) {
        const key = player.name.toLowerCase().trim();
        if (!playerAgg[key]) {
          playerAgg[key] = { name: player.name, points: 0, legsWon: 0, legsLost: 0, tournaments: 0 };
        }

        const playerMatches = completedMatches.filter(m => m.playerAId === player.id || m.playerBId === player.id);

        if (playerMatches.length === 0) continue;

        playerMatches.forEach(m => {
          const isA = m.playerAId === player.id;
          playerAgg[key].legsWon += isA ? (m.scoreA || 0) : (m.scoreB || 0);
          playerAgg[key].legsLost += isA ? (m.scoreB || 0) : (m.scoreA || 0);
        });

        let stage = 'GROUP';
        if (finalMatch && finalMatch.winnerId === player.id) {
          stage = 'WINNER';
        } else if (finalMatch && (finalMatch.playerAId === player.id || finalMatch.playerBId === player.id)) {
          stage = 'RUNNER_UP';
        } else if (sfMatches.some(m => m.playerAId === player.id || m.playerBId === player.id)) {
          stage = 'SF';
        } else if (qfMatches.some(m => m.playerAId === player.id || m.playerBId === player.id)) {
          stage = 'QF';
        }

        playerAgg[key].points += STAGE_POINTS[stage] || 0;
        playerAgg[key].tournaments += 1;
      }
    }

    const manualResults = await storage.getLeagueManualResults(leagueId);
    const manualTournamentsByPlayer: Record<string, Set<string>> = {};
    for (const mr of manualResults) {
      const key = mr.playerName.toLowerCase().trim();
      if (!playerAgg[key]) {
        playerAgg[key] = { name: mr.playerName, points: 0, legsWon: 0, legsLost: 0, tournaments: 0 };
      }
      playerAgg[key].points += mr.points;
      playerAgg[key].legsWon += mr.legsWon;
      playerAgg[key].legsLost += mr.legsLost;
      if (!manualTournamentsByPlayer[key]) manualTournamentsByPlayer[key] = new Set();
      manualTournamentsByPlayer[key].add(mr.tournamentLabel.toLowerCase().trim());
    }
    for (const [key, labels] of Object.entries(manualTournamentsByPlayer)) {
      if (playerAgg[key]) playerAgg[key].tournaments += labels.size;
    }

    const standings = Object.values(playerAgg).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
      const diffA = a.legsWon - a.legsLost;
      const diffB = b.legsWon - b.legsLost;
      if (diffB !== diffA) return diffB - diffA;
      return b.tournaments - a.tournaments;
    });

    res.json({
      league,
      tournaments: leagueTournaments.map(t => ({ id: t.id, name: t.name, status: t.status })),
      standings: standings.map((s, i) => ({
        position: i + 1,
        name: s.name,
        points: s.points,
        legsWon: s.legsWon,
        legsLost: s.legsLost,
        legDifference: s.legsWon - s.legsLost,
        tournaments: s.tournaments,
      })),
    });
  });

  app.get("/api/leagues/:id/manual-results", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const leagueId = parseInt(req.params.id);
    const league = await storage.getLeague(leagueId);
    if (!league || league.userId !== userId) return res.status(404).json({ message: "League not found" });
    const results = await storage.getLeagueManualResults(leagueId);
    res.json(results);
  });

  app.post("/api/leagues/:id/manual-results", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const leagueId = parseInt(req.params.id);
    const league = await storage.getLeague(leagueId);
    if (!league || league.userId !== userId) return res.status(404).json({ message: "League not found" });

    const { playerName, tournamentLabel, points, legsWon, legsLost } = req.body;
    if (!playerName || !tournamentLabel) return res.status(400).json({ message: "Player name and tournament label are required" });

    const result = await storage.createLeagueManualResult({
      leagueId,
      playerName: String(playerName).trim(),
      tournamentLabel: String(tournamentLabel).trim(),
      points: Math.max(0, parseInt(points) || 0),
      legsWon: Math.max(0, parseInt(legsWon) || 0),
      legsLost: Math.max(0, parseInt(legsLost) || 0),
    });
    res.json(result);
  });

  app.delete("/api/leagues/:id/manual-results/:resultId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const leagueId = parseInt(req.params.id);
    const league = await storage.getLeague(leagueId);
    if (!league || league.userId !== userId) return res.status(404).json({ message: "League not found" });
    const allResults = await storage.getLeagueManualResults(leagueId);
    const resultId = parseInt(req.params.resultId);
    const result = allResults.find(r => r.id === resultId);
    if (!result) return res.status(404).json({ message: "Result not found" });
    await storage.deleteLeagueManualResult(resultId);
    res.json({ success: true });
  });

  app.put("/api/tournaments/:id/league", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const tournamentId = parseInt(req.params.id);
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament || tournament.userId !== userId) return res.status(404).json({ message: "Tournament not found" });

    const { leagueId } = req.body;
    if (leagueId !== null && leagueId !== undefined) {
      const league = await storage.getLeague(leagueId);
      if (!league || league.userId !== userId) return res.status(400).json({ message: "League not found" });
    }

    const updated = await storage.updateTournament(tournamentId, { leagueId: leagueId || null });
    res.json(updated);
  });

  backfillKnockoutScorers();

  return httpServer;
}
