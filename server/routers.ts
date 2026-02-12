import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { users, gameTables, handHistory, transactions, adminLogs } from "../drizzle/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { z } from "zod";
import { gameManager } from "./gameManager";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── User Profile ────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      return user;
    }),

    update: protectedProcedure.input(z.object({
      nickname: z.string().min(2).max(32).optional(),
      avatar: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const updateData: Record<string, any> = {};
      if (input.nickname) updateData.nickname = input.nickname;
      if (input.avatar) updateData.avatar = input.avatar;
      await db.update(users).set(updateData).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

    uploadAvatar: protectedProcedure.input(z.object({
      base64: z.string(),
      mimeType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.split("/")[1] || "png";
      const key = `avatars/${ctx.user.id}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(users).set({ avatar: url }).where(eq(users.id, ctx.user.id));
      return { url };
    }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      return {
        handsPlayed: user.handsPlayed,
        handsWon: user.handsWon,
        winRate: user.handsPlayed > 0 ? ((user.handsWon / user.handsPlayed) * 100).toFixed(1) : "0",
        totalWinnings: user.totalWinnings,
        totalLosses: user.totalLosses,
        level: user.level,
        xp: user.xp,
      };
    }),

    handHistory: protectedProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await db.select().from(handHistory)
        .where(eq(handHistory.winnerId, ctx.user.id))
        .orderBy(desc(handHistory.playedAt))
        .limit(input.limit)
        .offset(input.offset);
      return rows;
    }),
  }),

  // ─── Balance & Transactions ──────────────────────────
  balance: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [user] = await db.select({
        balanceReal: users.balanceReal,
        balanceBonus: users.balanceBonus,
        tournamentTickets: users.tournamentTickets,
      }).from(users).where(eq(users.id, ctx.user.id));
      return user;
    }),

    transactions: protectedProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(transactions)
        .where(eq(transactions.userId, ctx.user.id))
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

    requestDeposit: protectedProcedure.input(z.object({
      amount: z.number().min(1),
      currency: z.string().default("USDT"),
      walletAddress: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Create pending deposit transaction
      const [result] = await db.insert(transactions).values({
        userId: ctx.user.id,
        type: "deposit",
        amount: input.amount,
        currency: input.currency,
        status: "pending",
        walletAddress: input.walletAddress || null,
        note: `Deposit request: ${input.amount} ${input.currency}`,
      });
      return {
        transactionId: result.insertId,
        // In production, this would return a payment address/link
        depositAddress: "TBD_CRYPTO_ADDRESS",
        status: "pending",
      };
    }),

    requestWithdraw: protectedProcedure.input(z.object({
      amount: z.number().min(1),
      currency: z.string().default("USDT"),
      walletAddress: z.string().min(10),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Check balance
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      if (user.balanceReal < input.amount) {
        throw new Error("Insufficient balance");
      }

      // Deduct balance
      await db.update(users).set({
        balanceReal: sql`balanceReal - ${input.amount}`,
      }).where(eq(users.id, ctx.user.id));

      // Create withdrawal transaction
      await db.insert(transactions).values({
        userId: ctx.user.id,
        type: "withdraw",
        amount: -input.amount,
        currency: input.currency,
        status: "pending",
        walletAddress: input.walletAddress,
        note: `Withdrawal: ${input.amount} ${input.currency} to ${input.walletAddress}`,
      });

      return { success: true, status: "pending" };
    }),
  }),

  // ─── Game Tables ─────────────────────────────────────
  tables: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(gameTables).orderBy(gameTables.smallBlind);
    }),

    get: publicProcedure.input(z.object({
      id: z.number(),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [table] = await db.select().from(gameTables).where(eq(gameTables.id, input.id));
      return table;
    }),

    onlineStats: publicProcedure.query(() => {
      return {
        activeTables: gameManager.getActiveTableCount(),
        onlinePlayers: gameManager.getOnlinePlayerCount(),
      };
    }),
  }),

  // ─── Admin Panel ─────────────────────────────────────
  admin: router({
    // Dashboard stats
    stats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [tableCount] = await db.select({ count: sql<number>`count(*)` }).from(gameTables);
      const [handCount] = await db.select({ count: sql<number>`count(*)` }).from(handHistory);
      const [txCount] = await db.select({ count: sql<number>`count(*)` }).from(transactions);

      return {
        totalUsers: userCount.count,
        totalTables: tableCount.count,
        totalHands: handCount.count,
        totalTransactions: txCount.count,
        activeTables: gameManager.getActiveTableCount(),
        onlinePlayers: gameManager.getOnlinePlayerCount(),
      };
    }),

    // User management
    users: adminProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      let query = db.select().from(users).orderBy(desc(users.createdAt)).limit(input.limit).offset(input.offset);
      return query;
    }),

    adjustBalance: adminProcedure.input(z.object({
      userId: z.number(),
      amount: z.number(),
      note: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.update(users).set({
        balanceReal: sql`balanceReal + ${input.amount}`,
      }).where(eq(users.id, input.userId));

      await db.insert(transactions).values({
        userId: input.userId,
        type: "admin_adjust",
        amount: input.amount,
        status: "completed",
        note: input.note || `Admin balance adjustment by ${ctx.user.name}`,
      });

      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "adjust_balance",
        targetUserId: input.userId,
        details: { amount: input.amount, note: input.note },
      });

      return { success: true };
    }),

    // View active table state (admin sees all cards)
    viewTable: adminProcedure.input(z.object({
      tableId: z.number(),
    })).query(({ input }) => {
      return gameManager.getAdminTableState(input.tableId);
    }),

    // Transaction management
    transactions: adminProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(transactions)
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

    approveTransaction: adminProcedure.input(z.object({
      transactionId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [tx] = await db.select().from(transactions).where(eq(transactions.id, input.transactionId));
      if (!tx) throw new Error("Transaction not found");

      if (tx.type === "deposit" && tx.status === "pending") {
        // Credit the user
        await db.update(users).set({
          balanceReal: sql`balanceReal + ${Math.abs(tx.amount)}`,
        }).where(eq(users.id, tx.userId));
      }

      await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, input.transactionId));

      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "approve_transaction",
        details: { transactionId: input.transactionId },
      });

      return { success: true };
    }),

    // Create/edit tables
    createTable: adminProcedure.input(z.object({
      name: z.string(),
      gameType: z.enum(["holdem", "omaha"]).default("holdem"),
      tableSize: z.enum(["2", "4", "6", "9"]).default("6"),
      smallBlind: z.number().min(1),
      bigBlind: z.number().min(2),
      minBuyIn: z.number().min(1),
      maxBuyIn: z.number().min(1),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(gameTables).values(input);
      return { success: true };
    }),

    // Logs
    logs: adminProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(50),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(input.limit);
    }),

    // Hand history for any table
    handHistory: adminProcedure.input(z.object({
      tableId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      let query = db.select().from(handHistory).orderBy(desc(handHistory.playedAt)).limit(input.limit);
      return query;
    }),
  }),
});

export type AppRouter = typeof appRouter;
