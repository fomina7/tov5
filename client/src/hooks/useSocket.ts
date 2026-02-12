/**
 * useSocket — HTTP-first game hook for real-time poker
 * Uses HTTP polling as primary transport (works reliably on Railway HTTP/2)
 * Socket.io is used as optional enhancement for faster updates when available
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
  mySeatIndex: number;
  serverTime: number;
  totalPot?: number;
  rakeCollected?: number;
}

function getAuthToken(): string | null {
  return localStorage.getItem('poker_jwt_token');
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ socketId: string; message: string; timestamp: number }[]>([]);
  const timeOffsetRef = useRef<number>(0);
  const pendingJoinRef = useRef<{ tableId: number; userId: number } | null>(null);
  const httpPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedViaHttpRef = useRef(false);
  const lastHandNumberRef = useRef(0);
  const socketWorking = useRef(false);

  // HTTP polling for game state - this is the PRIMARY transport
  const fetchGameState = useCallback(async (tableId: number) => {
    try {
      const headers = getAuthHeaders();
      if (!headers['Authorization']) return;

      const res = await fetch(`/api/game/${tableId}/state`, { headers });
      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Please login again.');
        }
        return;
      }
      const data = await res.json();
      if (data.state) {
        // Calculate time offset
        if (data.state.serverTime) {
          timeOffsetRef.current = Date.now() - data.state.serverTime;
        }
        if (data.seatIndex !== undefined && data.seatIndex >= 0) {
          setMySeatIndex(data.seatIndex);
        }
        if (data.state.mySeatIndex !== undefined && data.state.mySeatIndex >= 0) {
          setMySeatIndex(data.state.mySeatIndex);
        }

        setGameState(prev => {
          // Always accept newer state
          if (!prev) return data.state;
          // Accept if hand number is newer or phase changed
          if (data.state.handNumber > prev.handNumber ||
              data.state.phase !== prev.phase ||
              data.state.actionSeat !== prev.actionSeat ||
              JSON.stringify(data.state.communityCards) !== JSON.stringify(prev.communityCards)) {
            return data.state;
          }
          // Accept if players changed (bet amounts, fold status, etc.)
          const prevBets = prev.players.map(p => `${p.seatIndex}:${p.currentBet}:${p.folded}:${p.chipStack}`).join(',');
          const newBets = data.state.players.map((p: ServerPlayer) => `${p.seatIndex}:${p.currentBet}:${p.folded}:${p.chipStack}`).join(',');
          if (prevBets !== newBets) return data.state;
          return prev;
        });

        // Track hand number for logging
        if (data.state.handNumber !== lastHandNumberRef.current) {
          lastHandNumberRef.current = data.state.handNumber;
          console.log(`[HTTP] Hand #${data.state.handNumber}, Phase: ${data.state.phase}, Action: seat ${data.state.actionSeat}`);
        }

        setConnected(true);
        setError(null);
      }
    } catch (err) {
      console.warn('[HTTP] Failed to fetch game state:', err);
    }
  }, []);

  // Start HTTP polling for a table
  const startHttpPolling = useCallback((tableId: number) => {
    // Clear existing polling
    if (httpPollingRef.current) {
      clearInterval(httpPollingRef.current);
    }
    // Poll every 1.5 seconds - fast enough for poker, light on server
    httpPollingRef.current = setInterval(() => {
      fetchGameState(tableId);
    }, 1500);
    // Also fetch immediately
    fetchGameState(tableId);
  }, [fetchGameState]);

  const stopHttpPolling = useCallback(() => {
    if (httpPollingRef.current) {
      clearInterval(httpPollingRef.current);
      httpPollingRef.current = null;
    }
  }, []);

  // Try to set up socket.io as an enhancement (not required)
  useEffect(() => {
    const socket = io({
      path: '/api/socket.io',
      transports: ['polling'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5, // Don't try forever - HTTP polling is the fallback
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected (enhancement):', socket.id);
      socketWorking.current = true;

      // Re-join table via socket if we already joined via HTTP
      if (pendingJoinRef.current) {
        socket.emit('join_table', pendingJoinRef.current);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason, '(HTTP polling continues)');
      socketWorking.current = false;
    });

    socket.on('connect_error', (err) => {
      console.log('[WS] Connection error (HTTP polling active):', err.message);
      socketWorking.current = false;
    });

    socket.on('seat_assigned', (data: { seatIndex: number }) => {
      console.log('[WS] Seat assigned:', data.seatIndex);
      setMySeatIndex(data.seatIndex);
    });

    // Socket game state - use it if available (faster than polling)
    socket.on('game_state', (state: ServerGameState) => {
      if (state.serverTime) {
        timeOffsetRef.current = Date.now() - state.serverTime;
      }
      if (state.mySeatIndex !== undefined && state.mySeatIndex >= 0) {
        setMySeatIndex(state.mySeatIndex);
      }
      setGameState(state);
    });

    socket.on('spectator_state', (state: ServerGameState) => {
      setGameState(prev => {
        if (prev && prev.mySeatIndex >= 0 && prev.handNumber >= state.handNumber) {
          return prev;
        }
        return state;
      });
    });

    socket.on('error', (data: { message: string }) => {
      console.log('[WS] Error:', data.message);
    });

    socket.on('chat_message', (msg: { socketId: string; message: string; timestamp: number }) => {
      setChatMessages(prev => [...prev.slice(-50), msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Cleanup HTTP polling on unmount
  useEffect(() => {
    return () => {
      stopHttpPolling();
    };
  }, [stopHttpPolling]);

  const joinTable = useCallback(async (tableId: number, userId: number, _seatIndex?: number) => {
    pendingJoinRef.current = { tableId, userId };

    // Join via HTTP first (reliable)
    try {
      const headers = getAuthHeaders();
      if (headers['Authorization']) {
        const res = await fetch(`/api/game/${tableId}/join`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tableId }),
        });
        const data = await res.json();
        if (data.success) {
          console.log(`[HTTP] Joined table ${tableId}, seat ${data.seatIndex}`);
          joinedViaHttpRef.current = true;
          if (data.seatIndex !== undefined) {
            setMySeatIndex(data.seatIndex);
          }
          setConnected(true);
          // Start HTTP polling
          startHttpPolling(tableId);
        } else {
          console.warn('[HTTP] Join failed:', data.error);
          setError(data.error || 'Failed to join table');
        }
      }
    } catch (err) {
      console.warn('[HTTP] Join request failed:', err);
    }

    // Also try socket.io join (enhancement)
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_table', { tableId, userId, seatIndex: _seatIndex });
    }
  }, [startHttpPolling]);

  const leaveTable = useCallback((tableId: number) => {
    pendingJoinRef.current = null;
    joinedViaHttpRef.current = false;
    stopHttpPolling();
    if (socketRef.current) {
      socketRef.current.emit('leave_table', { tableId });
    }
    setGameState(null);
    setMySeatIndex(-1);
  }, [stopHttpPolling]);

  const sendAction = useCallback(async (tableId: number, action: string, amount?: number) => {
    // Send via HTTP first (reliable)
    try {
      const headers = getAuthHeaders();
      if (headers['Authorization']) {
        const res = await fetch(`/api/game/${tableId}/action`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action, amount }),
        });
        const data = await res.json();
        if (data.success) {
          console.log(`[HTTP] Action sent: ${action}${amount ? ` ${amount}` : ''}`);
          // Immediately fetch new state after action
          fetchGameState(tableId);
          return;
        } else {
          console.warn('[HTTP] Action failed:', data.error);
        }
      }
    } catch (err) {
      console.warn('[HTTP] Action request failed, trying socket:', err);
    }

    // Fallback to socket.io
    if (socketRef.current?.connected) {
      socketRef.current.emit('player_action', { tableId, action, amount });
    }
  }, [fetchGameState]);

  const sendChat = useCallback((tableId: number, message: string) => {
    if (socketRef.current?.connected) {
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
