import {
  int,
  bigint,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  decimal,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
  telegramId: varchar("telegramId", { length: 64 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  avatar: varchar("avatar", { length: 512 }),
  nickname: varchar("nickname", { length: 64 }),
  // Balances stored as cents/smallest unit to avoid floating point
  balanceReal: bigint("balanceReal", { mode: "number" }).default(0).notNull(),
  balanceBonus: bigint("balanceBonus", { mode: "number" }).default(0).notNull(),
  tournamentTickets: int("tournamentTickets").default(0).notNull(),
  // Rakeback
  rakebackBalance: bigint("rakebackBalance", { mode: "number" }).default(0).notNull(),
  totalRakeGenerated: bigint("totalRakeGenerated", { mode: "number" }).default(0).notNull(),
  rakebackPercentage: int("rakebackPercentage").default(10).notNull(), // 10% default
  // Stats
  handsPlayed: int("handsPlayed").default(0).notNull(),
  handsWon: int("handsWon").default(0).notNull(),
  totalWinnings: bigint("totalWinnings", { mode: "number" }).default(0).notNull(),
  totalLosses: bigint("totalLosses", { mode: "number" }).default(0).notNull(),
  level: int("level").default(1).notNull(),
  xp: int("xp").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Game Tables (Rooms) ─────────────────────────────────
export const gameTables = mysqlTable("gameTables", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  gameType: mysqlEnum("gameType", ["holdem", "omaha"]).default("holdem").notNull(),
  tableSize: mysqlEnum("tableSize", ["2", "4", "6", "9"]).default("6").notNull(),
  smallBlind: int("smallBlind").notNull(),
  bigBlind: int("bigBlind").notNull(),
  minBuyIn: int("minBuyIn").notNull(),
  maxBuyIn: int("maxBuyIn").notNull(),
  // Rake config
  rakePercentage: int("rakePercentage").default(5).notNull(), // 5%
  rakeCap: int("rakeCap").default(0).notNull(), // 0 = auto (5x BB)
  // Bot config
  botsEnabled: boolean("botsEnabled").default(true).notNull(),
  botCount: int("botCount").default(2).notNull(),
  botDifficulty: mysqlEnum("botDifficulty", ["beginner", "medium", "pro", "mixed"]).default("mixed").notNull(),
  // Current state
  status: mysqlEnum("status", ["waiting", "playing", "paused"]).default("waiting").notNull(),
  playerCount: int("playerCount").default(0).notNull(),
  // JSON blob for full game state (cards, pots, etc.)
  gameState: json("gameState"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GameTable = typeof gameTables.$inferSelect;
export type InsertGameTable = typeof gameTables.$inferInsert;

// ─── Table Players (who is seated where) ─────────────────
export const tablePlayers = mysqlTable("tablePlayers", {
  id: int("id").autoincrement().primaryKey(),
  tableId: int("tableId").notNull(),
  userId: int("userId").notNull(),
  seatIndex: int("seatIndex").notNull(),
  chipStack: bigint("chipStack", { mode: "number" }).notNull(),
  isBot: boolean("isBot").default(false).notNull(),
  botName: varchar("botName", { length: 64 }),
  botAvatar: varchar("botAvatar", { length: 512 }),
  botDifficulty: mysqlEnum("botDifficulty", ["beginner", "medium", "pro"]),
  status: mysqlEnum("status", ["active", "sitting_out", "disconnected"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type TablePlayer = typeof tablePlayers.$inferSelect;

// ─── Hand History ────────────────────────────────────────
export const handHistory = mysqlTable("handHistory", {
  id: int("id").autoincrement().primaryKey(),
  tableId: int("tableId").notNull(),
  handNumber: int("handNumber").notNull(),
  // Full hand log as JSON
  handData: json("handData").notNull(),
  potTotal: bigint("potTotal", { mode: "number" }).notNull(),
  winnerId: int("winnerId"),
  winnerName: varchar("winnerName", { length: 128 }),
  winningHand: varchar("winningHand", { length: 128 }),
  rakeAmount: int("rakeAmount").default(0).notNull(),
  playedAt: timestamp("playedAt").defaultNow().notNull(),
});

export type HandHistoryRow = typeof handHistory.$inferSelect;

// ─── Transactions ────────────────────────────────────────
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdraw", "buy_in", "cash_out", "bonus", "rake", "rakeback", "admin_adjust"]).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 16 }).default("USDT").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending").notNull(),
  txHash: varchar("txHash", { length: 256 }),
  walletAddress: varchar("walletAddress", { length: 256 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;

// ─── Admin Logs ──────────────────────────────────────────
export const adminLogs = mysqlTable("adminLogs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  action: varchar("action", { length: 256 }).notNull(),
  targetUserId: int("targetUserId"),
  targetTableId: int("targetTableId"),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminLog = typeof adminLogs.$inferSelect;

// ─── Bot Configurations ─────────────────────────────────
export const botConfigs = mysqlTable("botConfigs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  avatar: varchar("avatar", { length: 512 }).notNull(),
  difficulty: mysqlEnum("difficulty", ["beginner", "medium", "pro"]).default("medium").notNull(),
  personality: varchar("personality", { length: 64 }).default("balanced").notNull(), // aggressive, tight, loose, balanced
  isActive: boolean("isActive").default(true).notNull(),
  gamesPlayed: int("gamesPlayed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BotConfig = typeof botConfigs.$inferSelect;

// ─── Tournaments ────────────────────────────────────────
export const tournaments = mysqlTable("tournaments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  type: mysqlEnum("type", ["sit_and_go", "mtt", "freeroll"]).default("sit_and_go").notNull(),
  status: mysqlEnum("status", ["registering", "running", "paused", "completed", "cancelled"]).default("registering").notNull(),
  buyIn: int("buyIn").default(0).notNull(), // 0 = freeroll
  entryFee: int("entryFee").default(0).notNull(), // rake on buy-in
  startingChips: int("startingChips").default(1500).notNull(),
  maxPlayers: int("maxPlayers").default(9).notNull(),
  minPlayers: int("minPlayers").default(2).notNull(),
  currentPlayers: int("currentPlayers").default(0).notNull(),
  tableSize: mysqlEnum("tableSize", ["2", "4", "6", "9"]).default("6").notNull(),
  // Blind structure as JSON: [{level, smallBlind, bigBlind, duration}]
  blindStructure: json("blindStructure").notNull(),
  currentBlindLevel: int("currentBlindLevel").default(0).notNull(),
  // Prize pool
  prizePool: int("prizePool").default(0).notNull(),
  guaranteedPrize: int("guaranteedPrize").default(0).notNull(),
  // Payout structure as JSON: [{place, percentage}]
  payoutStructure: json("payoutStructure"),
  // Bot config
  botsEnabled: boolean("botsEnabled").default(true).notNull(),
  botCount: int("botCount").default(3).notNull(),
  botDifficulty: mysqlEnum("botDifficulty", ["beginner", "medium", "pro", "mixed"]).default("mixed").notNull(),
  // Timing
  scheduledStart: timestamp("scheduledStart"),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = typeof tournaments.$inferInsert;

// ─── Tournament Entries ─────────────────────────────────
export const tournamentEntries = mysqlTable("tournamentEntries", {
  id: int("id").autoincrement().primaryKey(),
  tournamentId: int("tournamentId").notNull(),
  userId: int("userId"),
  isBot: boolean("isBot").default(false).notNull(),
  botName: varchar("botName", { length: 64 }),
  botAvatar: varchar("botAvatar", { length: 512 }),
  botDifficulty: mysqlEnum("botDifficulty", ["beginner", "medium", "pro"]),
  chipStack: int("chipStack").default(0).notNull(),
  status: mysqlEnum("status", ["registered", "playing", "eliminated", "finished"]).default("registered").notNull(),
  finishPosition: int("finishPosition"),
  prizeWon: int("prizeWon").default(0).notNull(),
  eliminatedAt: timestamp("eliminatedAt"),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
});

export type TournamentEntry = typeof tournamentEntries.$inferSelect;

// ─── Rake Ledger ────────────────────────────────────────
export const rakeLedger = mysqlTable("rakeLedger", {
  id: int("id").autoincrement().primaryKey(),
  tableId: int("tableId").notNull(),
  handNumber: int("handNumber").notNull(),
  potAmount: bigint("potAmount", { mode: "number" }).notNull(),
  rakeAmount: bigint("rakeAmount", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RakeLedgerRow = typeof rakeLedger.$inferSelect;
