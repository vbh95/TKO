import { users, tournaments, tournamentCollaborators, players, groups, groupMemberships, matches, matchNotes, matchLegSubmissions, boardSessions, scorerLeases, scorerCurrentLegs, boardOverlaySettings, leagues, leagueManualResults, betaFeedback, feedbackNotifications, adminSettings, adminLogs, SCORER_LEASE_TTL_MS } from "@shared/schema";
import type { 
  User, InsertUser, 
  Tournament, InsertTournament, 
  TournamentCollaborator,
  Player, InsertPlayer,
  Group, InsertGroup,
  GroupMembership, InsertGroupMembership,
  Match, InsertMatch,
  MatchNote, InsertMatchNote,
  BoardSession, InsertBoardSession,
  ScorerLease,
  ScorerCurrentLeg,
  BoardOverlaySettings,
  League, InsertLeague,
  LeagueManualResult, InsertLeagueManualResult,
  BetaFeedback, InsertBetaFeedback,
  FeedbackNotification,
  AdminSetting,
  AdminLog,
} from "@shared/schema";
import {
  emptyScorerCheckoutStats,
  type DurableCurrentLegState,
  type ScorerCheckoutStats,
  type ScorerPendingCheckout,
  type ScorerVisit,
} from "@shared/current-leg";
import { db } from "./db";
import { pool } from "./db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { assertCompletedLegMatchesTransition, assertExpectedScoringVersion, assertIdempotentReplayMatches, assertLegHistoryMatchesScore, ScoringConflictError, ScoringValidationError, validateOneLegAdvance } from "./scoring-integrity";
import { canonicalJson } from "@shared/scoring-integrity";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

export { SCORER_LEASE_TTL_MS };

export type ScorerLeaseOwner = Pick<
  ScorerLease,
  "boardSessionId" | "acquiredAt" | "lastActivityAt" | "expiresAt"
>;

export class ScorerLeaseConflictError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SCORER_LEASE_ACTIVE"
      | "SCORER_LEASE_MISSING"
      | "SCORER_LEASE_EXPIRED"
      | "SCORER_LEASE_SESSION_MISMATCH",
    public readonly currentLease?: ScorerLeaseOwner,
  ) {
    super(message);
    this.name = "ScorerLeaseConflictError";
  }
}

export class ScorerBoardAuthorizationError extends Error {
  constructor(
    message = "Match is not assigned to this board",
    public readonly code = "MATCH_NOT_ASSIGNED_TO_BOARD",
  ) {
    super(message);
    this.name = "ScorerBoardAuthorizationError";
  }
}

export class ScorerMatchStartConflictError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MATCH_NOT_FOUND"
      | "MATCH_NOT_PENDING"
      | "MATCH_NOT_IN_PROGRESS"
      | "BOARD_MATCH_ALREADY_IN_PROGRESS",
    public readonly currentMatch?: Match,
  ) {
    super(message);
    this.name = "ScorerMatchStartConflictError";
  }
}

export type AcquireScorerLeaseInput = {
  matchId: number;
  tournamentId: number;
  boardNumber: number;
  boardSessionId: number;
  takeover?: boolean;
};

export type AcquireScorerLeaseResult = {
  lease: ScorerLease;
  priorOwner?: ScorerLeaseOwner;
  tookOver: boolean;
};

