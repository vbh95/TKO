import { users, tournaments, players, groups, groupMemberships, matches, matchNotes } from "@shared/schema";
import type { 
  User, InsertUser, 
  Tournament, InsertTournament, 
  Player, InsertPlayer,
  Group, InsertGroup,
  GroupMembership, InsertGroupMembership,
  Match, InsertMatch,
  MatchNote, InsertMatchNote
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>; // username maps to email
  updateUserPassword(email: string, hashedPassword: string): Promise<boolean>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tournaments
  getTournamentsByUserId(userId: number): Promise<Tournament[]>;
  getTournament(id: number): Promise<Tournament | undefined>;
  getTournamentByShareToken(token: string): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: number, tournament: Partial<InsertTournament>): Promise<Tournament>;
  deleteTournament(id: number): Promise<void>;
  
  // Players
  getPlayersByTournamentId(tournamentId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  
  // Groups
  getGroupsByTournamentId(tournamentId: number): Promise<Group[]>;
  createGroup(group: InsertGroup): Promise<Group>;
  
  // Group Memberships
  createGroupMembership(membership: InsertGroupMembership): Promise<GroupMembership>;
  getGroupMembershipsByGroupId(groupId: number): Promise<(GroupMembership & { player: Player })[]>;
  getGroupMembershipsByTournamentId(tournamentId: number): Promise<GroupMembership[]>;
  
  // Matches
  getMatchesByTournamentId(tournamentId: number): Promise<(Match & { playerA: Player | null, playerB: Player | null })[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, match: Partial<InsertMatch>): Promise<Match>;
  getMatch(id: number): Promise<Match | undefined>;
  
  // Match Notes
  getMatchNote(matchId: number): Promise<MatchNote | undefined>;
  createMatchNote(note: InsertMatchNote): Promise<MatchNote>;
  updateMatchNote(matchId: number, note: Partial<InsertMatchNote>): Promise<MatchNote>;
  
  // Session Store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
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

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Tournaments
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

  async createTournament(tournament: InsertTournament): Promise<Tournament> {
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
    return await db.select().from(players).where(eq(players.tournamentId, tournamentId));
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
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
}

export const storage = new DatabaseStorage();
