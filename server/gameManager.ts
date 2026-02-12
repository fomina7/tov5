/**
 * Game Manager — manages all active poker tables via WebSocket
 * Handles game flow, rake collection, rakeback, bot management, admin API.
 */
import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import {
  GameState,
  PlayerState,
  createNewHand,
  processAction,
  getBotAction,
  sanitizeForPlayer,
  sanitizeForAdmin,
  RakeConfig,
} from "./pokerEngine";
import { getDb } from "./db";
import { gameTables, handHistory, users, transactions, rakeLedger, botConfigs } from "../drizzle/schema";
import { eq, sql, desc } from "drizzle-orm";

const DEFAULT_BOT_NAMES = ["AlphaBot", "PokerMind", "CardShark", "BluffMaster", "ChipKing", "AceHunter", "RiverRat", "NutCrusher"];
const DEFAULT_BOT_AVATARS = ["fox", "shark", "owl", "cat", "bear", "monkey", "wolf", "penguin"];

interface TableRoom {
  state: GameState;
  sockets: Map<number, string>; // seatIndex -> socketId
  userSockets: Map<number, string>; // userId -> socketId
  botTimers: Map<number, NodeJS.Timeout>;
  dealTimer?: NodeJS.Timeout;
  actionTimer?: NodeJS.Timeout;
  tableConfig?: any; // cached table config from DB
}

class GameManager {
  private io: SocketServer | null = null;
  private tables: Map<number, TableRoom> = new Map();