export type PersistCurrentLegInput = {
  matchId: number;
  boardSessionId: number;
  scoringVersion: number;
  remainingA: number;
  remainingB: number;
  currentThrower: "A" | "B";
  legStartingThrower: "A" | "B";
  visits: ScorerVisit[];
  checkoutStats: ScorerCheckoutStats;
  pendingCheckout: ScorerPendingCheckout | null;
  swapPlayers: boolean;
};

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  updateUserPassword(email: string, hashedPassword: string): Promise<boolean>;
  updateUser(id: number, data: Partial<{ name: string; email: string; dateOfBirth: string | null; phone: string | null; billingAddress: string | null; memorableWord: string | null; recoveryKey: string | null }>): Promise<User>;
  createUser(user: InsertUser & { recoveryKey?: string }): Promise<User>;
  deleteUser(id: number): Promise<boolean>;
  
  // Tournaments
  getAllTournaments(): Promise<Tournament[]>;
  getTournamentsByUserId(userId: number): Promise<Tournament[]>;
  getTournament(id: number): Promise<Tournament | undefined>;
  getTournamentByShareToken(token: string): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament & { userId: number }): Promise<Tournament>;
  updateTournament(id: number, tournament: Partial<InsertTournament>): Promise<Tournament>;
  deleteTournament(id: number): Promise<void>;
  
  // Players
  getPlayersByTournamentId(tournamentId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, data: { name: string }): Promise<Player>;
  deletePlayer(id: number): Promise<void>;
  
  // Groups
  getGroupsByTournamentId(tournamentId: number): Promise<Group[]>;
  createGroup(group: InsertGroup): Promise<Group>;
  
  // Group Memberships
  createGroupMembership(membership: InsertGroupMembership): Promise<GroupMembership>;
  deleteGroupMembershipsByPlayerId(playerId: number): Promise<void>;
  getGroupMembershipsByGroupId(groupId: number): Promise<(GroupMembership & { player: Player })[]>;
  getGroupMembershipsByTournamentId(tournamentId: number): Promise<GroupMembership[]>;
  deleteMatch(id: number): Promise<void>;
  deleteGroupMatchesByTournamentId(tournamentId: number): Promise<void>;
  
  // Matches
  getMatchesByTournamentId(tournamentId: number): Promise<(Match & { playerA: Player | null, playerB: Player | null })[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, match: Partial<InsertMatch>): Promise<Match>;
  getMatch(id: number): Promise<Match | undefined>;
  getScorerLease(matchId: number): Promise<ScorerLease | undefined>;
  acquireScorerLease(input: AcquireScorerLeaseInput): Promise<AcquireScorerLeaseResult>;
  takeoverScorerLease(input: Omit<AcquireScorerLeaseInput, "takeover">): Promise<AcquireScorerLeaseResult>;
  heartbeatScorerLease(matchId: number, boardSessionId: number): Promise<ScorerLease>;
  assertActiveScorerLease(matchId: number, boardSessionId: number): Promise<ScorerLease>;
  getCurrentLegState(matchId: number): Promise<DurableCurrentLegState | undefined>;
  persistCurrentLegStateWithLease(input: PersistCurrentLegInput): Promise<DurableCurrentLegState>;
  startMatchWithLease(input: {
    matchId: number;
    tournamentId: number;
    boardNumber: number;
    boardSessionId: number;
    authorizedMatchIds: number[];
    takeover?: boolean;
  }): Promise<AcquireScorerLeaseResult & { match: Match }>;
  restartMatchWithLease(input: {
    matchId: number;
    tournamentId: number;
    boardNumber: number;
    boardSessionId: number;
    authorizedMatchIds: number[];
  }): Promise<{ match: Match; priorOwner: ScorerLeaseOwner }>;
  
  // Match Notes
  getMatchNote(matchId: number): Promise<MatchNote | undefined>;
  getMatchNotesByMatchIds(matchIds: number[]): Promise<MatchNote[]>;
  createMatchNote(note: InsertMatchNote): Promise<MatchNote>;
  updateMatchNote(matchId: number, note: Partial<InsertMatchNote>): Promise<MatchNote>;
  submitCompletedLeg(input: {
    matchId: number;
    expectedVersion: number;
    submissionId: string;
    scoreA: number;
    scoreB: number;
    completedLeg: unknown;
    notes: Partial<InsertMatchNote>;
    boardSessionId?: number;
    checkout?: { dartsAtDouble: number; checkoutDartsUsed: number };
  }): Promise<{ match: Match; replayed: boolean; sideEffectsCompleted: boolean }>;
  submitCompletedLegWithLease(input: {
    matchId: number;
    expectedVersion: number;
    submissionId: string;
    scoreA: number;
    scoreB: number;
    completedLeg: unknown;
    notes: Partial<InsertMatchNote>;
    boardSessionId: number;
    checkout: { dartsAtDouble: number; checkoutDartsUsed: number };
  }): Promise<{ match: Match; replayed: boolean; sideEffectsCompleted: boolean }>;
  markCompletedLegSideEffectsComplete(matchId: number, submissionId: string): Promise<void>;
  
  // Board Sessions
  createBoardSession(session: InsertBoardSession): Promise<BoardSession>;
  getBoardSessionByToken(pairingToken: string): Promise<BoardSession | undefined>;
  getBoardSessionByAccessToken(accessToken: string): Promise<BoardSession | undefined>;
  markBoardSessionPaired(id: number, accessToken: string): Promise<BoardSession>;
  getBoardSessionsByTournamentId(tournamentId: number): Promise<BoardSession[]>;
  deleteBoardSession(id: number): Promise<void>;
  
  // Leagues
  getLeaguesByUserId(userId: number): Promise<League[]>;
  getLeague(id: number): Promise<League | undefined>;
  createLeague(league: InsertLeague): Promise<League>;
  updateLeague(id: number, data: Partial<InsertLeague>): Promise<League>;
  deleteLeague(id: number): Promise<void>;
  getTournamentsByLeagueId(leagueId: number): Promise<Tournament[]>;

  getLeagueByShareToken(token: string): Promise<League | undefined>;

  // League Manual Results
  getLeagueManualResults(leagueId: number): Promise<LeagueManualResult[]>;
  createLeagueManualResult(result: InsertLeagueManualResult): Promise<LeagueManualResult>;
  deleteLeagueManualResult(id: number): Promise<void>;

  // Tournament Collaborators
  getTournamentCollaborators(tournamentId: number): Promise<Array<TournamentCollaborator & { name: string; email: string }>>;
  addTournamentCollaborator(tournamentId: number, userId: number, invitedByUserId: number): Promise<TournamentCollaborator>;
  removeTournamentCollaborator(tournamentId: number, userId: number): Promise<void>;
  isTournamentCollaborator(tournamentId: number, userId: number): Promise<boolean>;
  getCollaboratedTournamentsByUserId(userId: number): Promise<Tournament[]>;
  getCollaboratorCountsForTournaments(tournamentIds: number[]): Promise<Record<number, number>>;
  getOwnerNamesForTournaments(tournamentIds: number[], ownerIds: number[]): Promise<Record<number, string>>;

  // Beta Feedback
  createBetaFeedback(feedback: InsertBetaFeedback): Promise<BetaFeedback>;
  updateFeedback(id: number, data: { status?: string; severity?: string | null; adminNote?: string | null }): Promise<BetaFeedback>;

  // Feedback Notifications
  createFeedbackNotification(data: { feedbackId: number; userId: number; notificationType: string; customMessage?: string | null }): Promise<FeedbackNotification>;
  getUserNotifications(userId: number): Promise<(FeedbackNotification & { feedbackMessage: string; feedbackCategory: string })[]>;
  markNotificationRead(id: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;

  // Admin
  getAllUsersAdmin(): Promise<Array<{ id: number; name: string; email: string; createdAt: Date | null; isSuperUser: boolean; isLocked: boolean; deletedAt: Date | null }>>;
  lockUser(id: number, locked: boolean): Promise<void>;
  softDeleteUser(id: number): Promise<void>;
  getAdminSetting(key: string): Promise<AdminSetting | undefined>;
  setAdminSetting(key: string, value: string | null, enabled: boolean, updatedBy: number): Promise<void>;
  appendAdminLog(entry: { adminId?: number; adminEmail?: string; targetEmail?: string; action: string; detail?: string }): Promise<void>;
  getAdminLogs(limit?: number): Promise<AdminLog[]>;
  getLiveTournaments(): Promise<Tournament[]>;

  // Reset
  resetTournamentData(tournamentId: number): Promise<void>;

  // Board Overlay Settings
  getBoardOverlaySettings(tournamentId: number, boardNumber: number): Promise<BoardOverlaySettings | undefined>;
  upsertBoardOverlaySettings(tournamentId: number, boardNumber: number, settings: object): Promise<BoardOverlaySettings>;
  
  // Session Store
  sessionStore: session.Store;
}

function leaseOwner(lease: ScorerLease): ScorerLeaseOwner {
  return {
    boardSessionId: lease.boardSessionId,
    acquiredAt: lease.acquiredAt,
    lastActivityAt: lease.lastActivityAt,
    expiresAt: lease.expiresAt,
  };
}

function leaseIsExpired(lease: ScorerLease, now = new Date()): boolean {
  return lease.expiresAt.getTime() <= now.getTime();
}

function durableCurrentLeg(row: ScorerCurrentLeg): DurableCurrentLegState {
  return {
    matchId: row.matchId,
    scoringVersion: row.scoringVersion,
    remainingA: row.remainingA,
    remainingB: row.remainingB,
    currentThrower: row.currentThrower as "A" | "B",
    legStartingThrower: row.legStartingThrower as "A" | "B",
    visits: (Array.isArray(row.visits) ? row.visits : []) as ScorerVisit[],
    checkoutStats: {
      ...emptyScorerCheckoutStats(),
      ...((row.checkoutStats && typeof row.checkoutStats === "object") ? row.checkoutStats : {}),
    } as ScorerCheckoutStats,
    pendingCheckout: (row.pendingCheckout && typeof row.pendingCheckout === "object")
      ? row.pendingCheckout as ScorerPendingCheckout
      : null,
    swapPlayers: row.swapPlayers,
    updatedAt: row.updatedAt,
  };
}

