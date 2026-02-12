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
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  avatar: varchar("avatar", { length: 512 }),
  nickname: varchar("nickname", { length: 64 }),
  // Balances stored as cents/smallest unit to avoid floating point
  balanceReal: bigint("balanceReal", { mode: "number" }).default(0).notNull(),
  balanceBonus: bigint("balanceBonus", { mode: "number" }).default(0).notNull(),
  tournamentTickets: int("tournamentTickets").default(0).notNull(),
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
