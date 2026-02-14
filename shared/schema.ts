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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

// === TOURNAMENTS ===
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
});

export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });

// === MATCH NOTES ===
export const matchNotes = pgTable("match_notes", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().unique().references(() => matches.id, { onDelete: "cascade" }),
  highestCheckout: integer("highest_checkout"),
  numberOf180s: integer("number_of_180s").default(0),
  customNote: text("custom_note"),
});

export const insertMatchNoteSchema = createInsertSchema(matchNotes).omit({ id: true });


// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  tournaments: many(tournaments),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  user: one(users, { fields: [tournaments.userId], references: [users.id] }),
  players: many(players),
  groups: many(groups),
  matches: many(matches),
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

// === TYPES ===
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

// === API DTOs ===
export type CreateTournamentRequest = {
  name: string;
  type: string;
  playerNames: string[];
  randomize: boolean;
  settings: {
    groupCount?: number;
    promotedPerGroup?: number;
    pointsPerWin?: number;
    pointsPerDraw?: number;
    pointsPerLoss?: number;
    groupStageBestOf?: number;
    knockoutBestOfByRound?: Record<string, number>;
    thirdPlacePlayoff?: boolean;
    seededKnockout?: boolean;
    bracketReset?: boolean;
    multiStageSettings?: {
      groupStageBestOf: number;
      knockoutBestOfByRound: Record<string, number>;
    };
  };
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
