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

const scryptAsync = promisify(scrypt);

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

  app.delete(api.tournaments.delete.path, isAuthenticated, async (req, res) => {
     const id = parseInt(req.params.id);
     const tournament = await storage.getTournament(id);
     if (!tournament) return res.status(404).json({ message: "Not found" });
     if (tournament.userId !== (req.user as any).id) return res.status(401).json({ message: "Unauthorized" });

     await storage.deleteTournament(id);
     res.sendStatus(204);
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
    
    let winnerId: number | null = null;
    if (input.scoreA > input.scoreB && match.playerAId) {
      winnerId = match.playerAId;
    } else if (input.scoreB > input.scoreA && match.playerBId) {
      winnerId = match.playerBId;
    }

    const updatedMatch = await storage.updateMatch(id, {
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        winnerId,
        status: "COMPLETED"
    });
    
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
      const ptsDraw = settings.pointsForDraw ?? 1;
      const ptsLoss = settings.pointsForLoss ?? 0;

      if (match.stage === 'GROUP') {
        // Check if ALL group stage matches are now completed
        const groupMatches = allMatches.filter(m => m.stage === 'GROUP');
        const allGroupsDone = groupMatches.every(m => m.status === 'COMPLETED' || m.id === id);

        if (allGroupsDone) {
          const groupsList = await storage.getGroupsByTournamentId(match.tournamentId);
          const playersList = await storage.getPlayersByTournamentId(match.tournamentId);
          const memberships = await storage.getGroupMembershipsByTournamentId(match.tournamentId);
          const knockoutMatches = allMatches.filter(m => m.stage === 'KNOCKOUT');

          if (knockoutMatches.length > 0 && groupsList.length > 0) {
            const sorted = [...knockoutMatches].sort((a: any, b: any) => a.order - b.order);
            const roundKeys: string[] = [];
            for (const m of sorted) {
              if (!roundKeys.includes(m.roundKey)) roundKeys.push(m.roundKey);
            }
            const firstRoundKey = roundKeys[0];
            const firstRoundMatches = sorted.filter(m => m.roundKey === firstRoundKey);

            // Calculate standings for each group
            const calcGroupStandings = (groupId: number) => {
              const memberPlayerIds = memberships.filter(gm => gm.groupId === groupId).map(gm => gm.playerId);
              const groupPlayers = playersList.filter(p => memberPlayerIds.includes(p.id));
              const gMatches = groupMatches.filter(m => m.groupId === groupId);
              const completedGMatches = gMatches.filter(m => m.status === 'COMPLETED' || m.id === id);

              const stats = groupPlayers.map(player => {
                const playerMs = completedGMatches.filter(m => m.playerAId === player.id || m.playerBId === player.id);
                let won = 0, drawn = 0, lost = 0, legsFor = 0, legsAgainst = 0;
                playerMs.forEach(m => {
                  const isA = m.playerAId === player.id;
                  const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
                  const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
                  legsFor += myScore;
                  legsAgainst += oppScore;
                  const mWinnerId = m.id === id ? winnerId : m.winnerId;
                  if (mWinnerId === player.id) won++;
                  else if (mWinnerId === null) drawn++;
                  else lost++;
                });
                return {
                  id: player.id,
                  pts: (won * ptsWin) + (drawn * ptsDraw) + (lost * ptsLoss),
                  legsFor,
                  legsAgainst,
                  diff: legsFor - legsAgainst,
                };
              });

              return stats.sort((a, b) => {
                if (b.pts !== a.pts) return b.pts - a.pts;
                if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor;
                const h2h = completedGMatches.find(m =>
                  (m.playerAId === a.id && m.playerBId === b.id) ||
                  (m.playerAId === b.id && m.playerBId === a.id)
                );
                if (h2h) {
                  const h2hWinner = h2h.id === id ? winnerId : h2h.winnerId;
                  if (h2hWinner === a.id) return -1;
                  if (h2hWinner === b.id) return 1;
                }
                return 0;
              });
            };

            // Build pairings (same logic as frontend knockoutSlotLabels)
            const groupCount = groupsList.length;
            type Pairing = { aGroupIdx: number; aPos: number; bGroupIdx: number; bPos: number };
            const pairings: Pairing[] = [];

            if (groupCount === 2) {
              pairings.push(
                { aGroupIdx: 0, aPos: 0, bGroupIdx: 1, bPos: 1 },
                { aGroupIdx: 1, aPos: 0, bGroupIdx: 0, bPos: 1 },
              );
            } else if (groupCount === 4) {
              pairings.push(
                { aGroupIdx: 0, aPos: 0, bGroupIdx: 1, bPos: 1 },
                { aGroupIdx: 2, aPos: 1, bGroupIdx: 3, bPos: 0 },
                { aGroupIdx: 2, aPos: 0, bGroupIdx: 3, bPos: 1 },
                { aGroupIdx: 0, aPos: 1, bGroupIdx: 1, bPos: 0 },
              );
            } else if (groupCount === 3) {
              pairings.push(
                { aGroupIdx: 0, aPos: 0, bGroupIdx: 2, bPos: 1 },
                { aGroupIdx: 1, aPos: 0, bGroupIdx: 0, bPos: 1 },
                { aGroupIdx: 2, aPos: 0, bGroupIdx: 1, bPos: 1 },
              );
            } else {
              for (let i = 0; i < groupCount; i++) {
                const oppIdx = (groupCount - 1 - i) % groupCount;
                pairings.push({ aGroupIdx: i, aPos: 0, bGroupIdx: oppIdx, bPos: 1 });
              }
            }

            // Calculate standings per group and assign players
            const standingsPerGroup: Record<number, { id: number; pts: number; legsFor: number }[]> = {};
            for (const group of groupsList) {
              standingsPerGroup[group.id] = calcGroupStandings(group.id);
            }

            for (let i = 0; i < firstRoundMatches.length && i < pairings.length; i++) {
              const pairing = pairings[i];
              const groupA = groupsList[pairing.aGroupIdx];
              const groupB = groupsList[pairing.bGroupIdx];
              if (!groupA || !groupB) continue;

              const standingsA = standingsPerGroup[groupA.id];
              const standingsB = standingsPerGroup[groupB.id];
              const playerAId = standingsA?.[pairing.aPos]?.id || null;
              const playerBId = standingsB?.[pairing.bPos]?.id || null;

              if (playerAId || playerBId) {
                await storage.updateMatch(firstRoundMatches[i].id, {
                  playerAId: playerAId ?? undefined,
                  playerBId: playerBId ?? undefined,
                } as any);
              }
            }
          }
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
            await storage.updateMatch(nextMatch.id, isTopSlot
              ? { playerAId: winnerId } as any
              : { playerBId: winnerId } as any
            );
          }
        }
      }
    } catch (progressionError) {
      console.error("Auto-progression error (non-fatal):", progressionError);
    }
    
    res.json(updatedMatch);
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

    // Filter matches for this group only
    const groupMatches = allMatches.filter(m => m.groupId === group.id);
    
    // Get players in this group via memberships
    const groupMembershipPlayerIds = allMemberships
      .filter(m => m.groupId === group.id)
      .map(m => m.playerId);
    const groupPlayers = playersList.filter(p => groupMembershipPlayerIds.includes(p.id));

    res.json({
      tournament,
      group,
      boardNumber: boardNum,
      totalBoards: sortedGroups.length,
      players: groupPlayers,
      matches: groupMatches,
    });
  });

  return httpServer;
}
