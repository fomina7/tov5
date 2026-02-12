/**
 * Game Manager — manages all active poker tables via WebSocket
 * Each table has its own GameState. Players connect via socket.io.
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
  createDeck,
} from "./pokerEngine";
import { getDb } from "./db";
import { gameTables, tablePlayers, handHistory, users, transactions } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

const BOT_NAMES = ["AlphaBot", "PokerMind", "CardShark", "BluffMaster", "ChipKing", "AceHunter", "RiverRat", "NutCrusher"];
const BOT_AVATARS = [
  "fox", "shark", "owl", "cat", "bear", "monkey", "wolf", "penguin"
];

interface TableRoom {
  state: GameState;
  sockets: Map<number, string>; // seatIndex -> socketId
  userSockets: Map<number, string>; // userId -> socketId
  botTimers: Map<number, NodeJS.Timeout>;
  dealTimer?: NodeJS.Timeout;
  actionTimer?: NodeJS.Timeout;
}

class GameManager {
  private io: SocketServer | null = null;
  private tables: Map<number, TableRoom> = new Map();

  init(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      path: "/api/socket.io",
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

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });

    // Initialize default tables
    this.initDefaultTables();
  }

  private async initDefaultTables() {
    const db = await getDb();
    if (!db) return;

    // Check if tables exist
    const existing = await db.select().from(gameTables);
    if (existing.length === 0) {
      // Create default tables
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
  }

  private async handleJoinTable(socket: Socket, data: { tableId: number; userId: number; seatIndex?: number }) {
    const db = await getDb();
    if (!db) return;

    // Get table config
    const [tableConfig] = await db.select().from(gameTables).where(eq(gameTables.id, data.tableId));
    if (!tableConfig) {
      socket.emit("error", { message: "Table not found" });
      return;
    }

    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, data.userId));
    if (!user) {
      socket.emit("error", { message: "User not found" });
      return;
    }

    // Check balance
    if (user.balanceReal < tableConfig.minBuyIn) {
      socket.emit("error", { message: "Insufficient balance. Minimum buy-in: " + tableConfig.minBuyIn });
      return;
    }

    const maxSeats = parseInt(tableConfig.tableSize);
    let room = this.tables.get(data.tableId);

    if (!room) {
      // Create new room
      const state: GameState = {
        tableId: data.tableId,
        phase: "waiting",
        communityCards: [],
        deck: [],
        players: [],
        pots: [{ amount: 0, eligiblePlayerIds: [] }],
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
        roundActionCount: 0,
      };
      room = {
        state,
        sockets: new Map(),
        userSockets: new Map(),
        botTimers: new Map(),
      };
      this.tables.set(data.tableId, room);
    }

    // Find seat
    const occupiedSeats = room.state.players.map(p => p.seatIndex);
    let seatIndex = data.seatIndex ?? -1;
    if (seatIndex === -1 || occupiedSeats.includes(seatIndex)) {
      // Find first available seat
      for (let i = 0; i < maxSeats; i++) {
        if (!occupiedSeats.includes(i)) {
          seatIndex = i;
          break;
        }
      }
    }

    if (seatIndex === -1 || occupiedSeats.includes(seatIndex)) {
      socket.emit("error", { message: "Table is full" });
      return;
    }

    // Buy in (take from balance)
    const buyIn = Math.min(tableConfig.maxBuyIn, user.balanceReal);
    await db.update(users).set({
      balanceReal: sql`balanceReal - ${buyIn}`,
    }).where(eq(users.id, data.userId));

    // Record transaction
    await db.insert(transactions).values({
      userId: data.userId,
      type: "buy_in",
      amount: -buyIn,
      status: "completed",
      note: `Buy-in at ${tableConfig.name}`,
    });

    // Add player to game state
    const player: PlayerState = {
      oddsId: room.state.players.length,
      oddsUserId: data.userId,
      seatIndex,
      name: user.nickname || user.name || "Player",
      avatar: user.avatar || "fox",
      chipStack: buyIn,
      currentBet: 0,
      holeCards: [],
      folded: true,
      allIn: false,
      isBot: false,
      lastAction: undefined,
      disconnected: false,
      sittingOut: false,
    };

    room.state.players.push(player);
    room.sockets.set(seatIndex, socket.id);
    room.userSockets.set(data.userId, socket.id);

    // Join socket room
    socket.join(`table_${data.tableId}`);
    (socket as any).__tableId = data.tableId;
    (socket as any).__seatIndex = seatIndex;
    (socket as any).__userId = data.userId;

    // Update DB
    await db.update(gameTables).set({
      playerCount: room.state.players.filter(p => !p.isBot).length,
      status: "waiting",
    }).where(eq(gameTables.id, data.tableId));

    // Fill with bots if needed
    await this.fillBotsIfNeeded(room, maxSeats);

    // Broadcast state
    this.broadcastState(data.tableId);

    // Start game if enough players
    const activePlayers = room.state.players.filter(p => p.chipStack > 0);
    if (activePlayers.length >= 2 && room.state.phase === "waiting") {
      this.startNewHand(data.tableId);
    }
  }

  private async fillBotsIfNeeded(room: TableRoom, maxSeats: number) {
    const humanCount = room.state.players.filter(p => !p.isBot).length;
    const currentCount = room.state.players.length;

    // Add bots to fill at least 3 seats (or up to maxSeats - 1)
    const botsNeeded = Math.max(0, Math.min(3, maxSeats) - currentCount);
    const occupiedSeats = room.state.players.map(p => p.seatIndex);

    for (let i = 0; i < botsNeeded; i++) {
      let seatIndex = -1;
      for (let s = 0; s < maxSeats; s++) {
        if (!occupiedSeats.includes(s)) {
          seatIndex = s;
          occupiedSeats.push(s);
          break;
        }
      }
      if (seatIndex === -1) break;

      const botIdx = (currentCount + i) % BOT_NAMES.length;
      const difficulties: Array<"beginner" | "medium" | "pro"> = ["beginner", "medium", "pro"];
      const bot: PlayerState = {
        oddsId: room.state.players.length,
        oddsUserId: null,
        seatIndex,
        name: BOT_NAMES[botIdx],
        avatar: BOT_AVATARS[botIdx],
        chipStack: room.state.bigBlind * 100,
        currentBet: 0,
        holeCards: [],
        folded: true,
        allIn: false,
        isBot: true,
        botDifficulty: difficulties[Math.floor(Math.random() * 3)],
        lastAction: undefined,
        disconnected: false,
        sittingOut: false,
      };
      room.state.players.push(bot);
    }
  }

  private startNewHand(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return;

    room.state = createNewHand(room.state);

    if (room.state.phase === "waiting") return;

    // Update DB
    this.updateTableInDb(tableId, room.state);

    // Broadcast
    this.broadcastState(tableId);

    // If action is on a bot, schedule bot action
    this.scheduleBotAction(tableId);

    // Start action timer
    this.startActionTimer(tableId);
  }

  private scheduleBotAction(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room || room.state.phase === "waiting" || room.state.phase === "showdown") return;

    const actionPlayer = room.state.players.find(p => p.seatIndex === room.state.actionSeat);
    if (!actionPlayer || !actionPlayer.isBot) return;

    // Clear existing timer
    const existingTimer = room.botTimers.get(actionPlayer.seatIndex);
    if (existingTimer) clearTimeout(existingTimer);

    // Bot thinks for 1-3 seconds
    const thinkTime = 1000 + Math.random() * 2000;
    const timer = setTimeout(() => {
      const botAction = getBotAction(room.state, actionPlayer);
      room.state = processAction(room.state, actionPlayer.seatIndex, botAction.action, botAction.amount);

      this.broadcastState(tableId);

      if (room.state.phase === "showdown") {
        this.handleShowdown(tableId);
      } else {
        this.scheduleBotAction(tableId);
        this.startActionTimer(tableId);
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

    // 30 second timer for human players
    room.actionTimer = setTimeout(() => {
      // Auto-fold on timeout
      room.state = processAction(room.state, room.state.actionSeat, "fold");
      this.broadcastState(tableId);

      if (room.state.phase === "showdown") {
        this.handleShowdown(tableId);
      } else {
        this.scheduleBotAction(tableId);
        this.startActionTimer(tableId);
      }
    }, 30000);
  }

  private handleShowdown(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return;

    // Save hand history
    this.saveHandHistory(tableId, room.state);

    // Update player stats in DB
    this.updatePlayerStats(tableId, room.state);

    // Broadcast final state
    this.broadcastState(tableId);

    // Start new hand after 4 seconds
    room.dealTimer = setTimeout(() => {
      // Remove busted players
      room.state.players = room.state.players.filter(p => {
        if (p.chipStack <= 0) {
          if (!p.isBot && p.oddsUserId) {
            // Return 0 chips (they busted)
            this.cashOutPlayer(p.oddsUserId, 0, tableId);
          }
          return false;
        }
        return true;
      });

      // Refill bots if needed
      const maxSeats = 6; // TODO: get from table config
      this.fillBotsIfNeeded(room, maxSeats);

      if (room.state.players.filter(p => p.chipStack > 0).length >= 2) {
        this.startNewHand(tableId);
      } else {
        room.state.phase = "waiting";
        this.broadcastState(tableId);
      }
    }, 4000);
  }

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

    // Clear action timer
    if (room.actionTimer) clearTimeout(room.actionTimer);

    room.state = processAction(
      room.state,
      seatIndex,
      data.action as any,
      data.amount
    );

    this.broadcastState(data.tableId);

    if (room.state.phase === "showdown") {
      this.handleShowdown(data.tableId);
    } else {
      this.scheduleBotAction(data.tableId);
      this.startActionTimer(data.tableId);
    }
  }

  private handleLeaveTable(socket: Socket, tableId: number) {
    const room = this.tables.get(tableId);
    if (!room) return;

    const seatIndex = (socket as any).__seatIndex;
    const userId = (socket as any).__userId;

    if (seatIndex !== undefined) {
      const player = room.state.players.find(p => p.seatIndex === seatIndex);
      if (player && !player.isBot && player.oddsUserId) {
        // Cash out remaining chips
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

    if (tableId !== undefined && seatIndex !== undefined) {
      const room = this.tables.get(tableId);
      if (room) {
        const player = room.state.players.find(p => p.seatIndex === seatIndex);
        if (player) {
          player.disconnected = true;
          // Give 60 seconds to reconnect, then auto-fold and cash out
          setTimeout(() => {
            if (player.disconnected) {
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

  private async cashOutPlayer(userId: number, chips: number, tableId: number) {
    const db = await getDb();
    if (!db || chips <= 0) return;

    await db.update(users).set({
      balanceReal: sql`balanceReal + ${chips}`,
    }).where(eq(users.id, userId));

    await db.insert(transactions).values({
      userId,
      type: "cash_out",
      amount: chips,
      status: "completed",
      note: `Cash out from table ${tableId}`,
    });
  }

  private async saveHandHistory(tableId: number, state: GameState) {
    const db = await getDb();
    if (!db) return;

    const winner = state.players.find(p => p.lastAction?.startsWith("WIN"));
    const totalPot = state.pots.reduce((s, p) => s + p.amount, 0) +
      state.players.reduce((s, p) => s + p.currentBet, 0);

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
          })),
          communityCards: state.communityCards,
          pots: state.pots,
        },
        potTotal: totalPot,
        winnerId: winner?.oddsUserId || null,
        winnerName: winner?.name || null,
        winningHand: winner?.lastAction?.replace("WIN - ", "") || null,
      });
    } catch (e) {
      console.error("[GameManager] Failed to save hand history:", e);
    }
  }

  private async updatePlayerStats(tableId: number, state: GameState) {
    const db = await getDb();
    if (!db) return;

    for (const p of state.players) {
      if (p.isBot || !p.oddsUserId) continue;

      const isWinner = p.lastAction?.startsWith("WIN");
      try {
        await db.update(users).set({
          handsPlayed: sql`handsPlayed + 1`,
          handsWon: isWinner ? sql`handsWon + 1` : sql`handsWon`,
        }).where(eq(users.id, p.oddsUserId));
      } catch (e) {
        console.error("[GameManager] Failed to update stats:", e);
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
      console.error("[GameManager] Failed to update table:", e);
    }
  }

  private broadcastState(tableId: number) {
    const room = this.tables.get(tableId);
    if (!room || !this.io) return;

    // Send personalized state to each player
    for (const [seatIndex, socketId] of Array.from(room.sockets.entries())) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("game_state", sanitizeForPlayer(room.state, seatIndex));
      }
    }

    // Also broadcast a spectator view (no hole cards)
    this.io.to(`table_${tableId}`).emit("spectator_state", sanitizeForPlayer(room.state, -1));
  }

  // ─── Public API for tRPC ───────────────────────────────
  getTableState(tableId: number, seatIndex: number) {
    const room = this.tables.get(tableId);
    if (!room) return null;
    return sanitizeForPlayer(room.state, seatIndex);
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
}

// Singleton
export const gameManager = new GameManager();
