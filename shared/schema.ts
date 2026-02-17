import { pgTable, text, serial, integer, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === USERS ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth"),
  phone: text("phone"),
  billingAddress: text("billing_address"),
  memorableWord: text("memorable_word"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, memorableWord: true });

// === LEAGUES ===
export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeagueSchema = createInsertSchema(leagues).omit({ id: true, createdAt: true });

// === TOURNAMENTS ===
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  leagueId: integer("league_id").references(() => leagues.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'ROUND_ROBIN' | 'KNOCKOUT' | 'DOUBLE_ELIMINATION' | 'MULTI_STAGE'
  status: text("status").notNull().default("NOT_STARTED"), // 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  settings: jsonb("settings").notNull(), // Stores structural settings, points system, etc.
  shareEnabled: boolean("share_enabled").default(false),
  shareToken: text("share_token"),
  shareTokenCreatedAt: timestamp("share_token_created_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTournamentSchema = createInsertSchema(tournaments).omit({ 
  id: true, 
  userId: true, 
  shareToken: true, 
  shareTokenCreatedAt: true, 
  createdAt: true, 
  updatedAt: true 
});

// === PLAYERS ===
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  seed: integer("seed"), // Optional seeding order
});

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });

// === GROUPS ===
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Group A", "Group B", etc.
});

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true });

// === GROUP MEMBERSHIP ===
export const groupMemberships = pgTable("group_memberships", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
});

export const insertGroupMembershipSchema = createInsertSchema(groupMemberships).omit({ id: true });

// === MATCHES ===
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(), // 'GROUP' | 'KNOCKOUT' | 'WINNERS_BRACKET' | 'LOSERS_BRACKET' | 'GRAND_FINAL'
  roundKey: text("round_key").notNull(), // 'group', 'R32', 'R16', 'QF', 'SF', 'F', 'WB_R1', 'LB_R1', etc.
  groupId: integer("group_id").references(() => groups.id, { onDelete: "cascade" }), // Nullable for knockout matches
  
  playerAId: integer("player_a_id").references(() => players.id, { onDelete: "set null" }), // Nullable (TBD)
  playerBId: integer("player_b_id").references(() => players.id, { onDelete: "set null" }), // Nullable (TBD)
  
  scoreA: integer("score_a").default(0),
  scoreB: integer("score_b").default(0),
  bestOf: integer("best_of").notNull(),
  
  status: text("status").notNull().default("PENDING"), // 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  winnerId: integer("winner_id").references(() => players.id, { onDelete: "set null" }),
  
  order: integer("order").notNull(), // Display order within round/group
  boardNumber: integer("board_number"), // Board assignment for knockout matches
  scorerId: integer("scorer_id").references(() => players.id, { onDelete: "set null" }), // Assigned scorer for group matches
  scorerName: text("scorer_name"), // Display name for scorer (editable, independent per match)
});

export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });

// === MATCH NOTES ===
export const matchNotes = pgTable("match_notes", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().unique().references(() => matches.id, { onDelete: "cascade" }),
  highestCheckout: integer("highest_checkout"),
  numberOf180s: integer("number_of_180s").default(0),
  customNote: text("custom_note"),
  totalVisitsA: integer("total_visits_a"),
  totalVisitsB: integer("total_visits_b"),
  totalScoredA: integer("total_scored_a"),
  totalScoredB: integer("total_scored_b"),
  highestVisitA: integer("highest_visit_a"),
  highestVisitB: integer("highest_visit_b"),
  highestFinishA: integer("highest_finish_a"),
  highestFinishB: integer("highest_finish_b"),
  ton80sA: integer("ton80s_a"),
  ton80sB: integer("ton80s_b"),
  ton40sA: integer("ton40s_a"),
  ton40sB: integer("ton40s_b"),
  tonsA: integer("tons_a"),
  tonsB: integer("tons_b"),
  checkoutAttemptsA: integer("checkout_attempts_a"),
  checkoutAttemptsB: integer("checkout_attempts_b"),
  checkoutSuccessA: integer("checkout_success_a"),
  checkoutSuccessB: integer("checkout_success_b"),
});

