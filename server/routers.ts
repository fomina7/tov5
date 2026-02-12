import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { users, gameTables, handHistory, transactions, adminLogs, botConfigs, rakeLedger, tournaments, tournamentEntries } from "../drizzle/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
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
      return db.select().from(handHistory)
        .where(eq(handHistory.winnerId, ctx.user.id))
        .orderBy(desc(handHistory.playedAt))
        .limit(input.limit)
        .offset(input.offset);
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
        rakebackBalance: users.rakebackBalance,
      }).from(users).where(eq(users.id, ctx.user.id));
      return user;
    }),

    claimRakeback: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      if (user.rakebackBalance <= 0) throw new Error("No rakeback to claim");

      const amount = user.rakebackBalance;
      await db.update(users).set({
        balanceReal: sql`balanceReal + ${amount}`,
        rakebackBalance: 0,
      }).where(eq(users.id, ctx.user.id));

      await db.insert(transactions).values({
        userId: ctx.user.id,
        type: "rakeback",
        amount,
        status: "completed",
        note: `Rakeback claim: ${amount}`,
      });

      return { claimed: amount };
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
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      if (user.balanceReal < input.amount) throw new Error("Insufficient balance");

      await db.update(users).set({
        balanceReal: sql`balanceReal - ${input.amount}`,
      }).where(eq(users.id, ctx.user.id));

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
      const tableStates = gameManager.getAllTableStates();
      let totalPlayers = 0;
      let totalBots = 0;
      let totalHumans = 0;
      for (const t of tableStates) {
        totalPlayers += t.playerCount;
        totalBots += t.botCount;
        totalHumans += t.humanCount;
      }
      return {
        activeTables: gameManager.getActiveTableCount(),
        onlinePlayers: totalPlayers,
        onlineHumans: totalHumans,
        onlineBots: totalBots,
        tableDetails: tableStates.map((t: any) => ({
          tableId: t.tableId,
          players: t.playerCount,
          bots: t.botCount,
          humans: t.humanCount,
          phase: t.phase,
        })),
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
      const [rakeTotal] = await db.select({ total: sql<number>`COALESCE(SUM(rakeAmount), 0)` }).from(rakeLedger);

      return {
        totalUsers: userCount.count,
        totalTables: tableCount.count,
        totalHands: handCount.count,
        totalTransactions: txCount.count,
        totalRakeCollected: rakeTotal.total,
        activeTables: gameManager.getActiveTableCount(),
        onlinePlayers: gameManager.getOnlinePlayerCount(),
        liveTableStates: gameManager.getAllTableStates(),
      };
    }),

    // ─── User Management ──────────────────────────────
    users: adminProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(users).orderBy(desc(users.createdAt)).limit(input.limit).offset(input.offset);
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

    setUserRole: adminProcedure.input(z.object({
      userId: z.number(),
      role: z.enum(["admin", "user"]),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "set_role",
        targetUserId: input.userId,
        details: { role: input.role },
      });
      return { success: true };
    }),

    // ─── Table Management ─────────────────────────────
    viewTable: adminProcedure.input(z.object({
      tableId: z.number(),
    })).query(({ input }) => {
      return gameManager.getAdminTableState(input.tableId);
    }),

    liveTableStates: adminProcedure.query(() => {
      return gameManager.getAllTableStates();
    }),

    createTable: adminProcedure.input(z.object({
      name: z.string(),
      gameType: z.enum(["holdem", "omaha"]).default("holdem"),
      tableSize: z.enum(["2", "4", "6", "9"]).default("6"),
      smallBlind: z.number().min(1),
      bigBlind: z.number().min(2),
      minBuyIn: z.number().min(1),
      maxBuyIn: z.number().min(1),
      rakePercentage: z.number().min(0).max(20).default(5),
      rakeCap: z.number().min(0).default(0),
      botsEnabled: z.boolean().default(true),
      botCount: z.number().min(0).max(8).default(2),
      botDifficulty: z.enum(["beginner", "medium", "pro", "mixed"]).default("mixed"),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(gameTables).values(input);
      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "create_table",
        details: input,
      });
      return { success: true };
    }),

    updateTable: adminProcedure.input(z.object({
      tableId: z.number(),
      name: z.string().optional(),
      rakePercentage: z.number().min(0).max(20).optional(),
      rakeCap: z.number().min(0).optional(),
      botsEnabled: z.boolean().optional(),
      botCount: z.number().min(0).max(8).optional(),
      botDifficulty: z.enum(["beginner", "medium", "pro", "mixed"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { tableId, ...updateData } = input;
      const filtered = Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) {
        await db.update(gameTables).set(filtered).where(eq(gameTables.id, tableId));
      }
      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "update_table",
        details: input,
      });
      return { success: true };
    }),

    forceNewHand: adminProcedure.input(z.object({
      tableId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const result = gameManager.adminForceNewHand(input.tableId);
      await (await getDb())?.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "force_new_hand",
        details: { tableId: input.tableId },
      });
      return { success: result };
    }),

    // ─── Bot Management ───────────────────────────────
    botConfigs: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(botConfigs).orderBy(botConfigs.name);
    }),

    createBot: adminProcedure.input(z.object({
      name: z.string().min(2).max(64),
      avatar: z.string().default("fox"),
      difficulty: z.enum(["beginner", "medium", "pro"]).default("medium"),
      personality: z.string().default("balanced"),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(botConfigs).values(input);
      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "create_bot",
        details: input,
      });
      return { success: true };
    }),

    updateBot: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(2).max(64).optional(),
      avatar: z.string().optional(),
      difficulty: z.enum(["beginner", "medium", "pro"]).optional(),
      personality: z.string().optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...updateData } = input;
      const filtered = Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) {
        await db.update(botConfigs).set(filtered).where(eq(botConfigs.id, id));
      }
      return { success: true };
    }),

    deleteBot: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(botConfigs).where(eq(botConfigs.id, input.id));
      return { success: true };
    }),

    // Add/remove bot from live table
    addBotToTable: adminProcedure.input(z.object({
      tableId: z.number(),
      botName: z.string().optional(),
      difficulty: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await gameManager.adminAddBot(input.tableId, input.botName, input.difficulty);
      await (await getDb())?.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "add_bot_to_table",
        details: input,
      });
      return { success: result };
    }),

    removeBotFromTable: adminProcedure.input(z.object({
      tableId: z.number(),
      seatIndex: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const result = await gameManager.adminRemoveBot(input.tableId, input.seatIndex);
      await (await getDb())?.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "remove_bot_from_table",
        details: input,
      });
      return { success: result };
    }),

    // ─── Rake Stats ───────────────────────────────────
    rakeStats: adminProcedure.input(z.object({
      days: z.number().min(1).max(365).default(30),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await db.select({
        totalRake: sql<number>`COALESCE(SUM(rakeAmount), 0)`,
        totalPot: sql<number>`COALESCE(SUM(potAmount), 0)`,
        handCount: sql<number>`count(*)`,
      }).from(rakeLedger).where(gte(rakeLedger.createdAt, since));

      const recentRakes = await db.select().from(rakeLedger)
        .orderBy(desc(rakeLedger.createdAt))
        .limit(50);

      return {
        summary: rows[0],
        recentRakes,
      };
    }),

    // ─── Transaction Management ───────────────────────
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

    rejectTransaction: adminProcedure.input(z.object({
      transactionId: z.number(),
      reason: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [tx] = await db.select().from(transactions).where(eq(transactions.id, input.transactionId));
      if (!tx) throw new Error("Transaction not found");

      // Refund if it was a withdrawal
      if (tx.type === "withdraw" && tx.status === "pending") {
        await db.update(users).set({
          balanceReal: sql`balanceReal + ${Math.abs(tx.amount)}`,
        }).where(eq(users.id, tx.userId));
      }

      await db.update(transactions).set({ status: "failed" }).where(eq(transactions.id, input.transactionId));
      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "reject_transaction",
        details: { transactionId: input.transactionId, reason: input.reason },
      });
      return { success: true };
    }),

    // ─── Logs ─────────────────────────────────────────
    logs: adminProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(50),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(input.limit);
    }),

    handHistory: adminProcedure.input(z.object({
      tableId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(handHistory).orderBy(desc(handHistory.playedAt)).limit(input.limit);
    }),

    // ─── Tournament Management (Admin) ───────────────────
    tournamentList: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
    }),

    createTournament: adminProcedure.input(z.object({
      name: z.string().min(2).max(256),
      type: z.enum(["sit_and_go", "mtt", "freeroll"]).default("sit_and_go"),
      buyIn: z.number().min(0).default(0),
      entryFee: z.number().min(0).default(0),
      startingChips: z.number().min(100).default(1500),
      maxPlayers: z.number().min(2).max(1000).default(9),
      minPlayers: z.number().min(2).default(2),
      tableSize: z.enum(["2", "4", "6", "9"]).default("6"),
      guaranteedPrize: z.number().min(0).default(0),
      botsEnabled: z.boolean().default(true),
      botCount: z.number().min(0).max(100).default(3),
      botDifficulty: z.enum(["beginner", "medium", "pro", "mixed"]).default("mixed"),
      scheduledStart: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const defaultBlinds = [
        { level: 1, smallBlind: 10, bigBlind: 20, duration: 600 },
        { level: 2, smallBlind: 15, bigBlind: 30, duration: 600 },
        { level: 3, smallBlind: 25, bigBlind: 50, duration: 600 },
        { level: 4, smallBlind: 50, bigBlind: 100, duration: 600 },
        { level: 5, smallBlind: 75, bigBlind: 150, duration: 600 },
        { level: 6, smallBlind: 100, bigBlind: 200, duration: 600 },
        { level: 7, smallBlind: 150, bigBlind: 300, duration: 600 },
        { level: 8, smallBlind: 200, bigBlind: 400, duration: 600 },
        { level: 9, smallBlind: 300, bigBlind: 600, duration: 600 },
        { level: 10, smallBlind: 500, bigBlind: 1000, duration: 600 },
      ];

      const defaultPayouts = [
        { place: 1, percentage: 50 },
        { place: 2, percentage: 30 },
        { place: 3, percentage: 20 },
      ];

      const [result] = await db.insert(tournaments).values({
        name: input.name,
        type: input.type,
        buyIn: input.buyIn,
        entryFee: input.entryFee,
        startingChips: input.startingChips,
        maxPlayers: input.maxPlayers,
        minPlayers: input.minPlayers,
        tableSize: input.tableSize,
        guaranteedPrize: input.guaranteedPrize,
        botsEnabled: input.botsEnabled,
        botCount: input.botCount,
        botDifficulty: input.botDifficulty,
        blindStructure: defaultBlinds,
        payoutStructure: defaultPayouts,
        scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null,
        createdBy: ctx.user.id,
      });

      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "create_tournament",
        details: { ...input, tournamentId: result.insertId },
      });

      return { success: true, tournamentId: result.insertId };
    }),

    updateTournament: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      status: z.enum(["registering", "running", "paused", "completed", "cancelled"]).optional(),
      botCount: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...updateData } = input;
      const filtered = Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) {
        await db.update(tournaments).set(filtered).where(eq(tournaments.id, id));
      }
      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "update_tournament",
        details: input,
      });
      return { success: true };
    }),

    deleteTournament: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(tournamentEntries).where(eq(tournamentEntries.tournamentId, input.id));
      await db.delete(tournaments).where(eq(tournaments.id, input.id));
      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "delete_tournament",
        details: { tournamentId: input.id },
      });
      return { success: true };
    }),

    addBotsToTournament: adminProcedure.input(z.object({
      tournamentId: z.number(),
      count: z.number().min(1).max(50).default(3),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, input.tournamentId));
      if (!tournament) throw new Error("Tournament not found");

      const existingEntries = await db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, input.tournamentId));
      const spotsLeft = tournament.maxPlayers - existingEntries.length;
      const toAdd = Math.min(input.count, spotsLeft);

      const botNames = ["AlphaBot", "PokerMind", "ChipKing", "BluffMaster", "CardShark", "AceHunter", "StackAttack", "FoldMaster", "RiverRat", "NutCrusher", "PotBuilder", "BetBoss", "RaiseMaster", "CheckRaise", "SlowPlay", "FastFold", "TiltKing", "GrindBot", "ValueBet", "OverBet"];
      const botAvatars = ["fox", "shark", "owl", "cat", "bear", "monkey", "wolf", "penguin"];
      const difficulties: ("beginner" | "medium" | "pro")[] = ["beginner", "medium", "pro"];

      for (let i = 0; i < toAdd; i++) {
        const name = botNames[Math.floor(Math.random() * botNames.length)] + Math.floor(Math.random() * 100);
        const diff = tournament.botDifficulty === "mixed" ? difficulties[Math.floor(Math.random() * 3)] : tournament.botDifficulty as any;
        await db.insert(tournamentEntries).values({
          tournamentId: input.tournamentId,
          isBot: true,
          botName: name,
          botAvatar: botAvatars[Math.floor(Math.random() * botAvatars.length)],
          botDifficulty: diff,
          chipStack: tournament.startingChips,
          status: "registered",
        });
      }

      await db.update(tournaments).set({
        currentPlayers: sql`currentPlayers + ${toAdd}`,
      }).where(eq(tournaments.id, input.tournamentId));

      return { success: true, added: toAdd };
    }),

    tournamentEntries: adminProcedure.input(z.object({
      tournamentId: z.number(),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, input.tournamentId));
    }),

    startTournament: adminProcedure.input(z.object({
      tournamentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, input.tournamentId));
      if (!tournament) throw new Error("Tournament not found");
      if (tournament.status !== "registering") throw new Error("Tournament is not in registering state");

      const entries = await db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, input.tournamentId));
      if (entries.length < tournament.minPlayers) throw new Error(`Need at least ${tournament.minPlayers} players`);

      // Calculate prize pool
      const humanEntries = entries.filter(e => !e.isBot);
      const prizePool = Math.max(humanEntries.length * tournament.buyIn, tournament.guaranteedPrize);

      await db.update(tournaments).set({
        status: "running",
        startedAt: new Date(),
        prizePool,
      }).where(eq(tournaments.id, input.tournamentId));

      // Set all entries to playing
      await db.update(tournamentEntries).set({
        status: "playing",
        chipStack: tournament.startingChips,
      }).where(eq(tournamentEntries.tournamentId, input.tournamentId));

      await db.insert(adminLogs).values({
        adminId: ctx.user.id,
        action: "start_tournament",
        details: { tournamentId: input.tournamentId, players: entries.length, prizePool },
      });

      return { success: true, players: entries.length, prizePool };
    }),
  }),

  // ─── Tournaments (Public) ───────────────────────────────
  tournaments: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
    }),

    get: publicProcedure.input(z.object({
      id: z.number(),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, input.id));
      if (!tournament) throw new Error("Tournament not found");
      const entries = await db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, input.id));
      return { ...tournament, entries };
    }),

    register: protectedProcedure.input(z.object({
      tournamentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, input.tournamentId));
      if (!tournament) throw new Error("Tournament not found");
      if (tournament.status !== "registering") throw new Error("Registration closed");
      if (tournament.currentPlayers >= tournament.maxPlayers) throw new Error("Tournament full");

      // Check if already registered
      const existing = await db.select().from(tournamentEntries)
        .where(and(
          eq(tournamentEntries.tournamentId, input.tournamentId),
          eq(tournamentEntries.userId, ctx.user.id)
        ));
      if (existing.length > 0) throw new Error("Already registered");

      // Deduct buy-in
      if (tournament.buyIn > 0) {
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
        if (user.balanceReal < tournament.buyIn + tournament.entryFee) throw new Error("Insufficient balance");
        await db.update(users).set({
          balanceReal: sql`balanceReal - ${tournament.buyIn + tournament.entryFee}`,
        }).where(eq(users.id, ctx.user.id));

        await db.insert(transactions).values({
          userId: ctx.user.id,
          type: "buy_in",
          amount: -(tournament.buyIn + tournament.entryFee),
          status: "completed",
          note: `Tournament buy-in: ${tournament.name}`,
        });
      }

      await db.insert(tournamentEntries).values({
        tournamentId: input.tournamentId,
        userId: ctx.user.id,
        chipStack: tournament.startingChips,
        status: "registered",
      });

      await db.update(tournaments).set({
        currentPlayers: sql`currentPlayers + 1`,
      }).where(eq(tournaments.id, input.tournamentId));

      return { success: true };
    }),

    unregister: protectedProcedure.input(z.object({
      tournamentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, input.tournamentId));
      if (!tournament) throw new Error("Tournament not found");
      if (tournament.status !== "registering") throw new Error("Cannot unregister after tournament started");

      const existing = await db.select().from(tournamentEntries)
        .where(and(
          eq(tournamentEntries.tournamentId, input.tournamentId),
          eq(tournamentEntries.userId, ctx.user.id)
        ));
      if (existing.length === 0) throw new Error("Not registered");

      // Refund buy-in
      if (tournament.buyIn > 0) {
        await db.update(users).set({
          balanceReal: sql`balanceReal + ${tournament.buyIn + tournament.entryFee}`,
        }).where(eq(users.id, ctx.user.id));

        await db.insert(transactions).values({
          userId: ctx.user.id,
          type: "cash_out",
          amount: tournament.buyIn + tournament.entryFee,
          status: "completed",
          note: `Tournament unregister refund: ${tournament.name}`,
        });
      }

      await db.delete(tournamentEntries)
        .where(and(
          eq(tournamentEntries.tournamentId, input.tournamentId),
          eq(tournamentEntries.userId, ctx.user.id)
        ));

      await db.update(tournaments).set({
        currentPlayers: sql`currentPlayers - 1`,
      }).where(eq(tournaments.id, input.tournamentId));

      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