  init(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      path: "/api/socket.io",
      pingTimeout: 30000,
      pingInterval: 3000,
      transports: ['polling'],
      allowUpgrades: false,
      httpCompression: false,
      // Faster polling for Railway HTTP/2 compatibility
      maxHttpBufferSize: 1e6,
    });

    this.io.on("connection", (socket: Socket) => {
      console.log(`[WS] Client connected: ${socket.id}`);

      socket.on("join_table", (data: { tableId: number; userId: number; seatIndex?: number }) => {
        this.handleJoinTable(socket, data);
      });

      socket.on("leave_table", (data: { tableId: number }) => {
        this.handleLeaveTable(socket, data.tableId);
      });

      socket.on("player_action", (data: { tableId: number; action: string; amount?: number }) => {
        this.handlePlayerAction(socket, data);
      });

      socket.on("chat_message", (data: { tableId: number; message: string }) => {
        this.io?.to(`table_${data.tableId}`).emit("chat_message", {
          socketId: socket.id,
          message: data.message,
          timestamp: Date.now(),
        });
      });

      socket.on("admin_view_table", (data: { tableId: number }) => {
        const room = this.tables.get(data.tableId);
        if (room) {
          socket.emit("admin_state", sanitizeForAdmin(room.state));
        }
      });

      // Client can request current state (prevents stale UI)
      socket.on("request_state", (data: { tableId: number }) => {
        const room = this.tables.get(data.tableId);
        if (!room) return;
        const seatIndex = (socket as any).__seatIndex;
        if (seatIndex !== undefined && seatIndex >= 0) {
          socket.emit("game_state", sanitizeForPlayer(room.state, seatIndex));
        } else {
          socket.emit("spectator_state", sanitizeForPlayer(room.state, -1));
        }
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });

    this.initDefaultTables();
  }

  // ─── Table Initialization ──────────────────────────────
  private async initDefaultTables() {
    const db = await getDb();
    if (!db) return;

    const existing = await db.select().from(gameTables);
    if (existing.length === 0) {
      const defaultTables = [
        { name: "Micro Stakes", smallBlind: 1, bigBlind: 2, minBuyIn: 40, maxBuyIn: 200, tableSize: "6" as const },
        { name: "Low Stakes", smallBlind: 5, bigBlind: 10, minBuyIn: 200, maxBuyIn: 1000, tableSize: "6" as const },
        { name: "Medium Stakes", smallBlind: 25, bigBlind: 50, minBuyIn: 1000, maxBuyIn: 5000, tableSize: "6" as const },
        { name: "High Stakes", smallBlind: 100, bigBlind: 200, minBuyIn: 4000, maxBuyIn: 20000, tableSize: "6" as const },
        { name: "Heads Up", smallBlind: 10, bigBlind: 20, minBuyIn: 400, maxBuyIn: 2000, tableSize: "2" as const },
        { name: "Full Ring", smallBlind: 5, bigBlind: 10, minBuyIn: 200, maxBuyIn: 1000, tableSize: "9" as const },
      ];
      for (const t of defaultTables) {
        await db.insert(gameTables).values(t);
      }
    }

    // Seed default bot configs if empty
    const existingBots = await db.select().from(botConfigs);
    if (existingBots.length === 0) {
      for (let i = 0; i < DEFAULT_BOT_NAMES.length; i++) {
        await db.insert(botConfigs).values({
          name: DEFAULT_BOT_NAMES[i],
          avatar: DEFAULT_BOT_AVATARS[i],
          difficulty: (["beginner", "medium", "pro"] as const)[i % 3],
          personality: (["aggressive", "tight", "loose", "balanced"] as const)[i % 4],
        });
      }
    }
  }

  // ─── Join Table ────────────────────────────────────────
  private async handleJoinTable(socket: Socket, data: { tableId: number; userId: number; seatIndex?: number }) {
    console.log(`[WS] join_table received:`, data);
    const db = await getDb();
    if (!db) { console.log('[WS] No DB connection'); return; }

    const [tableConfig] = await db.select().from(gameTables).where(eq(gameTables.id, data.tableId));
    if (!tableConfig) {
      socket.emit("error", { message: "Table not found" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, data.userId));
    if (!user) {
      socket.emit("error", { message: "User not found" });
      return;
    }

    const maxSeats = parseInt(tableConfig.tableSize);
    let room = this.tables.get(data.tableId);

    if (!room) {
      const rakeConfig: RakeConfig = {
        percentage: (tableConfig.rakePercentage || 5) / 100,
        cap: tableConfig.rakeCap || tableConfig.bigBlind * 5,
        minPotForRake: tableConfig.bigBlind * 4,
      };

      const state: GameState = {
        tableId: data.tableId,
        phase: "waiting",
        communityCards: [],
        deck: [],
        players: [],
        pots: [],
        currentBet: 0,
        minRaise: tableConfig.bigBlind,
        dealerSeat: 0,
        smallBlindSeat: 0,
        bigBlindSeat: 0,
        actionSeat: -1,
        smallBlind: tableConfig.smallBlind,
        bigBlind: tableConfig.bigBlind,
        handNumber: 0,
        actionDeadline: 0,
        lastRaiserSeat: -1,
        raisesThisStreet: 0,
        rake: rakeConfig,
        rakeCollected: 0,
        totalPotBeforeRake: 0,
      };
      room = {
        state,
        sockets: new Map(),
        userSockets: new Map(),
        botTimers: new Map(),
        tableConfig,
      };
      this.tables.set(data.tableId, room);
    }

    // Reconnection check
    const existingPlayer = room.state.players.find(p => p.oddsUserId === data.userId && !p.isBot);
    if (existingPlayer) {
      console.log(`[WS] Player ${data.userId} reconnecting to seat ${existingPlayer.seatIndex} (was disconnected: ${existingPlayer.disconnected})`);
      existingPlayer.disconnected = false;
      room.sockets.set(existingPlayer.seatIndex, socket.id);
      room.userSockets.set(data.userId, socket.id);
      socket.join(`table_${data.tableId}`);
      (socket as any).__tableId = data.tableId;
      (socket as any).__seatIndex = existingPlayer.seatIndex;
      (socket as any).__userId = data.userId;
      socket.emit("seat_assigned", { seatIndex: existingPlayer.seatIndex });
      this.broadcastState(data.tableId);

      // If it's this player's turn, restart the action timer
      if (room.state.actionSeat === existingPlayer.seatIndex && !existingPlayer.folded) {
        console.log(`[WS] Restarting action timer for reconnected player at seat ${existingPlayer.seatIndex}`);
        this.startActionTimer(data.tableId);
      }
      return;
    }

    // Balance check
    if (user.balanceReal < tableConfig.minBuyIn) {
      socket.emit("error", { message: `Insufficient balance. Minimum buy-in: ${tableConfig.minBuyIn}` });
      return;
    }

    // Find seat
    const occupiedSeats = room.state.players.map(p => p.seatIndex);
    let seatIndex = data.seatIndex ?? -1;
    if (seatIndex === -1 || occupiedSeats.includes(seatIndex)) {
      for (let i = 0; i < maxSeats; i++) {
        if (!occupiedSeats.includes(i)) { seatIndex = i; break; }
      }
    }
    if (seatIndex === -1 || occupiedSeats.includes(seatIndex)) {
      // If table is full, try to remove a bot to make room for human player
      const botToRemove = room.state.players.find(p => p.isBot && p.folded);
      const botToRemoveAny = botToRemove || room.state.players.find(p => p.isBot);
      if (botToRemoveAny) {
        console.log(`[WS] Removing bot ${botToRemoveAny.name} (seat ${botToRemoveAny.seatIndex}) to make room for human player`);
        const botTimer = room.botTimers.get(botToRemoveAny.seatIndex);
        if (botTimer) { clearTimeout(botTimer); room.botTimers.delete(botToRemoveAny.seatIndex); }
        room.state.players = room.state.players.filter(p => p.seatIndex !== botToRemoveAny.seatIndex);
        seatIndex = botToRemoveAny.seatIndex;
      } else {
        socket.emit("error", { message: "Table is full" });
        return;
      }
    }

    // Buy in
    const buyIn = Math.min(tableConfig.maxBuyIn, user.balanceReal);
    await db.update(users).set({ balanceReal: sql`balanceReal - ${buyIn}` }).where(eq(users.id, data.userId));
    await db.insert(transactions).values({
      userId: data.userId, type: "buy_in", amount: -buyIn, status: "completed",
      note: `Buy-in at ${tableConfig.name}`,
    });

    const player: PlayerState = {
      oddsUserId: data.userId,
      seatIndex,
      name: user.nickname || user.name || "Player",
      avatar: user.avatar || "fox",
      chipStack: buyIn,
      currentBet: 0,
      totalBetThisHand: 0,
      holeCards: [],
      folded: true,
      allIn: false,
      isBot: false,
      lastAction: undefined,
      disconnected: false,
      sittingOut: false,
      hasActedThisRound: false,
    };

    room.state.players.push(player);
    room.sockets.set(seatIndex, socket.id);
    room.userSockets.set(data.userId, socket.id);

    socket.join(`table_${data.tableId}`);
    (socket as any).__tableId = data.tableId;
    (socket as any).__seatIndex = seatIndex;
    (socket as any).__userId = data.userId;
    socket.emit("seat_assigned", { seatIndex });

    await db.update(gameTables).set({
      playerCount: room.state.players.filter(p => !p.isBot).length,
      status: "waiting",
    }).where(eq(gameTables.id, data.tableId));

    // Fill with bots if enabled
    if (tableConfig.botsEnabled) {
      await this.fillBotsIfNeeded(room, maxSeats, tableConfig);
    }

    this.broadcastState(data.tableId);

    const activePlayers = room.state.players.filter(p => p.chipStack > 0);
    if (activePlayers.length >= 2 && room.state.phase === "waiting") {
      this.startNewHand(data.tableId);
    }
  }

  // ─── Bot Management ────────────────────────────────────
  private async fillBotsIfNeeded(room: TableRoom, maxSeats: number, tableConfig?: any) {
    const currentCount = room.state.players.length;
    const targetBots = tableConfig?.botCount ?? 2;
    const currentBots = room.state.players.filter(p => p.isBot).length;
    const botsNeeded = Math.max(0, Math.min(targetBots, maxSeats - currentCount));
    if (botsNeeded <= 0) return;

    const occupiedSeats = room.state.players.map(p => p.seatIndex);
    const heroSeat = room.state.players.find(p => !p.isBot)?.seatIndex ?? 0;
    const preferredOffsets = maxSeats <= 2 ? [1] : maxSeats <= 6 ? [2, 4, 3, 5, 1] : [3, 6, 1, 5, 2, 7, 4, 8];
    const preferredSeats = preferredOffsets.map(off => (heroSeat + off) % maxSeats);

    // Load bot configs from DB
    const db = await getDb();
    let botConfigList: any[] = [];
    if (db) {
      botConfigList = await db.select().from(botConfigs).where(eq(botConfigs.isActive, true));
    }

    for (let i = 0; i < botsNeeded; i++) {
      let seatIndex = -1;
      for (const ps of preferredSeats) {
        if (!occupiedSeats.includes(ps)) { seatIndex = ps; break; }
      }
      if (seatIndex === -1) {
        for (let s = 0; s < maxSeats; s++) {
          if (!occupiedSeats.includes(s)) { seatIndex = s; break; }
        }
      }
      if (seatIndex === -1) break;
      occupiedSeats.push(seatIndex);

      // Pick bot config
      const botIdx = (currentBots + i) % Math.max(1, botConfigList.length || DEFAULT_BOT_NAMES.length);
      const cfg = botConfigList[botIdx];

      let difficulty: "beginner" | "medium" | "pro" = "medium";
      if (tableConfig?.botDifficulty === "mixed") {
        difficulty = (["beginner", "medium", "pro"] as const)[Math.floor(Math.random() * 3)];
      } else if (tableConfig?.botDifficulty) {
        difficulty = tableConfig.botDifficulty as any;
      } else if (cfg) {
        difficulty = cfg.difficulty;
      }

      const bot: PlayerState = {
        oddsUserId: null,
        seatIndex,
        name: cfg?.name || DEFAULT_BOT_NAMES[botIdx % DEFAULT_BOT_NAMES.length],
        avatar: cfg?.avatar || DEFAULT_BOT_AVATARS[botIdx % DEFAULT_BOT_AVATARS.length],
        chipStack: room.state.bigBlind * 100,
        currentBet: 0,
        totalBetThisHand: 0,
        holeCards: [],
        folded: true,
        allIn: false,
        isBot: true,
        botDifficulty: difficulty,
        lastAction: undefined,
        disconnected: false,
        sittingOut: false,
        hasActedThisRound: false,
      };
      room.state.players.push(bot);
    }
  }

  // ─── Game Flow ─────────────────────────────────────────
  private startNewHand(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return;

    // Clear all timers
    this.clearAllTimers(room);

    room.state = createNewHand(room.state);
    if (room.state.phase === "waiting") return;

    console.log(`[Game] Table ${tableId} - Hand #${room.state.handNumber} started. Phase: ${room.state.phase}. Action on seat ${room.state.actionSeat}`);

    this.updateTableInDb(tableId, room.state);
    this.broadcastState(tableId);
    this.scheduleNextAction(tableId);
  }

  private scheduleNextAction(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room || room.state.phase === "waiting" || room.state.phase === "showdown") return;

    const actionPlayer = room.state.players.find(p => p.seatIndex === room.state.actionSeat);
    if (!actionPlayer) return;

    if (actionPlayer.isBot) {
      this.scheduleBotAction(tableId);
    } else {
      this.startActionTimer(tableId);
    }
  }

  private scheduleBotAction(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room || room.state.phase === "waiting" || room.state.phase === "showdown") return;

    const actionPlayer = room.state.players.find(p => p.seatIndex === room.state.actionSeat);
    if (!actionPlayer || !actionPlayer.isBot) return;

    const existingTimer = room.botTimers.get(actionPlayer.seatIndex);
    if (existingTimer) clearTimeout(existingTimer);

    const thinkTime = 800 + Math.random() * 1500;
    const timer = setTimeout(() => {
      try {
        const botAction = getBotAction(room.state, actionPlayer);
        console.log(`[Bot] ${actionPlayer.name} at table ${tableId}: ${botAction.action}${botAction.amount ? ` ${botAction.amount}` : ''}`);
        room.state = processAction(room.state, actionPlayer.seatIndex, botAction.action, botAction.amount);
        this.broadcastState(tableId);

        if (room.state.phase === "showdown") {
          this.handleShowdown(tableId);
        } else {
          this.scheduleNextAction(tableId);
        }
      } catch (e) {
        console.error(`[Bot] Error processing bot action:`, e);
        // Auto-fold on error
        room.state = processAction(room.state, actionPlayer.seatIndex, "fold");
        this.broadcastState(tableId);
        if (room.state.phase === "showdown") {
          this.handleShowdown(tableId);
        } else {
          this.scheduleNextAction(tableId);
        }
      }
    }, thinkTime);

    room.botTimers.set(actionPlayer.seatIndex, timer);
  }

  private startActionTimer(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return;

    if (room.actionTimer) clearTimeout(room.actionTimer);

    const actionPlayer = room.state.players.find(p => p.seatIndex === room.state.actionSeat);
    if (!actionPlayer || actionPlayer.isBot) return;

    room.actionTimer = setTimeout(() => {
      console.log(`[Timer] Auto-fold for seat ${room.state.actionSeat} at table ${tableId}`);
      room.state = processAction(room.state, room.state.actionSeat, "fold");
      this.broadcastState(tableId);

      if (room.state.phase === "showdown") {
        this.handleShowdown(tableId);
      } else {
        this.scheduleNextAction(tableId);
      }
    }, 30000);
  }

  private async handleShowdown(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return;

    console.log(`[Game] Table ${tableId} - Hand #${room.state.handNumber} showdown. Rake: ${room.state.rakeCollected}`);

    // Save hand history with rake
    await this.saveHandHistory(tableId, room.state);
    await this.updatePlayerStats(tableId, room.state);
    await this.recordRake(tableId, room.state);
    await this.distributeRakeback(tableId, room.state);

    this.broadcastState(tableId);

    // Start new hand after 4 seconds
    room.dealTimer = setTimeout(async () => {
      // Remove busted players
      room.state.players = room.state.players.filter(p => {
        if (p.chipStack <= 0) {
          if (!p.isBot && p.oddsUserId) {
            this.cashOutPlayer(p.oddsUserId, 0, tableId);
          }
          return false;
        }
        return true;
      });

      // Refill bots
      const maxSeats = parseInt(room.tableConfig?.tableSize || "6");
      if (room.tableConfig?.botsEnabled !== false) {
        await this.fillBotsIfNeeded(room, maxSeats, room.tableConfig);
      }

      if (room.state.players.filter(p => p.chipStack > 0).length >= 2) {
        this.startNewHand(tableId);
      } else {
        room.state.phase = "waiting";
        this.broadcastState(tableId);
      }
    }, 4000);
  }

  // ─── Player Actions ────────────────────────────────────
  private handlePlayerAction(socket: Socket, data: { tableId: number; action: string; amount?: number }) {
    const room = this.tables.get(data.tableId);
    if (!room) return;

    const seatIndex = (socket as any).__seatIndex;
    if (seatIndex === undefined || seatIndex !== room.state.actionSeat) {
      socket.emit("error", { message: "Not your turn" });
      return;
    }

    const validActions = ["fold", "check", "call", "raise", "allin"];
    if (!validActions.includes(data.action)) {
      socket.emit("error", { message: "Invalid action" });
      return;
    }

    if (room.actionTimer) clearTimeout(room.actionTimer);

    console.log(`[Player] Seat ${seatIndex} at table ${data.tableId}: ${data.action}${data.amount ? ` ${data.amount}` : ''}`);

    room.state = processAction(room.state, seatIndex, data.action as any, data.amount);
    this.broadcastState(data.tableId);

    if (room.state.phase === "showdown") {
      this.handleShowdown(data.tableId);
    } else {
      this.scheduleNextAction(data.tableId);
    }
  }

  // ─── Leave / Disconnect ────────────────────────────────
  private handleLeaveTable(socket: Socket, tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return;

    const seatIndex = (socket as any).__seatIndex;
    const userId = (socket as any).__userId;

    if (seatIndex !== undefined) {
      const player = room.state.players.find(p => p.seatIndex === seatIndex);
      if (player && !player.isBot && player.oddsUserId) {
        this.cashOutPlayer(player.oddsUserId, player.chipStack, tableId);
      }
      room.state.players = room.state.players.filter(p => p.seatIndex !== seatIndex);
      room.sockets.delete(seatIndex);
      if (userId) room.userSockets.delete(userId);
    }

    socket.leave(`table_${tableId}`);
    this.broadcastState(tableId);
  }

  private handleDisconnect(socket: Socket) {
    const tableId = (socket as any).__tableId;
    const seatIndex = (socket as any).__seatIndex;
    const disconnectedSocketId = socket.id;

    console.log(`[WS] Client disconnected: ${disconnectedSocketId} (table: ${tableId}, seat: ${seatIndex})`);

    if (tableId !== undefined && seatIndex !== undefined) {
      const room = this.tables.get(tableId);
      if (room) {
        // Only mark as disconnected if this socket is still the current one for this seat
        // (prevents marking reconnected player as disconnected when old socket fires disconnect)
        const currentSocketForSeat = room.sockets.get(seatIndex);
        if (currentSocketForSeat !== disconnectedSocketId) {
          console.log(`[WS] Ignoring stale disconnect for seat ${seatIndex} (current socket: ${currentSocketForSeat}, disconnected: ${disconnectedSocketId})`);
          return;
        }

        const player = room.state.players.find(p => p.seatIndex === seatIndex);
        if (player) {
          player.disconnected = true;
          // Auto-fold if it's their turn and they disconnect
          if (room.state.actionSeat === seatIndex && !player.folded && !player.isBot) {
            console.log(`[Timer] Auto-fold disconnected player at seat ${seatIndex}`);
            room.state = processAction(room.state, seatIndex, "fold");
            if (room.state.phase === "showdown") {
              this.handleShowdown(tableId);
            } else {
              this.scheduleNextAction(tableId);
            }
          }
          setTimeout(() => {
            // Check again that the player is still disconnected AND the socket hasn't been replaced
            if (player.disconnected && room.sockets.get(seatIndex) === disconnectedSocketId) {
              console.log(`[WS] Removing disconnected player from seat ${seatIndex} after timeout`);
              if (player.oddsUserId) {
                this.cashOutPlayer(player.oddsUserId, player.chipStack, tableId);
              }
              room.state.players = room.state.players.filter(p => p.seatIndex !== seatIndex);
              room.sockets.delete(seatIndex);
              this.broadcastState(tableId);
            }
          }, 60000);
        }
        this.broadcastState(tableId);
      }
    }
  }

  // ─── Financial Operations ──────────────────────────────
  private async cashOutPlayer(userId: number, chips: number, tableId: number) {
    const db = await getDb();
    if (!db || chips <= 0) return;

    await db.update(users).set({ balanceReal: sql`balanceReal + ${chips}` }).where(eq(users.id, userId));
    await db.insert(transactions).values({
      userId, type: "cash_out", amount: chips, status: "completed",
      note: `Cash out from table ${tableId}`,
    });
  }

  private async recordRake(tableId: number, state: GameState) {
    if (state.rakeCollected <= 0) return;
    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(rakeLedger).values({
        tableId,
        handNumber: state.handNumber,
        potAmount: state.totalPotBeforeRake,
        rakeAmount: state.rakeCollected,
      });
    } catch (e) {
      console.error("[Rake] Failed to record:", e);
    }
  }

  private async distributeRakeback(tableId: number, state: GameState) {
    if (state.rakeCollected <= 0) return;
    const db = await getDb();
    if (!db) return;

    // Distribute rakeback to human players who participated
    const humanPlayers = state.players.filter(p => !p.isBot && p.oddsUserId && p.totalBetThisHand > 0);
    if (humanPlayers.length === 0) return;

    // Each player gets rakeback proportional to their contribution
    const totalBets = humanPlayers.reduce((s, p) => s + p.totalBetThisHand, 0);

    for (const p of humanPlayers) {
      if (!p.oddsUserId) continue;
      try {
        const [userRow] = await db.select().from(users).where(eq(users.id, p.oddsUserId));
        if (!userRow) continue;

        const rakeShare = Math.floor(state.rakeCollected * (p.totalBetThisHand / totalBets));
        const rakebackPct = (userRow.rakebackPercentage || 10) / 100;
        const rakebackAmount = Math.floor(rakeShare * rakebackPct);

        if (rakebackAmount > 0) {
          await db.update(users).set({
            rakebackBalance: sql`rakebackBalance + ${rakebackAmount}`,
            totalRakeGenerated: sql`totalRakeGenerated + ${rakeShare}`,
          }).where(eq(users.id, p.oddsUserId));
        }
      } catch (e) {
        console.error("[Rakeback] Failed:", e);
      }
    }
  }

  // ─── DB Operations ─────────────────────────────────────
  private async saveHandHistory(tableId: number, state: GameState) {
    const db = await getDb();
    if (!db) return;

    const winners = state.players.filter(p => p.lastAction?.startsWith("WIN") || p.lastAction?.startsWith("SPLIT"));

    try {
      await db.insert(handHistory).values({
        tableId,
        handNumber: state.handNumber,
        handData: {
          players: state.players.map(p => ({
            name: p.name,
            seatIndex: p.seatIndex,
            holeCards: p.holeCards,
            chipStack: p.chipStack,
            lastAction: p.lastAction,
            isBot: p.isBot,
          })),
          communityCards: state.communityCards,
          pots: state.pots,
        },
        potTotal: state.totalPotBeforeRake,
        rakeAmount: state.rakeCollected,
        winnerId: winners[0]?.oddsUserId || null,
        winnerName: winners.map(w => w.name).join(", ") || null,
        winningHand: winners[0]?.lastAction?.replace(/^(WIN|SPLIT) - /, "") || null,
      });
    } catch (e) {
      console.error("[History] Failed to save:", e);
    }
  }

  private async updatePlayerStats(tableId: number, state: GameState) {
    const db = await getDb();
    if (!db) return;

    for (const p of state.players) {
      if (p.isBot || !p.oddsUserId) continue;
      const isWinner = p.lastAction?.startsWith("WIN") || p.lastAction?.startsWith("SPLIT");
      try {
        await db.update(users).set({
          handsPlayed: sql`handsPlayed + 1`,
          handsWon: isWinner ? sql`handsWon + 1` : sql`handsWon`,
        }).where(eq(users.id, p.oddsUserId));
      } catch (e) {
        console.error("[Stats] Failed:", e);
      }
    }
  }

  private async updateTableInDb(tableId: number, state: GameState) {
    const db = await getDb();
    if (!db) return;
    try {
      await db.update(gameTables).set({
        status: state.phase === "waiting" ? "waiting" : "playing",
        playerCount: state.players.filter(p => !p.isBot).length,
      }).where(eq(gameTables.id, tableId));
    } catch (e) {
      console.error("[Table] Failed to update:", e);
    }
  }

  // ─── Broadcast ─────────────────────────────────────────
  private broadcastState(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room || !this.io) return;

    const seatedSocketIds = new Set<string>();

    for (const [seatIndex, socketId] of Array.from(room.sockets.entries())) {
      seatedSocketIds.add(socketId);
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("game_state", sanitizeForPlayer(room.state, seatIndex));
      }
    }

    const roomSockets = this.io.sockets.adapter.rooms.get(`table_${tableId}`);
    if (roomSockets) {
      const spectatorState = sanitizeForPlayer(room.state, -1);
      for (const socketId of Array.from(roomSockets)) {
        if (!seatedSocketIds.has(socketId)) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit("spectator_state", spectatorState);
          }
        }
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────
  private clearAllTimers(room: TableRoom) {
    if (room.actionTimer) { clearTimeout(room.actionTimer); room.actionTimer = undefined; }
    if (room.dealTimer) { clearTimeout(room.dealTimer); room.dealTimer = undefined; }
    for (const [, timer] of Array.from(room.botTimers.entries())) {
      clearTimeout(timer);
    }
    room.botTimers.clear();
  }

  // ─── Public API for tRPC / Admin ───────────────────────
  getTableState(tableId: number, seatIndex: number) {
    const room = this.tables.get(tableId);
    if (!room) return null;
    return sanitizeForPlayer(room.state, seatIndex);
  }

  // Get game state for a specific user (finds their seat automatically)
  getTableStateForUser(tableId: number, userId: number) {
    const room = this.tables.get(tableId);
    if (!room) return null;
    const player = room.state.players.find(p => p.oddsUserId === userId);
    const seatIndex = player ? player.seatIndex : -1;
    return { state: sanitizeForPlayer(room.state, seatIndex), seatIndex };
  }

  // Process player action via HTTP (fallback for socket.io issues)
  processHttpAction(tableId: number, userId: number, action: string, amount?: number): { success: boolean; error?: string } {
    const room = this.tables.get(tableId);
    if (!room) return { success: false, error: "Table not found" };

    const player = room.state.players.find(p => p.oddsUserId === userId);
    if (!player) return { success: false, error: "Player not at table" };

    if (player.seatIndex !== room.state.actionSeat) {
      return { success: false, error: "Not your turn" };
    }

    const validActions = ["fold", "check", "call", "raise", "allin"];
    if (!validActions.includes(action)) {
      return { success: false, error: "Invalid action" };
    }

    if (room.actionTimer) clearTimeout(room.actionTimer);

    console.log(`[HTTP-Action] User ${userId} seat ${player.seatIndex} at table ${tableId}: ${action}${amount ? ` ${amount}` : ''}`);

    room.state = processAction(room.state, player.seatIndex, action as any, amount);
    this.broadcastState(tableId);

    if (room.state.phase === "showdown") {
      this.handleShowdown(tableId);
    } else {
      this.scheduleNextAction(tableId);
    }

    return { success: true };
  }

  // Join table via HTTP (fallback)
  async httpJoinTable(tableId: number, userId: number): Promise<{ success: boolean; seatIndex?: number; error?: string }> {
    const db = await getDb();
    if (!db) return { success: false, error: "No DB" };

    const [tableConfig] = await db.select().from(gameTables).where(eq(gameTables.id, tableId));
    if (!tableConfig) return { success: false, error: "Table not found" };

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return { success: false, error: "User not found" };

    const maxSeats = parseInt(tableConfig.tableSize);
    let room = this.tables.get(tableId);

    // Check if user is already at the table
    if (room) {
      const existingPlayer = room.state.players.find(p => p.oddsUserId === userId);
      if (existingPlayer) {
        existingPlayer.disconnected = false;
        return { success: true, seatIndex: existingPlayer.seatIndex };
      }
    }

    if (!room) {
      const rakeConfig: RakeConfig = {
        percentage: (tableConfig.rakePercentage || 5) / 100,
        cap: tableConfig.rakeCap || tableConfig.bigBlind * 5,
        minPotForRake: tableConfig.bigBlind * 4,
      };
      room = {
        state: {
          tableId,
          phase: "waiting" as const,
          communityCards: [],
          deck: [],
          currentBet: 0,
          minRaise: tableConfig.bigBlind,
          dealerSeat: 0,
          smallBlindSeat: 0,
          bigBlindSeat: 0,
          actionSeat: -1,
          smallBlind: tableConfig.smallBlind,
          bigBlind: tableConfig.bigBlind,
          handNumber: 0,
          actionDeadline: 0,
          players: [],
          pots: [{ amount: 0, eligiblePlayerIds: [] }],
          rake: rakeConfig,
          rakeCollected: 0,
          lastRaiserSeat: -1,
          raisesThisStreet: 0,
          totalPotBeforeRake: 0,
        },
        sockets: new Map(),
        userSockets: new Map(),
        botTimers: new Map(),
        tableConfig,
      };
      this.tables.set(tableId, room);
    }

    // Find an empty seat
    const occupiedSeats = room.state.players.map(p => p.seatIndex);
    let seatIndex = -1;

    // Remove a bot to make room
    const bots = room.state.players.filter(p => p.isBot);
    if (occupiedSeats.length >= maxSeats && bots.length > 0) {
      const botToRemove = bots[bots.length - 1];
      room.state.players = room.state.players.filter(p => p.seatIndex !== botToRemove.seatIndex);
      seatIndex = botToRemove.seatIndex;
    } else {
      for (let s = 0; s < maxSeats; s++) {
        if (!occupiedSeats.includes(s)) { seatIndex = s; break; }
      }
    }

    if (seatIndex === -1) return { success: false, error: "Table full" };

    const buyIn = Math.min(user.balanceReal || 0, tableConfig.maxBuyIn || tableConfig.bigBlind * 100);
    if (buyIn < (tableConfig.minBuyIn || tableConfig.bigBlind * 20)) {
      return { success: false, error: "Insufficient balance" };
    }

    // Deduct buy-in
    await db.update(users).set({ balanceReal: sql`balanceReal - ${buyIn}` }).where(eq(users.id, userId));

    const newPlayer: PlayerState = {
      oddsUserId: userId,
      seatIndex,
      name: user.nickname || user.name || `Player_${userId}`,
      avatar: user.avatar || "default",
      chipStack: buyIn,
      currentBet: 0,
      totalBetThisHand: 0,
      holeCards: [],
      folded: true,
      allIn: false,
      isBot: false,
      lastAction: undefined,
      disconnected: false,
      sittingOut: false,
      hasActedThisRound: false,
    };
    room.state.players.push(newPlayer);

    // Fill bots if needed
    if (tableConfig.botsEnabled !== false) {
      await this.fillBotsIfNeeded(room, maxSeats, tableConfig);
    }

    this.broadcastState(tableId);

    // Start game if enough players
    const activePlayers = room.state.players.filter(p => p.chipStack > 0);
    if (activePlayers.length >= 2 && room.state.phase === "waiting") {
      this.startNewHand(tableId);
    }

    return { success: true, seatIndex };
  }

  getAdminTableState(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return null;
    return sanitizeForAdmin(room.state);
  }

  getAllActiveTableIds(): number[] {
    return Array.from(this.tables.keys());
  }

  getActiveTableCount(): number {
    return this.tables.size;
  }

  getOnlinePlayerCount(): number {
    let count = 0;
    for (const room of Array.from(this.tables.values())) {
      count += room.state.players.filter((p: PlayerState) => !p.isBot && !p.disconnected).length;
    }
    return count;
  }

  // Admin: get all table states for monitoring
  getAllTableStates(): any[] {
    const result: any[] = [];
    for (const [tableId, room] of Array.from(this.tables.entries())) {
      result.push({
        tableId,
        phase: room.state.phase,
        handNumber: room.state.handNumber,
        playerCount: room.state.players.length,
        humanCount: room.state.players.filter(p => !p.isBot).length,
        botCount: room.state.players.filter(p => p.isBot).length,
        totalPot: room.state.pots.reduce((s, p) => s + p.amount, 0) +
          room.state.players.reduce((s, p) => s + p.currentBet, 0),
        rakeCollected: room.state.rakeCollected,
      });
    }
    return result;
  }

  // Admin: add/remove bots from a specific table
  async adminAddBot(tableId: number, botName?: string, difficulty?: string): Promise<boolean> {
    const room = this.tables.get(tableId);
    if (!room) return false;

    const maxSeats = parseInt(room.tableConfig?.tableSize || "6");
    const occupiedSeats = room.state.players.map(p => p.seatIndex);
    let seatIndex = -1;
    for (let s = 0; s < maxSeats; s++) {
      if (!occupiedSeats.includes(s)) { seatIndex = s; break; }
    }
    if (seatIndex === -1) return false;

    const botIdx = room.state.players.filter(p => p.isBot).length;
    const bot: PlayerState = {
      oddsUserId: null,
      seatIndex,
      name: botName || DEFAULT_BOT_NAMES[botIdx % DEFAULT_BOT_NAMES.length],
      avatar: DEFAULT_BOT_AVATARS[botIdx % DEFAULT_BOT_AVATARS.length],
      chipStack: room.state.bigBlind * 100,
      currentBet: 0,
      totalBetThisHand: 0,
      holeCards: [],
      folded: true,
      allIn: false,
      isBot: true,
      botDifficulty: (difficulty as any) || "medium",
      lastAction: undefined,
      disconnected: false,
      sittingOut: false,
      hasActedThisRound: false,
    };
    room.state.players.push(bot);
    this.broadcastState(tableId);
    return true;
  }

  async adminRemoveBot(tableId: number, seatIndex: number): Promise<boolean> {
    const room = this.tables.get(tableId);
    if (!room) return false;

    const player = room.state.players.find(p => p.seatIndex === seatIndex && p.isBot);
    if (!player) return false;

    room.state.players = room.state.players.filter(p => p.seatIndex !== seatIndex);
    this.broadcastState(tableId);
    return true;
  }

  // Admin: force start a new hand
  adminForceNewHand(tableId: number): boolean {
    const room = this.tables.get(tableId);
    if (!room) return false;
    this.clearAllTimers(room);
    room.state.phase = "waiting";
    if (room.state.players.filter(p => p.chipStack > 0).length >= 2) {
      this.startNewHand(tableId);
      return true;
    }
    return false;
  }
}

// Singleton
export const gameManager = new GameManager();
