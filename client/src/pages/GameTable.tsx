/**
 * GameTable — HOUSE POKER
 * Real multiplayer poker table connected via WebSocket
 * Premium casino design with green felt, gold accents
 */
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Clock, MessageCircle, Volume2, VolumeX } from 'lucide-react';
import { useSocket, ServerGameState, ServerPlayer } from '@/hooks/useSocket';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { ASSETS, SUIT_SYMBOLS, SUIT_COLORS } from '@/lib/assets';
import type { Card } from '@/lib/assets';
import { toast } from 'sonner';

// Seat positions for 6-max table (percentage-based)
const SEAT_POSITIONS_6 = [
  { x: 50, y: 86 },   // 0: bottom center (hero)
  { x: 6,  y: 60 },   // 1: left-bottom
  { x: 6,  y: 24 },   // 2: left-top
  { x: 50, y: 4 },    // 3: top center
  { x: 94, y: 24 },   // 4: right-top
  { x: 94, y: 60 },   // 5: right-bottom
];

const SEAT_POSITIONS_9 = [
  { x: 50, y: 86 },
  { x: 10, y: 72 },
  { x: 3,  y: 46 },
  { x: 10, y: 20 },
  { x: 32, y: 4 },
  { x: 68, y: 4 },
  { x: 90, y: 20 },
  { x: 97, y: 46 },
  { x: 90, y: 72 },
];

const SEAT_POSITIONS_2 = [
  { x: 50, y: 86 },
  { x: 50, y: 4 },
];

