import { users, tournaments, tournamentCollaborators, players, groups, groupMemberships, matches, matchNotes, boardSessions, leagues, leagueManualResults, betaFeedback, feedbackNotifications } from "@shared/schema";
import { desc } from "drizzle-orm";
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
  League, InsertLeague,
  LeagueManualResult, InsertLeagueManualResult,
  BetaFeedback, InsertBetaFeedback,
  FeedbackNotification
} from "@shared/schema";
import { db } from "./db";
import { pool } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

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
  
  // Match Notes
  getMatchNote(matchId: number): Promise<MatchNote | undefined>;
  createMatchNote(note: InsertMatchNote): Promise<MatchNote>;
  updateMatchNote(matchId: number, note: Partial<InsertMatchNote>): Promise<MatchNote>;
  
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
  getAllUsersAdmin(): Promise<Array<{ id: number; name: string; email: string; createdAt: Date | null; isSuperUser: boolean }>>;
  getLiveTournaments(): Promise<Tournament[]>;

  // Reset
  resetTournamentData(tournamentId: number): Promise<void>;
  
  // Session Store
  sessionStore: session.Store;
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
      and(eq(tournaments.shareToken, token), eq(tournaments.shareEnabled, true))
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
    const [updated] = await db.update(matches).set(match).where(eq(matches.id, id)).returning();
    return updated;
  }
  
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }
  
  // Match Notes
  async getMatchNote(matchId: number): Promise<MatchNote | undefined> {
    const [note] = await db.select().from(matchNotes).where(eq(matchNotes.matchId, matchId));
    return note;
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

  async getAllUsersAdmin(): Promise<Array<{ id: number; name: string; email: string; createdAt: Date | null; isSuperUser: boolean }>> {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      isSuperUser: users.isSuperUser,
    }).from(users).orderBy(desc(users.createdAt));
    return allUsers.map(u => ({ ...u, isSuperUser: u.isSuperUser ?? false }));
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
}

export const storage = new DatabaseStorage();
