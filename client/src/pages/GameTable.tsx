/**
 * GameTable — Premium Poker Table (TON Poker Style)
 * All graphics drawn programmatically (SVG/CSS) - no AI images
 * Mobile-first responsive design with atmospheric effects
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Clock, Users, Wifi, WifiOff, MessageCircle, Settings, Volume2, VolumeX } from 'lucide-react';
import { useSocket, ServerPlayer } from '@/hooks/useSocket';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { ASSETS } from '@/lib/assets';
import type { Card } from '@/lib/assets';
import { toast } from 'sonner';
import PokerCard from '@/components/PokerCard';
import PokerChip, { ChipStack, formatChipAmount } from '@/components/PokerChip';
import TableBackground from '@/components/TableBackground';

/* ─── Seat positions (percentage-based, mobile-optimized for vertical oval) ─── */
const SEATS_6 = [
  { x: 50, y: 88 },   // 0: hero (bottom center)
  { x: 8,  y: 66 },   // 1: left-bottom
  { x: 8,  y: 28 },   // 2: left-top
  { x: 50, y: 4 },    // 3: top center
  { x: 92, y: 28 },   // 4: right-top
  { x: 92, y: 66 },   // 5: right-bottom
];
const SEATS_9 = [
  { x: 50, y: 88 }, { x: 10, y: 74 }, { x: 6, y: 48 },
  { x: 10, y: 18 }, { x: 34, y: 4 },  { x: 66, y: 4 },
  { x: 90, y: 18 }, { x: 94, y: 48 }, { x: 90, y: 74 },
];
const SEATS_2 = [{ x: 50, y: 88 }, { x: 50, y: 4 }];

function getSeats(n: number) {
  return n <= 2 ? SEATS_2 : n <= 6 ? SEATS_6 : SEATS_9;
}

/* ─── Bet pill positions (offset from player toward center) ─── */
function getBetPos(playerPos: { x: number; y: number }) {
  const cx = 50, cy = 46;
  const dx = cx - playerPos.x;
  const dy = cy - playerPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const factor = Math.min(0.45, 18 / dist);
  return {
    x: playerPos.x + dx * factor,
    y: playerPos.y + dy * factor,
  };
}

const PHASE_LABELS: Record<string, string> = {
  waiting: 'WAITING', preflop: 'PRE-FLOP', flop: 'FLOP',
  turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
};

/* ─── Dealer Button (SVG) ─── */
function DealerButton({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="8" fill="url(#dealerGrad)" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <defs>
        <linearGradient id="dealerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5E6A3" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#B8941F" />
        </linearGradient>
      </defs>
      <text x="9" y="12.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#1a1a0a" fontFamily="Inter, sans-serif">D</text>
    </svg>
  );
}

/* ─── Position Badge ─── */
function PositionBadge({ label, color }: { label: string; color: string }) {
  return (
    <div className="absolute -top-0.5 -right-0.5 z-10 w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-black"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        color: '#fff',
        boxShadow: `0 1px 4px rgba(0,0,0,0.4), 0 0 6px ${color}40`,
        border: '1px solid rgba(255,255,255,0.15)',
      }}>
      {label}
    </div>
  );
}