const PHASE_LABELS: Record<string, string> = {
  waiting: 'Waiting...',
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

function getSeatPositions(tableSize: number) {
  if (tableSize <= 2) return SEAT_POSITIONS_2;
  if (tableSize <= 6) return SEAT_POSITIONS_6;
  return SEAT_POSITIONS_9;
}

// Card component inline for simplicity
function CardView({ card, faceDown = false, small = false }: { card: Card; faceDown?: boolean; small?: boolean }) {
  const w = small ? 36 : 48;
  const h = small ? 52 : 68;

  if (faceDown) {
    return (
      <div
        className="rounded-lg overflow-hidden flex-shrink-0"
        style={{
          width: w, height: h,
          background: 'linear-gradient(135deg, #1a237e, #0d1b3e)',
          border: '1.5px solid rgba(212, 175, 55, 0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <div className="w-full h-full flex items-center justify-center opacity-30">
          <img src={ASSETS.ui.crown} alt="" className="w-5 h-5" />
        </div>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit as keyof typeof SUIT_COLORS] || '#fff';
  const symbol = SUIT_SYMBOLS[card.suit as keyof typeof SUIT_SYMBOLS] || '?';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg flex-shrink-0 relative overflow-hidden"
      style={{
        width: w, height: h,
        background: 'linear-gradient(145deg, #ffffff 0%, #f0f0f0 100%)',
        border: '1px solid rgba(0,0,0,0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className="font-bold" style={{ fontSize: small ? 10 : 13, color }}>{card.rank}</span>
        <span style={{ fontSize: small ? 8 : 11, color }}>{symbol}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: small ? 16 : 22, color }}>{symbol}</span>
      </div>
    </motion.div>
  );
}

// Player seat component
function SeatView({
  player, position, isAction, isDealer, isSB, isBB, isHero, isShowdown, isWinner
}: {
  player: ServerPlayer;
  position: { x: number; y: number };
  isAction: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isHero: boolean;
  isShowdown: boolean;
  isWinner: boolean;
}) {
  const avatarUrl = ASSETS.avatars[player.avatar as keyof typeof ASSETS.avatars] || ASSETS.avatars.fox;

  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isAction ? 15 : 10,
      }}
      animate={isAction ? { scale: [1, 1.03, 1] } : {}}
      transition={isAction ? { duration: 1.5, repeat: Infinity } : {}}
    >
      {/* Cards above player */}
      {player.holeCards.length > 0 && !player.folded && (
        <div className="flex gap-0.5 mb-1">
          {player.holeCards.map((c, i) => (
            <CardView
              key={i}
              card={c as Card}
              faceDown={!isHero && !isShowdown}
              small
            />
          ))}
        </div>
      )}

      {/* Avatar + info */}
      <div className={`relative ${player.folded ? 'opacity-40' : ''}`}>
        {/* Action ring */}
        {isAction && !player.folded && (
          <motion.div
            className="absolute -inset-1 rounded-full"
            style={{
              border: '2px solid #D4AF37',
              boxShadow: '0 0 15px rgba(212, 175, 55, 0.4)',
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}

        {/* Winner glow */}
        {isWinner && (
          <motion.div
            className="absolute -inset-2 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        <div
          className="w-11 h-11 rounded-full overflow-hidden"
          style={{
            border: `2px solid ${isWinner ? '#D4AF37' : isHero ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255,255,255,0.15)'}`,
            boxShadow: isWinner ? '0 0 15px rgba(212, 175, 55, 0.4)' : '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <img src={avatarUrl} alt={player.name} className="w-full h-full object-cover" />
        </div>

        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black"
            style={{ background: '#D4AF37', color: '#000' }}>
            D
          </div>
        )}

        {/* SB/BB badge */}
        {(isSB || isBB) && !isDealer && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-bold"
            style={{
              background: isSB ? '#4a90d9' : '#e74c3c',
              color: '#fff',
            }}>
            {isSB ? 'SB' : 'BB'}
          </div>
        )}
      </div>

      {/* Name + chips */}
      <div className="mt-1 text-center" style={{ minWidth: 60 }}>
        <div className="text-[9px] font-bold text-white truncate max-w-[70px]">
          {player.name}
        </div>
        <div className="text-[8px] font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {player.chipStack.toLocaleString()}
        </div>
      </div>

      {/* Current bet */}
      {player.currentBet > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mt-0.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
          style={{
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
          }}
        >
          <img src={ASSETS.chips.gold} alt="" className="w-3 h-3" />
          <span className="text-[8px] font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {player.currentBet.toLocaleString()}
          </span>
        </motion.div>
      )}

      {/* Last action badge */}
      {player.lastAction && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-0.5 px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase"
          style={{
            background: player.lastAction.startsWith('WIN')
              ? 'rgba(212, 175, 55, 0.2)'
              : player.lastAction === 'fold'
              ? 'rgba(255,0,0,0.15)'
              : 'rgba(0, 240, 255, 0.1)',
            color: player.lastAction.startsWith('WIN')
              ? '#D4AF37'
              : player.lastAction === 'fold'
              ? '#ff6b6b'
              : '#00F0FF',
            border: `1px solid ${player.lastAction.startsWith('WIN') ? 'rgba(212, 175, 55, 0.3)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          {player.lastAction}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function GameTable() {
  const params = useParams<{ tableId: string }>();
  const tableId = parseInt(params.tableId || '1');
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { connected, gameState, error, joinTable, leaveTable, sendAction, sendChat, chatMessages } = useSocket();

  const [turnTimer, setTurnTimer] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Get table config
  const { data: tableConfig } = trpc.tables.get.useQuery({ id: tableId });

  // Join table when connected and user is available
  useEffect(() => {
    if (connected && user?.id && tableId) {
      joinTable(tableId, user.id);
    }
    return () => {
      if (tableId) leaveTable(tableId);
    };
  }, [connected, user?.id, tableId]);

  // Show errors
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Action timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!gameState || gameState.phase === 'showdown' || gameState.phase === 'waiting') return;

    if (gameState.actionDeadline > 0) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.ceil((gameState.actionDeadline - Date.now()) / 1000));
        setTurnTimer(remaining);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.actionSeat, gameState?.phase, gameState?.actionDeadline]);

  // Find hero player
  const heroPlayer = gameState?.players.find(p => p.userId === user?.id);
  const heroSeatIndex = heroPlayer?.seatIndex ?? -1;
  const isMyTurn = gameState
    ? gameState.actionSeat === heroSeatIndex
      && gameState.phase !== 'showdown'
      && gameState.phase !== 'waiting'
    : false;

  // Calculate call amount
  const callAmount = heroPlayer
    ? Math.min(heroPlayer.chipStack, gameState!.currentBet - heroPlayer.currentBet)
    : 0;
  const canCheck = callAmount === 0;
  const minRaise = gameState?.minRaise || 0;
  const maxRaise = heroPlayer?.chipStack || 0;

  // Set default raise amount
  useEffect(() => {
    if (gameState && heroPlayer) {
      setRaiseAmount(Math.min(gameState.currentBet + gameState.bigBlind * 2, heroPlayer.chipStack));
    }
  }, [gameState?.currentBet, gameState?.bigBlind]);

  // Get seat positions based on table size
  const tableSize = tableConfig ? parseInt(tableConfig.tableSize) : 6;
  const seatPositions = getSeatPositions(tableSize);

  // Reorder players so hero is at position 0 (bottom)
  const orderedPlayers = useMemo((): (ServerPlayer & { visualIndex: number })[] => {
    if (!gameState) return [];
    const players = [...gameState.players];
    if (heroSeatIndex === -1) return players.map((p, i) => ({ ...p, visualIndex: i }));

    // Map each player to a visual position relative to hero
    return players.map(p => {
      const relativeIndex = (p.seatIndex - heroSeatIndex + tableSize) % tableSize;
      return { ...p, visualIndex: relativeIndex };
    }).sort((a, b) => a.visualIndex - b.visualIndex);
  }, [gameState?.players, heroSeatIndex, tableSize]);

  // Ambient particles
  const particles = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    w: 1 + Math.random() * 1.5,
    left: Math.random() * 100,
    top: Math.random() * 100,
    color: i % 3 === 0 ? '#D4AF37' : i % 3 === 1 ? '#00F0FF' : '#ffffff',
    yMove: -15 - Math.random() * 25,
    dur: 6 + Math.random() * 6,
    delay: Math.random() * 5,
  })), []);

  const handleAction = useCallback((action: string, amount?: number) => {
    sendAction(tableId, action, amount);
    setShowRaiseSlider(false);
  }, [tableId, sendAction]);

  // Total pot
  const totalPot = gameState
    ? gameState.pots.reduce((s, p) => s + p.amount, 0) +
      gameState.players.reduce((s, p) => s + p.currentBet, 0)
    : 0;

  // Loading state
  if (!connected || !gameState) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{
        background: 'radial-gradient(ellipse at center, #0d1117 0%, #080a0f 50%, #050507 100%)',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-t-transparent rounded-full"
          style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }}
        />
        <p className="text-gray-400 text-sm">
          {!connected ? 'Connecting to server...' : 'Joining table...'}
        </p>
        {!user && (
          <p className="text-yellow-400 text-xs">Please log in to play</p>
        )}
        <button onClick={() => navigate('/lobby')} className="text-gray-500 text-xs underline mt-2">
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col relative overflow-hidden select-none" style={{
      background: 'radial-gradient(ellipse at center, #0d1117 0%, #080a0f 50%, #050507 100%)',
    }}>
      {/* Ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: `${p.w}px`, height: `${p.w}px`,
              left: `${p.left}%`, top: `${p.top}%`,
              background: p.color,
            }}
            animate={{ y: [0, p.yMove, 0], opacity: [0.02, 0.12, 0.02] }}
            transition={{ duration: p.dur, repeat: Infinity, delay: p.delay }}
          />
        ))}
      </div>

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-3 py-2 shrink-0">
        <button onClick={() => { leaveTable(tableId); navigate('/lobby'); }}
          className="p-2 rounded-xl transition-colors"
          style={{
            background: 'rgba(10, 10, 20, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
          <ArrowLeft size={16} className="text-gray-300" />
        </button>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-xl" style={{
            background: 'rgba(10, 10, 20, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(212, 175, 55, 0.15)',
          }}>
            <span className="text-[9px] uppercase tracking-widest text-gray-500 block text-center">
              {PHASE_LABELS[gameState.phase] || ''} #{gameState.handNumber}
            </span>
            <span className="text-xs font-bold text-gold block text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {gameState.smallBlind}/{gameState.bigBlind}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {gameState.phase !== 'showdown' && gameState.phase !== 'waiting' && (
            <div className="flex items-center gap-1 rounded-xl px-2 py-1.5" style={{
              background: 'rgba(10, 10, 20, 0.7)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${turnTimer <= 10 ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <Clock size={11} className={turnTimer <= 10 ? 'text-red-400' : 'text-gray-500'} />
              <span className={`text-[10px] font-bold ${turnTimer <= 10 ? 'text-red-400' : 'text-gray-400'}`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {turnTimer}s
              </span>
            </div>
          )}
          {/* Connection indicator */}
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl" style={{
            background: 'rgba(10, 10, 20, 0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-[9px] text-gray-500">{gameState.players.length}P</span>
          </div>
        </div>
      </div>

      {/* Main table area */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: '94%', maxWidth: '600px', aspectRatio: '1.55 / 1' }}>
            {/* Table frame */}
            <div className="absolute inset-0" style={{
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.95), rgba(15, 15, 25, 0.95))',
              boxShadow: '0 0 0 3px rgba(212, 175, 55, 0.08), 0 0 0 6px rgba(15, 15, 25, 0.9), 0 8px 32px rgba(0,0,0,0.5)',
              border: '2px solid rgba(212, 175, 55, 0.06)',
            }}>
              {/* Felt surface */}
              <div className="absolute" style={{
                left: '3%', right: '3%', top: '5%', bottom: '5%',
                borderRadius: '50%',
                background: 'radial-gradient(ellipse at center, #1a5c2a 0%, #145222 25%, #0d3518 55%, #081f0e 100%)',
                boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(212, 175, 55, 0.04)',
              }}>
                {/* Inner decorative line */}
                <div className="absolute" style={{
                  left: '8%', right: '8%', top: '10%', bottom: '10%',
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.02)',
                }} />
                {/* Felt texture */}
                <div className="absolute inset-0 rounded-[50%] opacity-5" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='%23ffffff' fill-opacity='0.15'/%3E%3C/svg%3E")`,
                }} />
              </div>
            </div>

            {/* HOUSE POKER watermark */}
            <div className="absolute left-1/2 -translate-x-1/2 z-[5] pointer-events-none" style={{ top: '14%' }}>
              <div className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-15 text-gold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                HOUSE POKER
              </div>
            </div>

            {/* Pot display */}
            {totalPot > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10"
                style={{
                  top: '22%',
                  background: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  border: '1px solid rgba(212, 175, 55, 0.2)',
                }}
              >
                <img src={ASSETS.chips.gold} alt="" className="w-4 h-4" />
                <span className="text-xs font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  POT {totalPot.toLocaleString()}
                </span>
              </motion.div>
            )}

            {/* Community cards */}
            <div className="absolute left-1/2 flex gap-1.5 z-10" style={{ top: '42%', transform: 'translate(-50%, -50%)' }}>
              <AnimatePresence>
                {gameState.communityCards.map((card, i) => (
                  <CardView key={`cc-${i}`} card={card as Card} />
                ))}
              </AnimatePresence>
              {gameState.communityCards.length < 5 && gameState.phase !== 'waiting' && (
                <>
                  {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="rounded-lg" style={{
                      width: 48, height: 68,
                      background: 'rgba(255, 255, 255, 0.015)',
                      border: '1px dashed rgba(255, 255, 255, 0.03)',
                    }} />
                  ))}
                </>
              )}
            </div>

            {/* Player seats */}
            {orderedPlayers.map((player) => {
              const pos = seatPositions[player.visualIndex] || seatPositions[0];
              return (
                <SeatView
                  key={player.seatIndex}
                  player={player}
                  position={pos}
                  isAction={gameState.actionSeat === player.seatIndex && gameState.phase !== 'showdown'}
                  isDealer={gameState.dealerSeat === player.seatIndex}
                  isSB={gameState.smallBlindSeat === player.seatIndex}
                  isBB={gameState.bigBlindSeat === player.seatIndex}
                  isHero={player.userId === user?.id}
                  isShowdown={gameState.phase === 'showdown'}
                  isWinner={!!player.lastAction?.startsWith('WIN')}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Hero's hole cards — large display at bottom */}
      {heroPlayer && !heroPlayer.folded && heroPlayer.holeCards.length > 0 && (
        <div className="flex justify-center gap-2 py-1 relative z-10 shrink-0">
          {heroPlayer.holeCards.map((card, i) => (
            <motion.div
              key={`hero-${i}`}
              whileHover={{ y: -6, scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <CardView card={card as Card} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Showdown overlay */}
      <AnimatePresence>
        {gameState.phase === 'showdown' && gameState.players.some(p => p.lastAction?.startsWith('WIN')) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="rounded-2xl p-5 mx-4 text-center max-w-xs"
              style={{
                background: 'rgba(10, 10, 20, 0.95)',
                backdropFilter: 'blur(24px)',
                border: '2px solid rgba(212, 175, 55, 0.35)',
                boxShadow: '0 0 50px rgba(212, 175, 55, 0.12)',
              }}
            >
              <img src={ASSETS.ui.trophy} alt="" className="w-14 h-14 mx-auto mb-2" />
              {gameState.players.filter(p => p.lastAction?.startsWith('WIN')).map(winner => (
                <div key={winner.seatIndex}>
                  <h2 className="text-lg font-bold gold-text mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    {winner.userId === user?.id ? 'YOU WIN!' : `${winner.name} WINS!`}
                  </h2>
                  {winner.lastAction && winner.lastAction !== 'WIN' && (
                    <div className="text-sm mb-2" style={{ color: '#00F0FF' }}>
                      {winner.lastAction.replace('WIN - ', '')}
                    </div>
                  )}
                </div>
              ))}
              <div className="text-[10px] text-gray-500 mt-2">
                Next hand starting...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action panel */}
      <div className="shrink-0 relative z-20">
        {gameState.phase === 'waiting' ? (
          <div className="px-4 py-3 text-center">
            <div className="text-sm text-gray-400">Waiting for players...</div>
            <div className="text-xs text-gray-600 mt-1">
              {gameState.players.length} / {tableSize} players
            </div>
          </div>
        ) : isMyTurn ? (
          <div className="px-3 py-2 space-y-2" style={{
            background: 'rgba(10, 10, 20, 0.9)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(212, 175, 55, 0.15)',
          }}>
            {/* Raise slider */}
            {showRaiseSlider && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="flex items-center gap-2"
              >
                <span className="text-[10px] text-gray-400 w-8" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {raiseAmount}
                </span>
                <input
                  type="range"
                  min={Math.max(gameState.currentBet + minRaise, gameState.bigBlind)}
                  max={maxRaise}
                  value={raiseAmount}
                  onChange={e => setRaiseAmount(parseInt(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: '#D4AF37' }}
                />
                <button
                  onClick={() => handleAction('raise', raiseAmount)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                    color: '#000',
                  }}
                >
                  RAISE {raiseAmount}
                </button>
              </motion.div>
            )}

            {/* Main action buttons */}
            <div className="flex gap-2">
              {/* FOLD */}
              <button
                onClick={() => handleAction('fold')}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #8B0000, #5C0000)',
                  color: '#fff',
                  border: '1px solid rgba(255, 0, 0, 0.3)',
                }}
              >
                FOLD
              </button>

              {/* CHECK / CALL */}
              {canCheck ? (
                <button
                  onClick={() => handleAction('check')}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{
                    background: 'rgba(0, 240, 255, 0.1)',
                    color: '#00F0FF',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                  }}
                >
                  CHECK
                </button>
              ) : (
                <button
                  onClick={() => handleAction('call')}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{
                    background: 'rgba(0, 240, 255, 0.1)',
                    color: '#00F0FF',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                  }}
                >
                  CALL {callAmount}
                </button>
              )}

              {/* RAISE */}
              <button
                onClick={() => setShowRaiseSlider(!showRaiseSlider)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                  color: '#000',
                }}
              >
                RAISE
              </button>

              {/* ALL IN */}
              {heroPlayer && heroPlayer.chipStack > 0 && (
                <button
                  onClick={() => handleAction('allin')}
                  className="py-3 px-3 rounded-xl text-xs font-bold transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #ff6b00, #cc5500)',
                    color: '#fff',
                    border: '1px solid rgba(255, 107, 0, 0.5)',
                  }}
                >
                  ALL IN
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Not my turn — show waiting state */
          <div className="px-4 py-3 text-center" style={{
            background: 'rgba(10, 10, 20, 0.7)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            {heroPlayer?.folded ? (
              <span className="text-xs text-gray-500">Folded — waiting for next hand</span>
            ) : (
              <span className="text-xs text-gray-400">
                Waiting for {gameState.players.find(p => p.seatIndex === gameState.actionSeat)?.name || 'opponent'}...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
