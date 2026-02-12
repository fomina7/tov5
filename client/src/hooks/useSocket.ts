/**
 * useSocket — WebSocket hook for real-time poker game
 * Connects to the server via socket.io for live game state updates
 * Includes reconnection handling, heartbeat, and state sync
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ServerPlayer {
  seatIndex: number;
  name: string;
  avatar: string;
  chipStack: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  isBot: boolean;
  lastAction?: string;
  disconnected: boolean;
  sittingOut: boolean;
  holeCards: { suit: string; rank: string }[];
  userId: number | null;
}

export interface ServerGameState {
  tableId: number;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  communityCards: { suit: string; rank: string }[];
  currentBet: number;
  minRaise: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  actionSeat: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  actionDeadline: number;
  pots: { amount: number; eligiblePlayerIds: number[] }[];
  players: ServerPlayer[];
  mySeatIndex: number; // Server tells us which seat is ours
  serverTime: number;  // Server timestamp for timer sync
  totalPot?: number;
  rakeCollected?: number;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ socketId: string; message: string; timestamp: number }[]>([]);
  // Track server-client time offset for accurate timer
  const timeOffsetRef = useRef<number>(0);
  // Track the pending join info for auto-rejoin on reconnect
  const pendingJoinRef = useRef<{ tableId: number; userId: number } | null>(null);
  // Track reconnection count
  const reconnectCountRef = useRef(0);

  useEffect(() => {
    const socket = io({
      path: '/api/socket.io',
      transports: ['polling'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      setConnected(true);
      setError(null);

      // Auto-rejoin table on reconnect
      if (pendingJoinRef.current) {
        reconnectCountRef.current++;
        console.log(`[WS] Auto-rejoining table ${pendingJoinRef.current.tableId} (reconnect #${reconnectCountRef.current})`);
        socket.emit('join_table', pendingJoinRef.current);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.log('[WS] Connection error:', err.message);
    });

    // Server confirms our seat assignment
    socket.on('seat_assigned', (data: { seatIndex: number }) => {
      console.log('[WS] Seat assigned:', data.seatIndex);
      setMySeatIndex(data.seatIndex);
    });

    // Personalized game state (includes our hole cards)
    socket.on('game_state', (state: ServerGameState) => {
      // Calculate time offset between server and client
      if (state.serverTime) {
        timeOffsetRef.current = Date.now() - state.serverTime;
      }
      // Use mySeatIndex from server
      if (state.mySeatIndex !== undefined && state.mySeatIndex >= 0) {
        setMySeatIndex(state.mySeatIndex);
      }
      setGameState(state);
    });

    // Spectator state — used if we're not seated
    // Always accept spectator state if we don't have a personalized game_state
    socket.on('spectator_state', (state: ServerGameState) => {
      setGameState(prev => {
        // If we have a personalized state for the same hand, keep it
        // But if the spectator state is for a newer hand, accept it
        if (prev && prev.mySeatIndex >= 0 && prev.handNumber >= state.handNumber) {
          return prev;
        }
        return state;
      });
    });

    socket.on('error', (data: { message: string }) => {
      console.log('[WS] Error:', data.message);
      setError(data.message);
    });

    socket.on('chat_message', (msg: { socketId: string; message: string; timestamp: number }) => {
      setChatMessages(prev => [...prev.slice(-50), msg]);
    });

    // Periodic state request to prevent stale state
    const stateRefreshInterval = setInterval(() => {
      if (socket.connected && pendingJoinRef.current) {
        socket.emit('request_state', { tableId: pendingJoinRef.current.tableId });
      }
    }, 10000); // Every 10 seconds

    return () => {
      clearInterval(stateRefreshInterval);
      socket.disconnect();
    };
  }, []);

  const joinTable = useCallback((tableId: number, userId: number, seatIndex?: number) => {
    // Save join info for auto-rejoin on reconnect
    pendingJoinRef.current = { tableId, userId };
    if (socketRef.current) {
      socketRef.current.emit('join_table', { tableId, userId, seatIndex });
    }
  }, []);

  const leaveTable = useCallback((tableId: number) => {
    pendingJoinRef.current = null; // Clear auto-rejoin
    if (socketRef.current) {
      socketRef.current.emit('leave_table', { tableId });
      setGameState(null);
      setMySeatIndex(-1);
    }
  }, []);

  const sendAction = useCallback((tableId: number, action: string, amount?: number) => {
    if (socketRef.current) {
      socketRef.current.emit('player_action', { tableId, action, amount });
    }
  }, []);

  const sendChat = useCallback((tableId: number, message: string) => {
    if (socketRef.current) {
      socketRef.current.emit('chat_message', { tableId, message });
    }
  }, []);

  return {
    connected,
    gameState,
    mySeatIndex,
    error,
    chatMessages,
    timeOffset: timeOffsetRef.current,
    joinTable,
    leaveTable,
    sendAction,
    sendChat,
  };
}