export const insertMatchNoteSchema = createInsertSchema(matchNotes).omit({ id: true });

// === BOARD SESSIONS ===
export const boardSessions = pgTable("board_sessions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  boardNumber: integer("board_number").notNull(),
  pairingToken: text("pairing_token").notNull().unique(),
  accessToken: text("access_token"),
  expiresAt: timestamp("expires_at"),
  pairedAt: timestamp("paired_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBoardSessionSchema = createInsertSchema(boardSessions).omit({ id: true, createdAt: true });

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  tournaments: many(tournaments),
  leagues: many(leagues),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  user: one(users, { fields: [leagues.userId], references: [users.id] }),
  tournaments: many(tournaments),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  user: one(users, { fields: [tournaments.userId], references: [users.id] }),
  league: one(leagues, { fields: [tournaments.leagueId], references: [leagues.id] }),
  players: many(players),
  groups: many(groups),
  matches: many(matches),
  boardSessions: many(boardSessions),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [groups.tournamentId], references: [tournaments.id] }),
  memberships: many(groupMemberships),
  matches: many(matches),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [players.tournamentId], references: [tournaments.id] }),
  groupMemberships: many(groupMemberships),
  matchesAsA: many(matches, { relationName: "playerA" }),
  matchesAsB: many(matches, { relationName: "playerB" }),
  matchesWon: many(matches, { relationName: "winner" }),
}));

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
  group: one(groups, { fields: [groupMemberships.groupId], references: [groups.id] }),
  player: one(players, { fields: [groupMemberships.playerId], references: [players.id] }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  tournament: one(tournaments, { fields: [matches.tournamentId], references: [tournaments.id] }),
  group: one(groups, { fields: [matches.groupId], references: [groups.id] }),
  playerA: one(players, { fields: [matches.playerAId], references: [players.id], relationName: "playerA" }),
  playerB: one(players, { fields: [matches.playerBId], references: [players.id], relationName: "playerB" }),
  winner: one(players, { fields: [matches.winnerId], references: [players.id], relationName: "winner" }),
  notes: one(matchNotes, { fields: [matches.id], references: [matchNotes.matchId] }),
}));

export const matchNotesRelations = relations(matchNotes, ({ one }) => ({
  match: one(matches, { fields: [matchNotes.matchId], references: [matches.id] }),
}));

export const boardSessionsRelations = relations(boardSessions, ({ one }) => ({
  tournament: one(tournaments, { fields: [boardSessions.tournamentId], references: [tournaments.id] }),
}));

// === TYPES ===
export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export type GroupMembership = typeof groupMemberships.$inferSelect;
export type InsertGroupMembership = z.infer<typeof insertGroupMembershipSchema>;

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export type MatchNote = typeof matchNotes.$inferSelect;
export type InsertMatchNote = z.infer<typeof insertMatchNoteSchema>;

export type BoardSession = typeof boardSessions.$inferSelect;
export type InsertBoardSession = z.infer<typeof insertBoardSessionSchema>;

// === API DTOs ===
export type TournamentSettings = {
  groupCount?: number;
  groupBestOf?: number;
  knockoutBestOf?: number;
  knockoutBestOfByRound?: {
    quarterFinal?: number;
    semiFinal?: number;
    final?: number;
  };
  seeded?: boolean;
  promotedPerGroup?: number;
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
};

export type CreateTournamentRequest = {
  name: string;
  type: string;
  playerNames: string[];
  randomize: boolean;
  settings: TournamentSettings;
};

export type UpdateMatchScoreRequest = {
  scoreA: number;
  scoreB: number;
  notes?: {
    highestCheckout?: number;
    numberOf180s?: number;
    customNote?: string;
  };
};

export type ExportData = {
  tournament: Tournament;
  players: Player[];
  matches: (Match & { playerA: Player | null, playerB: Player | null, notes: MatchNote | null })[];
  groups: (Group & { memberships: (GroupMembership & { player: Player })[] })[];
};