function completedLegNotes(
  history: Array<{ visits?: ScorerVisit[] }>,
  checkoutStats: ScorerCheckoutStats,
): Partial<InsertMatchNote> {
  const visits = history.flatMap(leg => Array.isArray(leg?.visits) ? leg.visits : []);
  const visitsA = visits.filter(visit => visit.player === "A");
  const visitsB = visits.filter(visit => visit.player === "B");
  return {
    highestCheckout: Math.max(checkoutStats.finishA, checkoutStats.finishB) || null,
    numberOf180s: visits.filter(visit => visit.score === 180).length,
    totalVisitsA: visitsA.length,
    totalVisitsB: visitsB.length,
    totalScoredA: visitsA.reduce((sum, visit) => sum + visit.score, 0),
    totalScoredB: visitsB.reduce((sum, visit) => sum + visit.score, 0),
    highestVisitA: visitsA.length ? Math.max(...visitsA.map(visit => visit.score)) : 0,
    highestVisitB: visitsB.length ? Math.max(...visitsB.map(visit => visit.score)) : 0,
    highestFinishA: checkoutStats.finishA,
    highestFinishB: checkoutStats.finishB,
    ton80sA: visitsA.filter(visit => visit.score === 180).length,
    ton80sB: visitsB.filter(visit => visit.score === 180).length,
    ton40sA: visitsA.filter(visit => visit.score >= 140 && visit.score < 180).length,
    ton40sB: visitsB.filter(visit => visit.score >= 140 && visit.score < 180).length,
    tonsA: visitsA.filter(visit => visit.score >= 100 && visit.score < 140).length,
    tonsB: visitsB.filter(visit => visit.score >= 100 && visit.score < 140).length,
    checkoutAttemptsA: checkoutStats.attemptsA,
    checkoutAttemptsB: checkoutStats.attemptsB,
    checkoutSuccessA: checkoutStats.successA,
    checkoutSuccessB: checkoutStats.successB,
    first9PointsA: checkoutStats.first9PointsA,
    first9DartsA: checkoutStats.first9DartsA,
    first9PointsB: checkoutStats.first9PointsB,
    first9DartsB: checkoutStats.first9DartsB,
  };
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PgStore({
      pool: pool,
      tableName: 'user_sessions',
      createTableIfMissing: false,
      pruneSessionInterval: 60 * 15,
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<boolean> {
    const result = await db.update(users).set({ password: hashedPassword }).where(eq(users.email, email)).returning();
    return result.length > 0;
  }

  async updateUser(id: number, data: Partial<{ name: string; email: string; dateOfBirth: string | null; phone: string | null; billingAddress: string | null; memorableWord: string | null; recoveryKey: string | null }>): Promise<User> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async createUser(user: InsertUser & { recoveryKey?: string }): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Tournaments
  async getAllTournaments(): Promise<Tournament[]> {
    return await db.select().from(tournaments).orderBy(desc(tournaments.updatedAt));
  }

  async getTournamentsByUserId(userId: number): Promise<Tournament[]> {
    return await db.select().from(tournaments).where(eq(tournaments.userId, userId)).orderBy(desc(tournaments.updatedAt));
  }

  async getTournament(id: number): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament;
  }

  async getTournamentByShareToken(token: string): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(
      eq(tournaments.shareToken, token)
    );
    return tournament;
  }

  async createTournament(tournament: InsertTournament & { userId: number }): Promise<Tournament> {
    const [newTournament] = await db.insert(tournaments).values(tournament).returning();
    return newTournament;
  }

  async updateTournament(id: number, tournament: Partial<InsertTournament>): Promise<Tournament> {
    const [updated] = await db.update(tournaments).set({ ...tournament, updatedAt: new Date() }).where(eq(tournaments.id, id)).returning();
    return updated;
  }

  async deleteTournament(id: number): Promise<void> {
    await db.delete(tournaments).where(eq(tournaments.id, id));
  }

  // Players
  async getPlayersByTournamentId(tournamentId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.tournamentId, tournamentId)).orderBy(players.id);
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  async updatePlayer(id: number, data: { name: string }): Promise<Player> {
    const [updated] = await db.update(players).set({ name: data.name }).where(eq(players.id, id)).returning();
    return updated;
  }

  async deletePlayer(id: number): Promise<void> {
    await db.delete(groupMemberships).where(eq(groupMemberships.playerId, id));
    await db.delete(players).where(eq(players.id, id));
  }
  
  // Groups
  async getGroupsByTournamentId(tournamentId: number): Promise<Group[]> {
    return await db.select().from(groups).where(eq(groups.tournamentId, tournamentId));
  }
  
  async createGroup(group: InsertGroup): Promise<Group> {
    const [newGroup] = await db.insert(groups).values(group).returning();
    return newGroup;
  }
  
  // Group Memberships
  async createGroupMembership(membership: InsertGroupMembership): Promise<GroupMembership> {
    const [newMembership] = await db.insert(groupMemberships).values(membership).returning();
    return newMembership;
  }
  
  async deleteGroupMembershipsByPlayerId(playerId: number): Promise<void> {
    await db.delete(groupMemberships).where(eq(groupMemberships.playerId, playerId));
  }

  async deleteMatch(id: number): Promise<void> {
    await db.delete(matches).where(eq(matches.id, id));
  }

  async deleteGroupMatchesByTournamentId(tournamentId: number): Promise<void> {
    await db.delete(matches).where(
      and(eq(matches.tournamentId, tournamentId), eq(matches.stage, "GROUP"))
    );
  }

  async getGroupMembershipsByGroupId(groupId: number): Promise<(GroupMembership & { player: Player })[]> {
    const results = await db.select().from(groupMemberships)
      .innerJoin(players, eq(groupMemberships.playerId, players.id))
      .where(eq(groupMemberships.groupId, groupId));
      
    return results.map(r => ({ ...r.group_memberships, player: r.players }));
  }

  async getGroupMembershipsByTournamentId(tournamentId: number): Promise<GroupMembership[]> {
    const tournamentGroups = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId));
    if (tournamentGroups.length === 0) return [];
    const groupIds = tournamentGroups.map(g => g.id);
    const allMemberships = await db.select().from(groupMemberships);
    return allMemberships.filter(m => groupIds.includes(m.groupId));
  }

  // Matches
  async getMatchesByTournamentId(tournamentId: number): Promise<(Match & { playerA: Player | null, playerB: Player | null })[]> {
    // Drizzle doesn't support left join with alias easily in one go without raw sql or strict aliasing
    // For simplicity in MVP, we fetch matches and manually join or use simple joins if possible.
    // Let's use simple joins and handle nulls manually if needed, or just fetch matches and players separately in route if complex.
    // Actually, let's just query matches and we can join players.
    // Since playerA/B are nullable, we need left joins.
    /*
    const rows = await db.select({
      match: matches,
      playerA: players,
      playerB: players
    })
    .from(matches)
    .leftJoin(players, eq(matches.playerAId, players.id))
    // .leftJoin(players, eq(matches.playerBId, players.id)) // problem: duplicate table join needs alias
    */
   
    // Workaround: Fetch matches, then fetch players map.
    return await db.select().from(matches).where(eq(matches.tournamentId, tournamentId)).then(async (matchesList) => {
        // This is N+1 but acceptable for MVP with small tournament sizes (Max 48 players)
        const playersList = await db.select().from(players).where(eq(players.tournamentId, tournamentId));
        const playerMap = new Map(playersList.map(p => [p.id, p]));
        
        return matchesList.map(m => ({
            ...m,
            playerA: m.playerAId ? playerMap.get(m.playerAId) || null : null,
            playerB: m.playerBId ? playerMap.get(m.playerBId) || null : null,
        }));
    });
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db.insert(matches).values(match).returning();
    return newMatch;
  }

  async updateMatch(id: number, match: Partial<InsertMatch>): Promise<Match> {
    const authoritativeFields = [
      "playerAId",
      "playerBId",
      "scoreA",
      "scoreB",
      "bestOf",
      "status",
      "winnerId",
      "scoringVersion",
    ] as const;
    const changesAuthoritativeState = authoritativeFields.some(
      field => Object.prototype.hasOwnProperty.call(match, field),
    );
    const values = { ...match } as Record<string, unknown>;
    if (changesAuthoritativeState && !Object.prototype.hasOwnProperty.call(match, "scoringVersion")) {
      values.scoringVersion = sql`${matches.scoringVersion} + 1`;
    }
    return db.transaction(async (tx) => {
      const [updated] = await tx.update(matches).set(values as any).where(eq(matches.id, id)).returning();
      if (changesAuthoritativeState) {
        await tx.delete(scorerCurrentLegs).where(eq(scorerCurrentLegs.matchId, id));
      }
      return updated;
    });
  }
  
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }

  private async acquireScorerLeaseInTransaction(
    tx: any,
    input: AcquireScorerLeaseInput,
    match: Match,
  ): Promise<AcquireScorerLeaseResult> {
    if (match.tournamentId !== input.tournamentId) {
      throw new ScorerBoardAuthorizationError("Match does not belong to this tournament", "MATCH_TOURNAMENT_MISMATCH");
    }

    const [currentLease] = await tx
      .select()
      .from(scorerLeases)
      .where(eq(scorerLeases.matchId, input.matchId));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SCORER_LEASE_TTL_MS);

    if (currentLease && !leaseIsExpired(currentLease, now)) {
      if (currentLease.boardSessionId !== input.boardSessionId) {
        if (!input.takeover) {
          throw new ScorerLeaseConflictError(
            "This match is currently being scored on another device",
            "SCORER_LEASE_ACTIVE",
            leaseOwner(currentLease),
          );
        }

        const [takenOverLease] = await tx
          .update(scorerLeases)
          .set({
            tournamentId: input.tournamentId,
            boardNumber: input.boardNumber,
            boardSessionId: input.boardSessionId,
            acquiredAt: now,
            lastActivityAt: now,
            expiresAt,
          })
          .where(eq(scorerLeases.matchId, input.matchId))
          .returning();
        return {
          lease: takenOverLease,
          priorOwner: leaseOwner(currentLease),
          tookOver: true,
        };
      }

      const [renewedLease] = await tx
        .update(scorerLeases)
        .set({ lastActivityAt: now, expiresAt })
        .where(eq(scorerLeases.matchId, input.matchId))
        .returning();
      return { lease: renewedLease, tookOver: false };
    }

    const priorOwner = currentLease ? leaseOwner(currentLease) : undefined;
    const [lease] = await tx
      .insert(scorerLeases)
      .values({
        matchId: input.matchId,
        tournamentId: input.tournamentId,
        boardNumber: input.boardNumber,
        boardSessionId: input.boardSessionId,
        acquiredAt: now,
        lastActivityAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: scorerLeases.matchId,
        set: {
          tournamentId: input.tournamentId,
          boardNumber: input.boardNumber,
          boardSessionId: input.boardSessionId,
          acquiredAt: now,
          lastActivityAt: now,
          expiresAt,
        },
      })
      .returning();

    return {
      lease,
      priorOwner,
      tookOver: false,
    };
  }

  private async lockMatchInTransaction(tx: any, matchId: number): Promise<Match | undefined> {
    await tx.execute(sql`SELECT id FROM matches WHERE id = ${matchId} FOR UPDATE`);
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId));
    return match;
  }

  private async assertActiveScorerLeaseInTransaction(
    tx: any,
    matchId: number,
    boardSessionId: number,
  ): Promise<ScorerLease> {
    const [lease] = await tx
      .select()
      .from(scorerLeases)
      .where(eq(scorerLeases.matchId, matchId));
    if (!lease) {
      throw new ScorerLeaseConflictError(
        "This match has no active scorer lease",
        "SCORER_LEASE_MISSING",
      );
    }
    if (lease.boardSessionId !== boardSessionId) {
      throw new ScorerLeaseConflictError(
        "This scorer session no longer owns the match",
        "SCORER_LEASE_SESSION_MISMATCH",
        leaseOwner(lease),
      );
    }
    if (leaseIsExpired(lease)) {
      throw new ScorerLeaseConflictError(
        "This scorer lease has expired",
        "SCORER_LEASE_EXPIRED",
        leaseOwner(lease),
      );
    }

    const now = new Date();
    const [renewedLease] = await tx
      .update(scorerLeases)
      .set({
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + SCORER_LEASE_TTL_MS),
      })
      .where(eq(scorerLeases.matchId, matchId))
      .returning();
    return renewedLease;
  }

  async getScorerLease(matchId: number): Promise<ScorerLease | undefined> {
    const [lease] = await db.select().from(scorerLeases).where(eq(scorerLeases.matchId, matchId));
    return lease;
  }

  async acquireScorerLease(input: AcquireScorerLeaseInput): Promise<AcquireScorerLeaseResult> {
    return db.transaction(async (tx) => {
      const match = await this.lockMatchInTransaction(tx, input.matchId);
      if (!match) {
        throw new ScorerBoardAuthorizationError("Match not found", "MATCH_NOT_FOUND");
      }
      return this.acquireScorerLeaseInTransaction(tx, input, match);
    });
  }

  async takeoverScorerLease(
    input: Omit<AcquireScorerLeaseInput, "takeover">,
  ): Promise<AcquireScorerLeaseResult> {
    return this.acquireScorerLease({ ...input, takeover: true });
  }

  async heartbeatScorerLease(matchId: number, boardSessionId: number): Promise<ScorerLease> {
    return db.transaction(async (tx) => {
      const match = await this.lockMatchInTransaction(tx, matchId);
      if (!match) {
        throw new ScorerLeaseConflictError("Match not found", "SCORER_LEASE_MISSING");
      }
      return this.assertActiveScorerLeaseInTransaction(tx, matchId, boardSessionId);
    });
  }

  async assertActiveScorerLease(matchId: number, boardSessionId: number): Promise<ScorerLease> {
    return this.heartbeatScorerLease(matchId, boardSessionId);
  }

  async getCurrentLegState(matchId: number): Promise<DurableCurrentLegState | undefined> {
    const [row] = await db
      .select()
      .from(scorerCurrentLegs)
      .where(eq(scorerCurrentLegs.matchId, matchId));
    return row ? durableCurrentLeg(row) : undefined;
  }

  async persistCurrentLegStateWithLease(input: PersistCurrentLegInput): Promise<DurableCurrentLegState> {
    return db.transaction(async (tx) => {
      const match = await this.lockMatchInTransaction(tx, input.matchId);
      if (!match) {
        throw new ScoringValidationError("Match not found", "MATCH_NOT_FOUND");
      }
      await this.assertActiveScorerLeaseInTransaction(tx, input.matchId, input.boardSessionId);
      if (match.status !== "IN_PROGRESS") {
        throw new ScoringConflictError(
          "Match is no longer in progress",
          match,
          "MATCH_NOT_IN_PROGRESS",
        );
      }
      assertExpectedScoringVersion(match.scoringVersion, input.scoringVersion, match);

      const now = new Date();
      const [row] = await tx
        .insert(scorerCurrentLegs)
        .values({
          matchId: input.matchId,
          scoringVersion: input.scoringVersion,
          remainingA: input.remainingA,
          remainingB: input.remainingB,
          currentThrower: input.currentThrower,
          legStartingThrower: input.legStartingThrower,
          visits: input.visits,
          checkoutStats: input.checkoutStats,
          pendingCheckout: input.pendingCheckout,
          swapPlayers: input.swapPlayers,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: scorerCurrentLegs.matchId,
          set: {
            scoringVersion: input.scoringVersion,
            remainingA: input.remainingA,
            remainingB: input.remainingB,
            currentThrower: input.currentThrower,
            legStartingThrower: input.legStartingThrower,
            visits: input.visits,
            checkoutStats: input.checkoutStats,
            pendingCheckout: input.pendingCheckout,
            swapPlayers: input.swapPlayers,
            updatedAt: now,
          },
        })
        .returning();
      return durableCurrentLeg(row);
    });
  }

  async startMatchWithLease(input: {
    matchId: number;
    tournamentId: number;
    boardNumber: number;
    boardSessionId: number;
    authorizedMatchIds: number[];
    takeover?: boolean;
  }): Promise<AcquireScorerLeaseResult & { match: Match }> {
    return db.transaction(async (tx) => {
      // Serialize all starts that target the same tournament board, including
      // starts for different matches in that board's authorized set.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.tournamentId}, ${input.boardNumber})`);

      const authorizedMatchIds = Array.from(new Set(input.authorizedMatchIds));
      if (!authorizedMatchIds.includes(input.matchId)) {
        throw new ScorerBoardAuthorizationError();
      }

      const match = await this.lockMatchInTransaction(tx, input.matchId);
      if (!match) {
        throw new ScorerMatchStartConflictError("Match not found", "MATCH_NOT_FOUND");
      }
      if (match.tournamentId !== input.tournamentId) {
        throw new ScorerBoardAuthorizationError("Match does not belong to this tournament", "MATCH_TOURNAMENT_MISMATCH");
      }

      const boardMatches = await tx
        .select()
        .from(matches)
        .where(and(
          eq(matches.tournamentId, input.tournamentId),
          inArray(matches.id, authorizedMatchIds),
        ));
      const existingInProgress = boardMatches.find(
        candidate => candidate.status === "IN_PROGRESS" && candidate.id !== input.matchId,
      );
      if (existingInProgress) {
        throw new ScorerMatchStartConflictError(
          "Another match is already in progress on this board",
          "BOARD_MATCH_ALREADY_IN_PROGRESS",
          existingInProgress,
        );
      }
      if (match.status !== "PENDING") {
        throw new ScorerMatchStartConflictError(
          "Match is not in PENDING status",
          "MATCH_NOT_PENDING",
          match,
        );
      }

      const leaseResult = await this.acquireScorerLeaseInTransaction(tx, {
        matchId: input.matchId,
        tournamentId: input.tournamentId,
        boardNumber: input.boardNumber,
        boardSessionId: input.boardSessionId,
        takeover: input.takeover,
      }, match);

      await tx.delete(scorerCurrentLegs).where(eq(scorerCurrentLegs.matchId, input.matchId));

      const [updatedMatch] = await tx
        .update(matches)
        .set({
          status: "IN_PROGRESS",
          scoreA: 0,
          scoreB: 0,
          scoringVersion: sql`${matches.scoringVersion} + 1`,
        })
        .where(and(eq(matches.id, input.matchId), eq(matches.status, "PENDING")))
        .returning();
      if (!updatedMatch) {
        throw new ScorerMatchStartConflictError(
          "Match is not in PENDING status",
          "MATCH_NOT_PENDING",
          match,
        );
      }

      return { ...leaseResult, match: updatedMatch };
    });
  }

  async restartMatchWithLease(input: {
    matchId: number;
    tournamentId: number;
    boardNumber: number;
    boardSessionId: number;
    authorizedMatchIds: number[];
  }): Promise<{ match: Match; priorOwner: ScorerLeaseOwner }> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.tournamentId}, ${input.boardNumber})`);
      if (!new Set(input.authorizedMatchIds).has(input.matchId)) {
        throw new ScorerBoardAuthorizationError();
      }

      const match = await this.lockMatchInTransaction(tx, input.matchId);
      if (!match) {
        throw new ScorerMatchStartConflictError("Match not found", "MATCH_NOT_FOUND");
      }
      if (match.tournamentId !== input.tournamentId) {
        throw new ScorerBoardAuthorizationError("Match does not belong to this tournament", "MATCH_TOURNAMENT_MISMATCH");
      }
      if (match.status !== "IN_PROGRESS") {
        throw new ScorerMatchStartConflictError(
          "Only IN_PROGRESS matches can be restarted",
          "MATCH_NOT_IN_PROGRESS",
          match,
        );
      }

      const lease = await this.assertActiveScorerLeaseInTransaction(
        tx,
        input.matchId,
        input.boardSessionId,
      );
      const [updatedMatch] = await tx
        .update(matches)
        .set({
          status: "PENDING",
          scoreA: 0,
          scoreB: 0,
          winnerId: null,
          scoringVersion: sql`${matches.scoringVersion} + 1`,
        })
        .where(eq(matches.id, input.matchId))
        .returning();
      await tx.delete(scorerLeases).where(eq(scorerLeases.matchId, input.matchId));
      await tx.delete(scorerCurrentLegs).where(eq(scorerCurrentLegs.matchId, input.matchId));
      return { match: updatedMatch, priorOwner: leaseOwner(lease) };
    });
  }
  
  // Match Notes
  async getMatchNote(matchId: number): Promise<MatchNote | undefined> {
    const [note] = await db.select().from(matchNotes).where(eq(matchNotes.matchId, matchId));
    return note;
  }

  async getMatchNotesByMatchIds(matchIds: number[]): Promise<MatchNote[]> {
    if (matchIds.length === 0) return [];
    return await db.select().from(matchNotes).where(inArray(matchNotes.matchId, matchIds));
  }

  async createMatchNote(note: InsertMatchNote): Promise<MatchNote> {
    const [newNote] = await db.insert(matchNotes).values(note).returning();
    return newNote;
  }
  
  async updateMatchNote(matchId: number, note: Partial<InsertMatchNote>): Promise<MatchNote> {
    // Upsert logic
    const existing = await this.getMatchNote(matchId);
    if (existing) {
        const [updated] = await db.update(matchNotes).set(note).where(eq(matchNotes.matchId, matchId)).returning();
        return updated;
    } else {
        return this.createMatchNote({ ...note, matchId } as InsertMatchNote);
    }
  }

  async submitCompletedLeg(input: {
    matchId: number;
    expectedVersion: number;
    submissionId: string;
    scoreA: number;
    scoreB: number;
    completedLeg: unknown;
    notes: Partial<InsertMatchNote>;
    boardSessionId?: number;
    checkout?: { dartsAtDouble: number; checkoutDartsUsed: number };
  }): Promise<{ match: Match; replayed: boolean; sideEffectsCompleted: boolean }> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM matches WHERE id = ${input.matchId} FOR UPDATE`);

      const [current] = await tx.select().from(matches).where(eq(matches.id, input.matchId));
      if (!current) {
        throw new ScoringValidationError("Match not found", "MATCH_NOT_FOUND");
      }

      // The match row is already locked above.  Validate and renew ownership
      // before even considering an idempotent replay so a displaced/stale
      // scorer cannot replay or submit authoritative work after takeover.
      if (input.boardSessionId !== undefined) {
        await this.assertActiveScorerLeaseInTransaction(
          tx,
          input.matchId,
          input.boardSessionId,
        );
      }

      const [existingSubmission] = await tx
        .select()
        .from(matchLegSubmissions)
        .where(and(
          eq(matchLegSubmissions.matchId, input.matchId),
          eq(matchLegSubmissions.submissionId, input.submissionId),
        ));

      const requestPayload = {
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        expectedVersion: input.expectedVersion,
        completedLeg: input.completedLeg,
        notes: input.notes,
      };

      if (existingSubmission) {
        assertIdempotentReplayMatches(existingSubmission.requestPayload, requestPayload, current);
        const replayStatus = existingSubmission.resultingStatus
          ?? (existingSubmission.resultingScoreA >= Math.ceil(current.bestOf / 2)
            || existingSubmission.resultingScoreB >= Math.ceil(current.bestOf / 2)
            ? "COMPLETED"
            : "IN_PROGRESS");
        const replayWinnerId = existingSubmission.resultingWinnerId
          ?? (replayStatus === "COMPLETED"
            ? (existingSubmission.resultingScoreA > existingSubmission.resultingScoreB
              ? current.playerAId
              : current.playerBId)
            : null);
        return {
          match: {
            ...current,
            scoreA: existingSubmission.resultingScoreA,
            scoreB: existingSubmission.resultingScoreB,
            status: replayStatus,
            winnerId: replayWinnerId,
            scoringVersion: existingSubmission.resultingVersion,
          },
          replayed: true,
          sideEffectsCompleted: existingSubmission.sideEffectsCompleted,
        };
      }

      if (current.status !== "IN_PROGRESS") {
        throw new ScoringConflictError(
          "Match is no longer in progress",
          current,
          "MATCH_NOT_IN_PROGRESS",
        );
      }
      assertExpectedScoringVersion(current.scoringVersion, input.expectedVersion, current);

      try {
        validateOneLegAdvance(
          current.scoreA ?? 0,
          current.scoreB ?? 0,
          input.scoreA,
          input.scoreB,
          current.bestOf,
        );
      } catch (error) {
        if (error instanceof ScoringConflictError) {
          throw new ScoringConflictError(error.message, current, error.code);
        }
        throw error;
      }

      let authoritativeCompletedLeg = input.completedLeg as {
        startingThrower: "A" | "B";
        visits: ScorerVisit[];
        winner: "A" | "B";
        checkoutDartsUsed?: number;
      };
      let nextCheckoutStats: ScorerCheckoutStats | undefined;
      let authoritativeCurrentLeg: DurableCurrentLegState | undefined;

      if (input.boardSessionId !== undefined) {
        const [currentLegRow] = await tx
          .select()
          .from(scorerCurrentLegs)
          .where(eq(scorerCurrentLegs.matchId, input.matchId));
        if (!currentLegRow) {
          throw new ScoringConflictError(
            "The unfinished leg is not available on the server",
            current,
            "CURRENT_LEG_STATE_MISSING",
          );
        }
        authoritativeCurrentLeg = durableCurrentLeg(currentLegRow);
        if (authoritativeCurrentLeg.scoringVersion !== current.scoringVersion) {
          throw new ScoringConflictError(
            "The unfinished leg belongs to an older match version",
            current,
            "STALE_CURRENT_LEG_STATE",
          );
        }
        const winner = authoritativeCurrentLeg.remainingA === 0 && authoritativeCurrentLeg.remainingB > 0
          ? "A"
          : authoritativeCurrentLeg.remainingB === 0 && authoritativeCurrentLeg.remainingA > 0
            ? "B"
            : null;
        if (!winner || !authoritativeCurrentLeg.pendingCheckout || !input.checkout) {
          throw new ScoringValidationError(
            "The authoritative unfinished leg is not ready for checkout confirmation",
            "CURRENT_LEG_NOT_COMPLETE",
          );
        }
        const submittedLeg = input.completedLeg as {
          startingThrower?: "A" | "B";
          visits?: ScorerVisit[];
          winner?: "A" | "B";
          checkoutDartsUsed?: number;
        };
        if (
          submittedLeg.startingThrower !== authoritativeCurrentLeg.legStartingThrower
          || submittedLeg.winner !== winner
          || canonicalJson(submittedLeg.visits) !== canonicalJson(authoritativeCurrentLeg.visits)
          || submittedLeg.checkoutDartsUsed !== input.checkout.checkoutDartsUsed
        ) {
          throw new ScoringConflictError(
            "Completed leg does not match the authoritative unfinished leg",
            current,
            "CURRENT_LEG_STATE_MISMATCH",
          );
        }
        if (
          authoritativeCurrentLeg.pendingCheckout.player !== winner
          || authoritativeCurrentLeg.pendingCheckout.newLegsA !== input.scoreA
          || authoritativeCurrentLeg.pendingCheckout.newLegsB !== input.scoreB
        ) {
          throw new ScoringConflictError(
            "Checkout state does not match the requested score transition",
            current,
            "CURRENT_LEG_STATE_MISMATCH",
          );
        }

        authoritativeCompletedLeg = {
          startingThrower: authoritativeCurrentLeg.legStartingThrower,
          visits: authoritativeCurrentLeg.visits,
          winner,
          checkoutDartsUsed: input.checkout.checkoutDartsUsed,
        };
        nextCheckoutStats = { ...authoritativeCurrentLeg.checkoutStats };
        const playerKey = winner === "A" ? "A" : "B";
        if (playerKey === "A") {
          nextCheckoutStats.attemptsA += input.checkout.dartsAtDouble;
          nextCheckoutStats.successA += 1;
          nextCheckoutStats.finishA = Math.max(
            nextCheckoutStats.finishA,
            authoritativeCurrentLeg.pendingCheckout.checkoutScore,
          );
          nextCheckoutStats.totalCheckoutDartsUsedA += input.checkout.checkoutDartsUsed;
        } else {
          nextCheckoutStats.attemptsB += input.checkout.dartsAtDouble;
          nextCheckoutStats.successB += 1;
          nextCheckoutStats.finishB = Math.max(
            nextCheckoutStats.finishB,
            authoritativeCurrentLeg.pendingCheckout.checkoutScore,
          );
          nextCheckoutStats.totalCheckoutDartsUsedB += input.checkout.checkoutDartsUsed;
        }
        const first9A = authoritativeCurrentLeg.visits.filter(visit => visit.player === "A").slice(0, 3);
        const first9B = authoritativeCurrentLeg.visits.filter(visit => visit.player === "B").slice(0, 3);
        nextCheckoutStats.first9PointsA += first9A.reduce((sum, visit) => sum + visit.score, 0);
        nextCheckoutStats.first9DartsA += first9A.length * 3;
        nextCheckoutStats.first9PointsB += first9B.reduce((sum, visit) => sum + visit.score, 0);
        nextCheckoutStats.first9DartsB += first9B.length * 3;
      }

      const [existingNote] = await tx
        .select()
        .from(matchNotes)
        .where(eq(matchNotes.matchId, input.matchId));
      const existingHistory = Array.isArray(existingNote?.legHistory)
        ? existingNote.legHistory
        : [];
      assertLegHistoryMatchesScore(
        existingHistory,
        current.scoreA ?? 0,
        current.scoreB ?? 0,
        current,
      );
      assertCompletedLegMatchesTransition(
        current.scoreA ?? 0,
        current.scoreB ?? 0,
        input.scoreA,
        input.scoreB,
        authoritativeCompletedLeg.winner,
      );
      const nextHistory = [...existingHistory, authoritativeCompletedLeg];

      const legsToWin = Math.ceil(current.bestOf / 2);
      const isFinished = input.scoreA >= legsToWin || input.scoreB >= legsToWin;
      const winnerId = isFinished
        ? (input.scoreA > input.scoreB ? current.playerAId : current.playerBId)
        : null;
      const nextVersion = current.scoringVersion + 1;

      const noteValues = input.boardSessionId !== undefined && nextCheckoutStats
        ? { ...completedLegNotes(nextHistory, nextCheckoutStats), legHistory: nextHistory }
        : { ...input.notes, legHistory: nextHistory };
      await tx
        .insert(matchNotes)
        .values({ ...noteValues, matchId: input.matchId } as InsertMatchNote)
        .onConflictDoUpdate({
          target: matchNotes.matchId,
          set: noteValues,
        });

      const [updatedMatch] = await tx
        .update(matches)
        .set({
          scoreA: input.scoreA,
          scoreB: input.scoreB,
          winnerId,
          status: isFinished ? "COMPLETED" : "IN_PROGRESS",
          scoringVersion: nextVersion,
        })
        .where(and(
          eq(matches.id, input.matchId),
          eq(matches.scoringVersion, input.expectedVersion),
        ))
        .returning();

      if (!updatedMatch) {
        throw new ScoringConflictError(
          "The match was updated by another request",
          current,
          "STALE_SCORING_VERSION",
        );
      }

      await tx.insert(matchLegSubmissions).values({
        matchId: input.matchId,
        submissionId: input.submissionId,
        expectedVersion: input.expectedVersion,
        resultingVersion: nextVersion,
        resultingScoreA: input.scoreA,
        resultingScoreB: input.scoreB,
        resultingStatus: updatedMatch.status,
        resultingWinnerId: updatedMatch.winnerId,
        requestPayload,
      });

      if (
        input.boardSessionId !== undefined
        && authoritativeCurrentLeg
        && nextCheckoutStats
        && !isFinished
      ) {
        const nextStarter = authoritativeCurrentLeg.legStartingThrower === "A" ? "B" : "A";
        await tx
          .insert(scorerCurrentLegs)
          .values({
            matchId: input.matchId,
            scoringVersion: nextVersion,
            remainingA: 501,
            remainingB: 501,
            currentThrower: nextStarter,
            legStartingThrower: nextStarter,
            visits: [],
            checkoutStats: nextCheckoutStats,
            pendingCheckout: null,
            swapPlayers: authoritativeCurrentLeg.swapPlayers,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: scorerCurrentLegs.matchId,
            set: {
              scoringVersion: nextVersion,
              remainingA: 501,
              remainingB: 501,
              currentThrower: nextStarter,
              legStartingThrower: nextStarter,
              visits: [],
              checkoutStats: nextCheckoutStats,
              pendingCheckout: null,
              swapPlayers: authoritativeCurrentLeg.swapPlayers,
              updatedAt: new Date(),
            },
          });
      } else {
        await tx.delete(scorerCurrentLegs).where(eq(scorerCurrentLegs.matchId, input.matchId));
      }

      return { match: updatedMatch, replayed: false, sideEffectsCompleted: false };
    });
  }

  async submitCompletedLegWithLease(input: {
    matchId: number;
    expectedVersion: number;
    submissionId: string;
    scoreA: number;
    scoreB: number;
    completedLeg: unknown;
    notes: Partial<InsertMatchNote>;
    boardSessionId: number;
    checkout: { dartsAtDouble: number; checkoutDartsUsed: number };
  }): Promise<{ match: Match; replayed: boolean; sideEffectsCompleted: boolean }> {
    return this.submitCompletedLeg(input);
  }

  async markCompletedLegSideEffectsComplete(matchId: number, submissionId: string): Promise<void> {
    await db
      .update(matchLegSubmissions)
      .set({ sideEffectsCompleted: true })
      .where(and(
        eq(matchLegSubmissions.matchId, matchId),
        eq(matchLegSubmissions.submissionId, submissionId),
      ));
  }

  // Board Sessions
  async createBoardSession(bs: InsertBoardSession): Promise<BoardSession> {
    const [newSession] = await db.insert(boardSessions).values(bs).returning();
    return newSession;
  }

  async getBoardSessionByToken(pairingToken: string): Promise<BoardSession | undefined> {
    const [bs] = await db.select().from(boardSessions).where(eq(boardSessions.pairingToken, pairingToken));
    return bs;
  }

  async getBoardSessionByAccessToken(accessToken: string): Promise<BoardSession | undefined> {
    const [bs] = await db.select().from(boardSessions).where(eq(boardSessions.accessToken, accessToken));
    return bs;
  }

  async markBoardSessionPaired(id: number, accessToken: string): Promise<BoardSession> {
    const [updated] = await db.update(boardSessions).set({ accessToken, pairedAt: new Date() }).where(eq(boardSessions.id, id)).returning();
    return updated;
  }

  async getBoardSessionsByTournamentId(tournamentId: number): Promise<BoardSession[]> {
    return await db.select().from(boardSessions).where(eq(boardSessions.tournamentId, tournamentId));
  }

  async deleteBoardSession(id: number): Promise<void> {
    await db.delete(boardSessions).where(eq(boardSessions.id, id));
  }

  // Leagues
  async getLeaguesByUserId(userId: number): Promise<League[]> {
    return await db.select().from(leagues).where(eq(leagues.userId, userId)).orderBy(desc(leagues.createdAt));
  }

  async getLeague(id: number): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
    return league;
  }

  async createLeague(league: InsertLeague): Promise<League> {
    const [newLeague] = await db.insert(leagues).values(league).returning();
    return newLeague;
  }

  async updateLeague(id: number, data: Partial<InsertLeague>): Promise<League> {
    const [updated] = await db.update(leagues).set(data).where(eq(leagues.id, id)).returning();
    return updated;
  }

  async deleteLeague(id: number): Promise<void> {
    await db.update(tournaments).set({ leagueId: null }).where(eq(tournaments.leagueId, id));
    await db.delete(leagues).where(eq(leagues.id, id));
  }

  async getTournamentsByLeagueId(leagueId: number): Promise<Tournament[]> {
    return await db.select().from(tournaments).where(eq(tournaments.leagueId, leagueId)).orderBy(desc(tournaments.createdAt));
  }

  async getLeagueByShareToken(token: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.shareToken, token));
    return league;
  }

  async getLeagueManualResults(leagueId: number): Promise<LeagueManualResult[]> {
    return await db.select().from(leagueManualResults).where(eq(leagueManualResults.leagueId, leagueId)).orderBy(desc(leagueManualResults.createdAt));
  }

  async createLeagueManualResult(result: InsertLeagueManualResult): Promise<LeagueManualResult> {
    const [newResult] = await db.insert(leagueManualResults).values(result).returning();
    return newResult;
  }

  async deleteLeagueManualResult(id: number): Promise<void> {
    await db.delete(leagueManualResults).where(eq(leagueManualResults.id, id));
  }

  async createBetaFeedback(feedback: InsertBetaFeedback): Promise<BetaFeedback> {
    const [newFeedback] = await db.insert(betaFeedback).values(feedback).returning();
    return newFeedback;
  }

  async getAllBetaFeedback(): Promise<(BetaFeedback & { userName: string | null; userEmail: string | null })[]> {
    const rows = await db
      .select({
        id: betaFeedback.id,
        userId: betaFeedback.userId,
        category: betaFeedback.category,
        message: betaFeedback.message,
        page: betaFeedback.page,
        status: betaFeedback.status,
        severity: betaFeedback.severity,
        adminNote: betaFeedback.adminNote,
        createdAt: betaFeedback.createdAt,
        updatedAt: betaFeedback.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(betaFeedback)
      .leftJoin(users, eq(betaFeedback.userId, users.id))
      .orderBy(desc(betaFeedback.createdAt));
    return rows;
  }

  async updateFeedback(id: number, data: { status?: string; severity?: string | null; adminNote?: string | null }): Promise<BetaFeedback> {
    const [updated] = await db
      .update(betaFeedback)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(betaFeedback.id, id))
      .returning();
    return updated;
  }

  async createFeedbackNotification(data: { feedbackId: number; userId: number; notificationType: string; customMessage?: string | null }): Promise<FeedbackNotification> {
    const [notif] = await db.insert(feedbackNotifications).values({
      feedbackId: data.feedbackId,
      userId: data.userId,
      notificationType: data.notificationType,
      customMessage: data.customMessage ?? null,
    }).returning();
    return notif;
  }

  async getUserNotifications(userId: number): Promise<(FeedbackNotification & { feedbackMessage: string; feedbackCategory: string })[]> {
    const rows = await db
      .select({
        id: feedbackNotifications.id,
        feedbackId: feedbackNotifications.feedbackId,
        userId: feedbackNotifications.userId,
        notificationType: feedbackNotifications.notificationType,
        customMessage: feedbackNotifications.customMessage,
        isRead: feedbackNotifications.isRead,
        createdAt: feedbackNotifications.createdAt,
        feedbackMessage: betaFeedback.message,
        feedbackCategory: betaFeedback.category,
      })
      .from(feedbackNotifications)
      .leftJoin(betaFeedback, eq(feedbackNotifications.feedbackId, betaFeedback.id))
      .where(eq(feedbackNotifications.userId, userId))
      .orderBy(desc(feedbackNotifications.createdAt));
    return rows as any;
  }

  async markNotificationRead(id: number, userId: number): Promise<void> {
    await db
      .update(feedbackNotifications)
      .set({ isRead: true })
      .where(and(eq(feedbackNotifications.id, id), eq(feedbackNotifications.userId, userId)));
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db
      .update(feedbackNotifications)
      .set({ isRead: true })
      .where(eq(feedbackNotifications.userId, userId));
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalTournaments: number;
    tournamentsByStatus: Record<string, number>;
    totalMatches: number;
    totalFeedback: number;
    feedbackByCategory: Record<string, number>;
    recentSignups: number;
    recentTournaments: number;
  }> {
    const allUsers = await db.select({ id: users.id, createdAt: users.createdAt }).from(users);
    const allTournaments = await db.select({ id: tournaments.id, status: tournaments.status, createdAt: tournaments.createdAt }).from(tournaments);
    const matchCount = await db.select({ id: matches.id }).from(matches);
    const allFeedback = await db.select({ id: betaFeedback.id, category: betaFeedback.category }).from(betaFeedback);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const tournamentsByStatus: Record<string, number> = {};
    for (const t of allTournaments) {
      tournamentsByStatus[t.status] = (tournamentsByStatus[t.status] || 0) + 1;
    }

    const feedbackByCategory: Record<string, number> = {};
    for (const f of allFeedback) {
      feedbackByCategory[f.category] = (feedbackByCategory[f.category] || 0) + 1;
    }

    return {
      totalUsers: allUsers.length,
      totalTournaments: allTournaments.length,
      tournamentsByStatus,
      totalMatches: matchCount.length,
      totalFeedback: allFeedback.length,
      feedbackByCategory,
      recentSignups: allUsers.filter(u => u.createdAt && u.createdAt >= sevenDaysAgo).length,
      recentTournaments: allTournaments.filter(t => t.createdAt && t.createdAt >= sevenDaysAgo).length,
    };
  }

  async getAllUsersAdmin(): Promise<Array<{ id: number; name: string; email: string; createdAt: Date | null; isSuperUser: boolean; isLocked: boolean; deletedAt: Date | null }>> {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      isSuperUser: users.isSuperUser,
      isLocked: users.isLocked,
      deletedAt: users.deletedAt,
    }).from(users).orderBy(desc(users.createdAt));
    return allUsers.map(u => ({ ...u, isSuperUser: u.isSuperUser ?? false, isLocked: u.isLocked ?? false, deletedAt: u.deletedAt ?? null }));
  }

  async lockUser(id: number, locked: boolean): Promise<void> {
    await db.update(users).set({ isLocked: locked }).where(eq(users.id, id));
  }

  async softDeleteUser(id: number): Promise<void> {
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
  }

  async getAdminSetting(key: string): Promise<AdminSetting | undefined> {
    const [row] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
    return row;
  }

  async setAdminSetting(key: string, value: string | null, enabled: boolean, updatedBy: number): Promise<void> {
    const existing = await this.getAdminSetting(key);
    if (existing) {
      await db.update(adminSettings).set({ value, enabled, updatedBy, updatedAt: new Date() }).where(eq(adminSettings.key, key));
    } else {
      await db.insert(adminSettings).values({ key, value, enabled, updatedBy });
    }
  }

  async appendAdminLog(entry: { adminId?: number; adminEmail?: string; targetEmail?: string; action: string; detail?: string }): Promise<void> {
    await db.insert(adminLogs).values({
      adminId: entry.adminId ?? null,
      adminEmail: entry.adminEmail ?? null,
      targetEmail: entry.targetEmail ?? null,
      action: entry.action,
      detail: entry.detail ?? null,
    });
  }

  async getAdminLogs(limit = 200): Promise<AdminLog[]> {
    return await db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit);
  }

  async getLiveTournaments(): Promise<Tournament[]> {
    return await db.select().from(tournaments).where(eq(tournaments.status, 'IN_PROGRESS'));
  }

  async resetTournamentData(tournamentId: number): Promise<void> {
    await db.delete(boardSessions).where(eq(boardSessions.tournamentId, tournamentId));
    await db.delete(matches).where(eq(matches.tournamentId, tournamentId));
    await db.delete(groups).where(eq(groups.tournamentId, tournamentId));
  }

  async getCollaboratorCountsForTournaments(tournamentIds: number[]): Promise<Record<number, number>> {
    if (tournamentIds.length === 0) return {};
    const rows = await db
      .select({ tournamentId: tournamentCollaborators.tournamentId })
      .from(tournamentCollaborators)
      .where(inArray(tournamentCollaborators.tournamentId, tournamentIds));
    const counts: Record<number, number> = {};
    for (const row of rows) {
      counts[row.tournamentId] = (counts[row.tournamentId] || 0) + 1;
    }
    return counts;
  }

  async getOwnerNamesForTournaments(tournamentIds: number[], ownerIds: number[]): Promise<Record<number, string>> {
    if (ownerIds.length === 0) return {};
    const uniqueOwnerIds = [...new Set(ownerIds)];
    const rows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, uniqueOwnerIds));
    const map: Record<number, string> = {};
    for (const row of rows) {
      map[row.id] = row.name;
    }
    return map;
  }

  async getTournamentCollaborators(tournamentId: number): Promise<Array<TournamentCollaborator & { name: string; email: string }>> {
    const rows = await db
      .select({
        id: tournamentCollaborators.id,
        tournamentId: tournamentCollaborators.tournamentId,
        userId: tournamentCollaborators.userId,
        invitedByUserId: tournamentCollaborators.invitedByUserId,
        createdAt: tournamentCollaborators.createdAt,
        name: users.name,
        email: users.email,
      })
      .from(tournamentCollaborators)
      .innerJoin(users, eq(tournamentCollaborators.userId, users.id))
      .where(eq(tournamentCollaborators.tournamentId, tournamentId));
    return rows;
  }

  async addTournamentCollaborator(tournamentId: number, userId: number, invitedByUserId: number): Promise<TournamentCollaborator> {
    const [row] = await db
      .insert(tournamentCollaborators)
      .values({ tournamentId, userId, invitedByUserId })
      .returning();
    return row;
  }

  async removeTournamentCollaborator(tournamentId: number, userId: number): Promise<void> {
    await db
      .delete(tournamentCollaborators)
      .where(and(eq(tournamentCollaborators.tournamentId, tournamentId), eq(tournamentCollaborators.userId, userId)));
  }

  async isTournamentCollaborator(tournamentId: number, userId: number): Promise<boolean> {
    const [row] = await db
      .select({ id: tournamentCollaborators.id })
      .from(tournamentCollaborators)
      .where(and(eq(tournamentCollaborators.tournamentId, tournamentId), eq(tournamentCollaborators.userId, userId)));
    return !!row;
  }

  async getCollaboratedTournamentsByUserId(userId: number): Promise<Tournament[]> {
    const rows = await db
      .select({ tournament: tournaments })
      .from(tournamentCollaborators)
      .innerJoin(tournaments, eq(tournamentCollaborators.tournamentId, tournaments.id))
      .where(eq(tournamentCollaborators.userId, userId))
      .orderBy(desc(tournaments.updatedAt));
    return rows.map(r => r.tournament);
  }

  async getBoardOverlaySettings(tournamentId: number, boardNumber: number): Promise<BoardOverlaySettings | undefined> {
    const [row] = await db
      .select()
      .from(boardOverlaySettings)
      .where(and(eq(boardOverlaySettings.tournamentId, tournamentId), eq(boardOverlaySettings.boardNumber, boardNumber)));
    return row;
  }

  async upsertBoardOverlaySettings(tournamentId: number, boardNumber: number, settings: object): Promise<BoardOverlaySettings> {
    const existing = await this.getBoardOverlaySettings(tournamentId, boardNumber);
    if (existing) {
      const [updated] = await db
        .update(boardOverlaySettings)
        .set({ settings, updatedAt: new Date() })
        .where(and(eq(boardOverlaySettings.tournamentId, tournamentId), eq(boardOverlaySettings.boardNumber, boardNumber)))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(boardOverlaySettings)
        .values({ tournamentId, boardNumber, settings })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