/* ─── Player Seat ─── */
function SeatView({
  player, pos, isAction, isDealer, isSB, isBB, isHero, isShowdown, isWinner, timerPct,
}: {
  player: ServerPlayer; pos: { x: number; y: number };
  isAction: boolean; isDealer: boolean; isSB: boolean; isBB: boolean;
  isHero: boolean; isShowdown: boolean; isWinner: boolean; timerPct: number;
}) {
  const avatarUrl = ASSETS.avatars[player.avatar as keyof typeof ASSETS.avatars] || ASSETS.avatars.fox;
  const isTop = pos.y < 30;
  const isLeft = pos.x < 30;
  const isRight = pos.x > 70;

  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{
        left: `${pos.x}%`, top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isAction ? 20 : isHero ? 15 : 10,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      {/* Hole cards — show above for top players */}
      {!isHero && isTop && player.holeCards.length > 0 && !player.folded && (
        <div className="flex gap-0.5 mb-1">
          {player.holeCards.map((c, i) => (
            <PokerCard key={i} card={c as Card} faceDown={!isShowdown} size="xs" delay={i * 0.05} />
          ))}
        </div>
      )}

      {/* Player container */}
      <div className={`relative ${player.folded ? 'opacity-30 grayscale' : ''} transition-all duration-300`}>
        {/* Timer ring */}
        {isAction && !player.folded && (
          <svg className="absolute" viewBox="0 0 52 52" style={{ width: '140%', height: '140%', left: '-20%', top: '-20%' }}>
            <circle cx="26" cy="26" r="23" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
            <circle cx="26" cy="26" r="23" fill="none"
              stroke={timerPct > 0.5 ? '#D4AF37' : timerPct > 0.25 ? '#f59e0b' : '#ef4444'}
              strokeWidth="2.5"
              strokeDasharray={`${timerPct * 144.5} 144.5`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
              style={{ transition: 'stroke-dasharray 0.5s linear, stroke 0.5s' }}
            />
          </svg>
        )}

        {/* Winner glow */}
        {isWinner && (
          <motion.div
            className="absolute -inset-3 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.5) 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* Avatar */}
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden" style={{
          border: `2px solid ${
            isWinner ? '#D4AF37'
            : isAction ? 'rgba(212,175,55,0.8)'
            : isHero ? 'rgba(212,175,55,0.4)'
            : 'rgba(255,255,255,0.1)'
          }`,
          boxShadow: isWinner
            ? '0 0 20px rgba(212,175,55,0.6), 0 0 40px rgba(212,175,55,0.2)'
            : isAction
            ? '0 0 12px rgba(212,175,55,0.3)'
            : '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          <img src={avatarUrl} alt={player.name} className="w-full h-full object-cover" />
        </div>

        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -bottom-1 -left-1 z-10">
            <DealerButton size={16} />
          </div>
        )}

        {/* SB/BB badges */}
        {isSB && !isDealer && <PositionBadge label="S" color="#3b82f6" />}
        {isBB && !isDealer && !isSB && <PositionBadge label="B" color="#ef4444" />}
      </div>

      {/* Name + stack plate */}
      <div className="mt-0.5 text-center px-2 py-0.5 rounded-lg" style={{
        background: isHero
          ? 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))'
          : 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(12px)',
        border: isHero
          ? '1px solid rgba(212,175,55,0.2)'
          : '1px solid rgba(255,255,255,0.04)',
        minWidth: 48,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <div className={`text-[7px] sm:text-[8px] font-semibold truncate max-w-[52px] sm:max-w-[64px] ${isHero ? 'text-gold-light' : 'text-gray-300'}`}>
          {isHero ? '★ YOU' : player.name}
        </div>
        <div className="text-[8px] sm:text-[9px] font-bold text-gold font-mono-poker">
          {formatChipAmount(player.chipStack)}
        </div>
      </div>

      {/* Last action badge */}
      {player.lastAction && (
        <motion.div
          initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
          className="mt-0.5 px-2 py-0.5 rounded-full text-[6px] sm:text-[7px] font-black uppercase tracking-wider"
          style={{
            background: player.lastAction.startsWith('WIN')
              ? 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))'
              : player.lastAction === 'FOLD'
              ? 'rgba(239,68,68,0.15)'
              : player.lastAction === 'ALL IN'
              ? 'linear-gradient(135deg, rgba(255,107,0,0.3), rgba(255,107,0,0.1))'
              : 'rgba(255,255,255,0.06)',
            color: player.lastAction.startsWith('WIN')
              ? '#D4AF37'
              : player.lastAction === 'FOLD'
              ? '#f87171'
              : player.lastAction === 'ALL IN'
              ? '#fb923c'
              : '#94a3b8',
            border: `1px solid ${
              player.lastAction.startsWith('WIN') ? 'rgba(212,175,55,0.2)'
              : player.lastAction === 'ALL IN' ? 'rgba(255,107,0,0.2)'
              : 'rgba(255,255,255,0.05)'
            }`,
          }}
        >
          {player.lastAction}
        </motion.div>
      )}

      {/* Hole cards — below for non-top, non-hero */}
      {!isHero && !isTop && player.holeCards.length > 0 && !player.folded && (
        <div className="flex gap-0.5 mt-0.5">
          {player.holeCards.map((c, i) => (
            <PokerCard key={i} card={c as Card} faceDown={!isShowdown} size="xs" delay={i * 0.05} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Bet Pill (gold pill near player) ─── */
function BetPill({ amount, pos }: { amount: number; pos: { x: number; y: number } }) {
  if (amount <= 0) return null;
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))',
        border: '1px solid rgba(212,175,55,0.25)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <PokerChip size={10} amount={amount} />
      <span className="text-[8px] font-bold text-gold font-mono-poker">{formatChipAmount(amount)}</span>
    </motion.div>
  );
}

/* ─── Empty Seat ─── */
function EmptySeat({ pos, seatIndex, onSit }: { pos: { x: number; y: number }; seatIndex: number; onSit: () => void }) {
  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{
        left: `${pos.x}%`, top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <button
        onClick={onSit}
        className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1.5px dashed rgba(255,255,255,0.1)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <span className="text-[8px] sm:text-[9px] font-bold text-gray-500">SIT</span>
      </button>
      <div className="mt-0.5 text-[6px] text-gray-600 font-mono-poker">#{seatIndex + 1}</div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN GAME TABLE COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function GameTable() {
  const params = useParams<{ tableId: string }>();
  const tableId = parseInt(params.tableId || '1');
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { connected, gameState, mySeatIndex, error, joinTable, leaveTable, sendAction } = useSocket();

  const [turnTimer, setTurnTimer] = useState(30);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaise, setShowRaise] = useState(false);
  const [preAction, setPreAction] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableSize_, setTableSize_] = useState({ w: 400, h: 500 });

  const { data: tableConfig } = trpc.tables.get.useQuery({ id: tableId });

  // Measure table container
  useEffect(() => {
    const measure = () => {
      if (tableRef.current) {
        const rect = tableRef.current.getBoundingClientRect();
        setTableSize_({ w: rect.width, h: rect.height });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Join table
  useEffect(() => {
    if (connected && user?.id && tableId) joinTable(tableId, user.id);
    return () => { if (tableId) leaveTable(tableId); };
  }, [connected, user?.id, tableId]);

  // Errors
  useEffect(() => { if (error) toast.error(error); }, [error]);

  // Timer
  useEffect(() => {
    if (!gameState || gameState.phase === 'showdown' || gameState.phase === 'waiting') {
      setTurnTimer(30);
      return;
    }
    if (!gameState.actionDeadline || gameState.actionDeadline <= 0) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((gameState.actionDeadline - Date.now()) / 1000));
      setTurnTimer(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [gameState?.actionSeat, gameState?.phase, gameState?.actionDeadline]);

  // Hero player
  const heroPlayer = useMemo(() => {
    if (!gameState) return null;
    if (mySeatIndex >= 0) {
      const byIndex = gameState.players.find(p => p.seatIndex === mySeatIndex);
      if (byIndex) return byIndex;
    }
    if (user?.id) {
      return gameState.players.find(p => p.userId === user.id) || null;
    }
    return null;
  }, [gameState?.players, mySeatIndex, user?.id]);

  const heroSeat = heroPlayer?.seatIndex ?? mySeatIndex;

  // Is it my turn?
  const isMyTurn = useMemo(() => {
    if (!gameState || heroSeat < 0) return false;
    if (gameState.phase === 'showdown' || gameState.phase === 'waiting') return false;
    return gameState.actionSeat === heroSeat;
  }, [gameState?.actionSeat, gameState?.phase, heroSeat]);

  const callAmount = heroPlayer
    ? Math.min(heroPlayer.chipStack, Math.max(0, (gameState?.currentBet ?? 0) - heroPlayer.currentBet))
    : 0;
  const canCheck = callAmount === 0;

  // Auto pre-action
  useEffect(() => {
    if (!isMyTurn || !preAction || !gameState) return;
    if (preAction === 'check_fold') {
      if (canCheck) sendAction(tableId, 'check');
      else sendAction(tableId, 'fold');
    } else if (preAction === 'call_any') {
      if (canCheck) sendAction(tableId, 'check');
      else sendAction(tableId, 'call');
    } else if (preAction === 'fold_to_bet') {
      if (!canCheck) sendAction(tableId, 'fold');
    }
    setPreAction(null);
  }, [isMyTurn, preAction]);

  const minRaise = gameState?.minRaise || 0;
  const maxRaise = heroPlayer?.chipStack || 0;

  useEffect(() => {
    if (gameState && heroPlayer) {
      setRaiseAmount(Math.min(gameState.currentBet + gameState.bigBlind * 2, heroPlayer.chipStack));
    }
  }, [gameState?.currentBet, gameState?.bigBlind]);

  const tableSize = tableConfig ? parseInt(tableConfig.tableSize) : 6;
  const seats = getSeats(tableSize);
  const timerPct = turnTimer / 30;

  // Order players so hero is at visual position 0
  const orderedPlayers = useMemo((): (ServerPlayer & { vi: number })[] => {
    if (!gameState) return [];
    const ps = [...gameState.players];
    if (heroSeat < 0) return ps.map((p, i) => ({ ...p, vi: i }));
    return ps.map(p => ({
      ...p,
      vi: (p.seatIndex - heroSeat + tableSize) % tableSize,
    })).sort((a, b) => a.vi - b.vi);
  }, [gameState?.players, heroSeat, tableSize]);

  const potTotal = gameState ? gameState.pots.reduce((s, p) => s + p.amount, 0) : 0;
  const betsOnTable = gameState ? gameState.players.reduce((s, p) => s + p.currentBet, 0) : 0;
  const totalPot = potTotal + betsOnTable;
  const hasMultiplePots = gameState ? gameState.pots.filter(p => p.amount > 0).length > 1 : false;

  const handleAction = useCallback((action: string, amount?: number) => {
    sendAction(tableId, action, amount);
    setShowRaise(false);
    setPreAction(null);
  }, [tableId, sendAction]);

  // Raise presets
  const raisePresets = useMemo(() => {
    if (!gameState || !heroPlayer) return [];
    const bb = gameState.bigBlind;
    const pot = totalPot;
    const minR = Math.max(gameState.currentBet + minRaise, bb);
    return [
      { label: 'Min', value: Math.max(minR, gameState.currentBet + bb) },
      { label: '3BB', value: Math.min(bb * 3 + gameState.currentBet, maxRaise) },
      { label: '5BB', value: Math.min(bb * 5 + gameState.currentBet, maxRaise) },
      { label: '½ Pot', value: Math.min(Math.floor(pot / 2) + gameState.currentBet, maxRaise) },
      { label: 'Pot', value: Math.min(pot + gameState.currentBet, maxRaise) },
      { label: 'All In', value: maxRaise },
    ].filter(p => p.value >= minR && p.value <= maxRaise);
  }, [gameState, heroPlayer, totalPot, minRaise, maxRaise]);

  // Occupied seat indices
  const occupiedSeats = useMemo(() => {
    if (!gameState) return new Set<number>();
    return new Set(gameState.players.map(p => p.seatIndex));
  }, [gameState?.players]);

  /* ─── Loading State ─── */
  if (!connected || !gameState) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        <TableBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(212,175,55,0.2)" strokeWidth="2" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="#D4AF37" strokeWidth="2"
                strokeDasharray="40 86" strokeLinecap="round" />
            </svg>
          </motion.div>
          <p className="text-gray-400 text-sm font-medium">{!connected ? 'Connecting...' : 'Joining table...'}</p>
          {!user && <p className="text-gold/60 text-xs">Please sign in to play</p>}
          <button onClick={() => navigate('/lobby')} className="text-gray-600 text-xs underline mt-4 hover:text-gray-400 transition-colors">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  /* ─── Main Render ─── */
  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden select-none">
      {/* Atmospheric background */}
      <TableBackground />

      {/* ─── Top HUD ─── */}
      <div className="relative z-30 flex items-center justify-between px-2 py-1.5 shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 80%, transparent 100%)',
      }}>
        <button onClick={() => { leaveTable(tableId); navigate('/lobby'); }}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ArrowLeft size={14} className="text-gray-400" />
        </button>

        <div className="flex items-center gap-1.5">
          {/* Game info label */}
          <div className="px-3 py-1 rounded-lg text-center" style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}>
            <div className="text-[8px] uppercase tracking-[0.12em] text-gray-500 font-semibold">
              NLH ~ {gameState.smallBlind}/{gameState.bigBlind} {tableSize}MAX
            </div>
            <div className="text-[9px] font-bold text-gray-400 font-mono-poker">
              {PHASE_LABELS[gameState.phase]} #{gameState.handNumber}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Timer */}
          {gameState.phase !== 'showdown' && gameState.phase !== 'waiting' && (
            <div className={`px-2 py-1 rounded-lg flex items-center gap-1 ${turnTimer <= 10 ? 'border border-red-500/20' : ''}`}
              style={{ background: 'rgba(0,0,0,0.5)', border: turnTimer <= 10 ? undefined : '1px solid rgba(255,255,255,0.06)' }}>
              <Clock size={10} className={turnTimer <= 10 ? 'text-red-400' : 'text-gray-500'} />
              <span className={`text-[10px] font-bold font-mono-poker ${turnTimer <= 10 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
                {turnTimer}s
              </span>
            </div>
          )}
          {/* Connection + players */}
          <div className="px-2 py-1 rounded-lg flex items-center gap-1" style={{
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {connected ? <Wifi size={9} className="text-emerald-400" /> : <WifiOff size={9} className="text-red-400" />}
            <Users size={9} className="text-gray-500" />
            <span className="text-[9px] text-gray-500 font-mono-poker">{gameState.players.length}/{tableSize}</span>
          </div>
        </div>
      </div>

      {/* ─── Table Area ─── */}
      <div className="flex-1 relative z-10" style={{ minHeight: 0 }} ref={tableRef}>
        <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full h-full" style={{ maxWidth: 720, maxHeight: '100%' }}>

            {/* Poker table — SVG drawn */}
            <div className="absolute inset-[6%] sm:inset-[8%]">
              {/* Table outer rim */}
              <div className="absolute inset-0" style={{
                borderRadius: '50%',
                background: 'linear-gradient(180deg, #1e1a14 0%, #141210 50%, #0a0908 100%)',
                boxShadow: `
                  0 0 0 1px rgba(212,175,55,0.06),
                  0 0 60px rgba(0,0,0,0.8),
                  0 8px 32px rgba(0,0,0,0.6)
                `,
              }}>
                {/* Gold border accent */}
                <div className="absolute inset-[2px]" style={{
                  borderRadius: '50%',
                  border: '1px solid rgba(212,175,55,0.1)',
                }} />

                {/* Green felt */}
                <div className="absolute" style={{
                  left: '5%', right: '5%', top: '5%', bottom: '5%',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at 50% 40%, #1e8a42 0%, #1a7a3a 15%, #146830 35%, #0e5424 60%, #083a17 85%, #052810 100%)',
                  boxShadow: 'inset 0 0 50px rgba(0,0,0,0.4), inset 0 -8px 24px rgba(0,0,0,0.2)',
                }}>
                  {/* Felt texture */}
                  <div className="absolute inset-0 rounded-[50%] opacity-[0.03]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 5h1v1H1V5zm2-2h1v1H3V3zm2-2h1v1H5V1z' fill='%23ffffff' fill-opacity='0.3'/%3E%3C/svg%3E")`,
                  }} />
                  {/* Ambient light spot */}
                  <div className="absolute inset-0 rounded-[50%]" style={{
                    background: 'radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.04) 0%, transparent 60%)',
                  }} />
                  {/* Glowing inner border */}
                  <div className="absolute inset-0 rounded-[50%]" style={{
                    border: '1px solid rgba(180,200,160,0.06)',
                    boxShadow: 'inset 0 0 20px rgba(100,200,120,0.02)',
                  }} />
                </div>
              </div>
            </div>

            {/* ─── Hand ID in center ─── */}
            {gameState.handNumber > 0 && gameState.phase !== 'waiting' && (
              <div className="absolute left-1/2 -translate-x-1/2 z-5 text-[8px] text-white/10 font-mono-poker"
                style={{ top: '55%' }}>
                #{gameState.handNumber}
              </div>
            )}

            {/* ─── Pot Display ─── */}
            {totalPot > 0 && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-0.5"
                style={{ top: '26%' }}
              >
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full" style={{
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(212,175,55,0.25)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 12px rgba(212,175,55,0.08)',
                }}>
                  <PokerChip size={14} amount={totalPot} />
                  <span className="text-xs sm:text-sm font-bold text-gold font-mono-poker">
                    {totalPot.toLocaleString()}
                  </span>
                </div>
                {/* Side pots */}
                {hasMultiplePots && (
                  <div className="flex gap-1 mt-0.5">
                    {gameState.pots.filter(p => p.amount > 0).map((pot, i) => (
                      <span key={i} className="text-[7px] px-1.5 py-0.5 rounded-full text-gray-400 font-mono-poker"
                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── Community Cards ─── */}
            <div className="absolute left-1/2 flex gap-1.5 sm:gap-2 z-10" style={{ top: '44%', transform: 'translate(-50%, -50%)' }}>
              <AnimatePresence>
                {gameState.communityCards.map((card, i) => (
                  <motion.div key={`cc-${i}`} initial={{ y: -15, opacity: 0, scale: 0.7 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}>
                    <PokerCard card={card as Card} size="md" delay={i * 0.08} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* Empty card slots */}
              {gameState.communityCards.length < 5 && gameState.phase !== 'waiting' && (
                Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                  <div key={`e-${i}`} className="rounded" style={{
                    width: 44, height: 63,
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px dashed rgba(255,255,255,0.04)',
                    borderRadius: 5,
                  }} />
                ))
              )}
            </div>

            {/* ─── Bet Pills ─── */}
            {orderedPlayers.map(player => {
              if (player.currentBet <= 0) return null;
              const pos = seats[player.vi] || seats[0];
              const betPos = getBetPos(pos);
              return <BetPill key={`bet-${player.seatIndex}`} amount={player.currentBet} pos={betPos} />;
            })}

            {/* ─── Player Seats ─── */}
            {orderedPlayers.map(player => {
              const pos = seats[player.vi] || seats[0];
              return (
                <SeatView
                  key={player.seatIndex}
                  player={player}
                  pos={pos}
                  isAction={gameState.actionSeat === player.seatIndex && gameState.phase !== 'showdown'}
                  isDealer={gameState.dealerSeat === player.seatIndex}
                  isSB={gameState.smallBlindSeat === player.seatIndex}
                  isBB={gameState.bigBlindSeat === player.seatIndex}
                  isHero={player.seatIndex === heroSeat}
                  isShowdown={gameState.phase === 'showdown'}
                  isWinner={!!player.lastAction?.startsWith('WIN')}
                  timerPct={gameState.actionSeat === player.seatIndex ? timerPct : 0}
                />
              );
            })}

            {/* ─── Empty Seats ─── */}
            {Array.from({ length: tableSize }).map((_, i) => {
              const vi = heroSeat >= 0 ? (i - heroSeat + tableSize) % tableSize : i;
              if (occupiedSeats.has(i)) return null;
              if (vi === 0 && heroSeat >= 0) return null; // Hero's seat
              const pos = seats[vi] || seats[0];
              return (
                <EmptySeat
                  key={`empty-${i}`}
                  pos={pos}
                  seatIndex={i}
                  onSit={() => toast.info('Seat selection coming soon')}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Hero Cards ─── */}
      <div className="shrink-0 relative z-20" style={{
        background: 'linear-gradient(0deg, rgba(4,4,6,0.9) 0%, rgba(4,4,6,0.4) 60%, transparent 100%)',
        minHeight: 40,
      }}>
        {heroPlayer && !heroPlayer.folded && heroPlayer.holeCards && heroPlayer.holeCards.length > 0 ? (
          <div className="flex justify-center gap-2 sm:gap-3 py-1">
            {heroPlayer.holeCards.map((card, i) => (
              <motion.div
                key={`hero-${i}-${card.rank}-${card.suit}`}
                whileHover={{ y: -6, scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <PokerCard card={card as Card} size="md" delay={i * 0.1} />
              </motion.div>
            ))}
          </div>
        ) : heroPlayer?.folded ? (
          <div className="flex justify-center py-2">
            <span className="text-[10px] text-gray-600 tracking-wider uppercase">Folded</span>
          </div>
        ) : gameState.phase === 'waiting' ? null : (
          <div className="flex justify-center py-2">
            <span className="text-[10px] text-gray-600">Waiting for cards...</span>
          </div>
        )}
      </div>

      {/* ─── Showdown Winner Overlay ─── */}
      <AnimatePresence>
        {gameState.phase === 'showdown' && gameState.players.some(p => p.lastAction?.startsWith('WIN')) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
              className="rounded-2xl p-6 mx-4 text-center max-w-xs"
              style={{
                background: 'linear-gradient(145deg, rgba(16,16,28,0.95), rgba(8,8,16,0.98))',
                border: '1px solid rgba(212,175,55,0.25)',
                boxShadow: '0 0 60px rgba(212,175,55,0.15), 0 20px 60px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Trophy SVG */}
              <svg width="48" height="48" viewBox="0 0 48 48" className="mx-auto mb-3">
                <defs>
                  <linearGradient id="trophyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5E6A3" />
                    <stop offset="50%" stopColor="#D4AF37" />
                    <stop offset="100%" stopColor="#B8941F" />
                  </linearGradient>
                </defs>
                <path d="M14 8h20v4c0 8-4 14-10 16-6-2-10-8-10-16V8z" fill="url(#trophyGrad)" />
                <path d="M14 12H8c0 6 3 10 6 12" fill="none" stroke="#D4AF37" strokeWidth="2" />
                <path d="M34 12h6c0 6-3 10-6 12" fill="none" stroke="#D4AF37" strokeWidth="2" />
                <rect x="18" y="28" width="12" height="4" rx="1" fill="#B8941F" />
                <rect x="16" y="32" width="16" height="4" rx="2" fill="#D4AF37" />
                <circle cx="24" cy="18" r="4" fill="rgba(255,255,255,0.2)" />
              </svg>

              {gameState.players.filter(p => p.lastAction?.startsWith('WIN')).map(w => (
                <div key={w.seatIndex}>
                  <h2 className="text-lg font-bold gold-text font-display">
                    {w.seatIndex === heroSeat ? 'YOU WIN!' : `${w.name} WINS!`}
                  </h2>
                  {w.lastAction && w.lastAction !== 'WIN' && (
                    <div className="text-xs text-gold-light/70 mt-1">{w.lastAction.replace('WIN - ', '')}</div>
                  )}
                </div>
              ))}
              <div className="text-[9px] text-gray-600 mt-3 tracking-wider">Next hand starting...</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Action Panel ─── */}
      <div className="shrink-0 relative z-30" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
        {gameState.phase === 'waiting' ? (
          <div className="px-3 py-3 text-center" style={{
            background: 'rgba(4,4,6,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div className="text-sm text-gray-400 font-medium">Waiting for players...</div>
            <div className="text-[10px] text-gray-600 mt-0.5 font-mono-poker">{gameState.players.length} / {tableSize} seated</div>
          </div>
        ) : isMyTurn ? (
          /* YOUR TURN */
          <div className="px-2 py-2 space-y-1.5" style={{
            background: 'linear-gradient(0deg, rgba(4,4,6,0.98) 0%, rgba(4,4,6,0.95) 100%)',
            borderTop: '2px solid rgba(212,175,55,0.25)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          }}>
            {/* YOUR TURN label */}
            <div className="text-center">
              <motion.span
                className="text-[9px] font-bold text-gold uppercase tracking-[0.2em]"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Your Turn
              </motion.span>
            </div>

            {/* Raise panel */}
            <AnimatePresence>
              {showRaise && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {/* Presets */}
                  <div className="flex gap-1 mb-1.5 flex-wrap">
                    {raisePresets.map(p => (
                      <button key={p.label} onClick={() => setRaiseAmount(p.value)}
                        className={`px-2 py-1 rounded-lg text-[8px] sm:text-[9px] font-bold transition-all ${
                          raiseAmount === p.value
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        style={{
                          background: raiseAmount === p.value ? undefined : 'rgba(255,255,255,0.04)',
                          border: raiseAmount === p.value ? undefined : '1px solid rgba(255,255,255,0.06)',
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {/* Slider + confirm */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-bold text-gold font-mono-poker w-14 text-right">
                      {formatChipAmount(raiseAmount)}
                    </span>
                    <input
                      type="range"
                      min={Math.max(gameState.currentBet + minRaise, gameState.bigBlind)}
                      max={maxRaise}
                      value={raiseAmount}
                      onChange={e => setRaiseAmount(parseInt(e.target.value))}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${((raiseAmount - gameState.bigBlind) / Math.max(maxRaise - gameState.bigBlind, 1)) * 100}%, rgba(255,255,255,0.06) ${((raiseAmount - gameState.bigBlind) / Math.max(maxRaise - gameState.bigBlind, 1)) * 100}%, rgba(255,255,255,0.06) 100%)`,
                        accentColor: '#D4AF37',
                      }}
                    />
                    <button onClick={() => handleAction('raise', raiseAmount)}
                      className="btn-primary-poker px-4 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold tracking-wider">
                      RAISE
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main action buttons */}
            <div className="flex gap-1.5 sm:gap-2">
              {/* FOLD */}
              <button onClick={() => handleAction('fold')}
                className="flex-1 py-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, #7f1d1d, #450a0a)',
                  color: '#fca5a5',
                  border: '1px solid rgba(220,38,38,0.25)',
                  boxShadow: '0 2px 12px rgba(127,29,29,0.3)',
                }}>
                FOLD
              </button>

              {/* CHECK / CALL */}
              {canCheck ? (
                <button onClick={() => handleAction('check')}
                  className="flex-1 py-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #065f46, #022c22)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16,185,129,0.25)',
                    boxShadow: '0 2px 12px rgba(6,95,70,0.3)',
                  }}>
                  CHECK
                </button>
              ) : (
                <button onClick={() => handleAction('call')}
                  className="flex-1 py-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #065f46, #022c22)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16,185,129,0.25)',
                    boxShadow: '0 2px 12px rgba(6,95,70,0.3)',
                  }}>
                  CALL {formatChipAmount(callAmount)}
                </button>
              )}

              {/* RAISE toggle */}
              <button onClick={() => setShowRaise(!showRaise)}
                className="flex-1 py-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 tracking-wider"
                style={{
                  background: showRaise
                    ? 'rgba(212,175,55,0.1)'
                    : 'linear-gradient(135deg, #D4AF37, #9A7B1F)',
                  color: showRaise ? '#D4AF37' : '#0a0a0f',
                  border: showRaise ? '1px solid rgba(212,175,55,0.25)' : '1px solid rgba(212,175,55,0.4)',
                  boxShadow: showRaise ? 'none' : '0 2px 12px rgba(212,175,55,0.25)',
                }}>
                {canCheck ? 'BET' : 'RAISE'}
              </button>

              {/* ALL IN */}
              {heroPlayer && heroPlayer.chipStack > 0 && (
                <button onClick={() => handleAction('allin')}
                  className="py-3 px-3 rounded-xl text-[9px] sm:text-[10px] font-bold transition-all active:scale-95 tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #c2410c, #7c2d12)',
                    color: '#fed7aa',
                    border: '1px solid rgba(234,88,12,0.25)',
                    boxShadow: '0 2px 12px rgba(194,65,12,0.3)',
                  }}>
                  ALL IN
                </button>
              )}
            </div>
          </div>
        ) : (
          /* NOT YOUR TURN */
          <div className="px-2 py-2" style={{
            background: 'rgba(4,4,6,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            {heroPlayer?.folded ? (
              <div className="text-center py-1.5">
                <span className="text-[10px] text-gray-600 tracking-wider">Folded — waiting for next hand</span>
              </div>
            ) : gameState.phase === 'showdown' ? (
              <div className="text-center py-1.5">
                <span className="text-[10px] text-gray-500">Showdown — revealing cards...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-center text-[9px] text-gray-600">
                  Waiting for {gameState.players.find(p => p.seatIndex === gameState.actionSeat)?.name || 'opponent'}...
                </div>
                {/* Pre-action buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setPreAction(preAction === 'check_fold' ? null : 'check_fold')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all tracking-wider ${
                      preAction === 'check_fold'
                        ? 'bg-red-900/20 text-red-400/80 border border-red-500/20'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                    style={{
                      background: preAction === 'check_fold' ? undefined : 'rgba(255,255,255,0.03)',
                      border: preAction === 'check_fold' ? undefined : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    {preAction === 'check_fold' ? '✓ ' : ''}Check/Fold
                  </button>
                  <button
                    onClick={() => setPreAction(preAction === 'call_any' ? null : 'call_any')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all tracking-wider ${
                      preAction === 'call_any'
                        ? 'bg-emerald-900/20 text-emerald-400/80 border border-emerald-500/20'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                    style={{
                      background: preAction === 'call_any' ? undefined : 'rgba(255,255,255,0.03)',
                      border: preAction === 'call_any' ? undefined : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    {preAction === 'call_any' ? '✓ ' : ''}Call Any
                  </button>
                  <button
                    onClick={() => setPreAction(preAction === 'fold_to_bet' ? null : 'fold_to_bet')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all tracking-wider ${
                      preAction === 'fold_to_bet'
                        ? 'bg-orange-900/20 text-orange-400/80 border border-orange-500/20'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                    style={{
                      background: preAction === 'fold_to_bet' ? undefined : 'rgba(255,255,255,0.03)',
                      border: preAction === 'fold_to_bet' ? undefined : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    {preAction === 'fold_to_bet' ? '✓ ' : ''}Fold to Bet
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
