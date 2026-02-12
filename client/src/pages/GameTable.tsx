/**
 * GameTable — HOUSE POKER Premium Club
 * Ultra-premium poker table with dark/gold aesthetic.
 * Mobile-first responsive design.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Clock, Users, Wifi, WifiOff } from 'lucide-react';
import { useSocket, ServerPlayer } from '@/hooks/useSocket';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { ASSETS, SUIT_SYMBOLS, CHIP_VALUES } from '@/lib/assets';
import type { Card } from '@/lib/assets';
import { toast } from 'sonner';

/* ─── Seat positions (percentage-based, mobile-optimized) ─── */
const SEATS_6 = [
  { x: 50, y: 88 },   // 0: hero (bottom center)
  { x: 8,  y: 62 },   // 1: left-bottom
  { x: 8,  y: 28 },   // 2: left-top
  { x: 50, y: 4 },    // 3: top center
  { x: 92, y: 28 },   // 4: right-top
  { x: 92, y: 62 },   // 5: right-bottom
];
const SEATS_9 = [
  { x: 50, y: 88 }, { x: 10, y: 74 }, { x: 6, y: 46 },
  { x: 10, y: 18 }, { x: 34, y: 4 },  { x: 66, y: 4 },
  { x: 90, y: 18 }, { x: 94, y: 46 }, { x: 90, y: 74 },
];
const SEATS_2 = [{ x: 50, y: 88 }, { x: 50, y: 4 }];

function getSeats(n: number) {
  return n <= 2 ? SEATS_2 : n <= 6 ? SEATS_6 : SEATS_9;
}

const PHASE_LABELS: Record<string, string> = {
  waiting: 'WAITING', preflop: 'PRE-FLOP', flop: 'FLOP',
  turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
};

/* ─── Chip Stack Visual ─── */
function ChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  const chips: typeof CHIP_VALUES[number][] = [];
  let remaining = amount;
  for (let i = CHIP_VALUES.length - 1; i >= 0; i--) {
    const cv = CHIP_VALUES[i];
    while (remaining >= cv.value && chips.length < 5) {
      chips.push(cv);
      remaining -= cv.value;
    }
  }
  if (chips.length === 0) chips.push(CHIP_VALUES[0]);

  return (
    <div className="flex items-center gap-0.5">
      <div className="relative" style={{ width: 14, height: 14 + chips.length * 2 }}>
        {chips.slice(0, 4).map((c, i) => (
          <img key={i} src={c.img} alt="" className="absolute w-3.5 h-3.5 rounded-full"
            style={{ bottom: i * 2, left: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
        ))}
      </div>
      <span className="text-[9px] font-bold text-gold ml-0.5 font-mono-poker">
        {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toLocaleString()}
      </span>
    </div>
  );
}

/* ─── Playing Card ─── */
function CardView({ card, faceDown = false, size = 'md' }: {
  card: Card; faceDown?: boolean; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const dims = {
    sm: { w: 26, h: 38 },
    md: { w: 36, h: 52 },
    lg: { w: 48, h: 68 },
    xl: { w: 58, h: 84 },
  };
  const { w, h } = dims[size];
  const fs = {
    sm: { rank: 9, suit: 7, center: 11 },
    md: { rank: 11, suit: 9, center: 15 },
    lg: { rank: 14, suit: 11, center: 20 },
    xl: { rank: 16, suit: 13, center: 24 },
  };

  if (faceDown) {
    return (
      <div className="rounded-md overflow-hidden flex-shrink-0" style={{
        width: w, height: h,
        background: `url(${ASSETS.cardBack}) center/cover`,
        border: '1px solid rgba(212, 175, 55, 0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }} />
    );
  }

  const suitStr = String(card.suit);
  const isRed = suitStr === 'hearts' || suitStr === 'diamonds' || suitStr === 'h' || suitStr === 'd';
  const color = isRed ? '#e53e3e' : '#1a1a2e';
  const symbol = SUIT_SYMBOLS[card.suit] || '?';
  const rankStr = String(card.rank);
  const rank = rankStr === 'T' ? '10' : rankStr;

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
      className="rounded-md flex-shrink-0 relative overflow-hidden"
      style={{
        width: w, height: h,
        background: 'linear-gradient(160deg, #ffffff 0%, #f9f9f9 40%, #f0f0f0 100%)',
        border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 3px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.95)',
      }}
    >
      {/* Top-left rank + suit */}
      <div className="absolute flex flex-col items-center leading-none" style={{ top: 2, left: 3 }}>
        <span className="font-black" style={{ fontSize: fs[size].rank, color, lineHeight: 1 }}>{rank}</span>
        <span style={{ fontSize: fs[size].suit, color, lineHeight: 1 }}>{symbol}</span>
      </div>
      {/* Center suit */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: fs[size].center, color, opacity: 0.8 }}>{symbol}</span>
      </div>
      {/* Bottom-right rank + suit (inverted) */}
      <div className="absolute flex flex-col items-center leading-none rotate-180" style={{ bottom: 2, right: 3 }}>
        <span className="font-black" style={{ fontSize: fs[size].rank, color, lineHeight: 1 }}>{rank}</span>
        <span style={{ fontSize: fs[size].suit, color, lineHeight: 1 }}>{symbol}</span>
      </div>
    </motion.div>
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
  const isTop = pos.y < 35;

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
      {/* Hole cards — show above for top players, skip for hero */}
      {!isHero && isTop && player.holeCards.length > 0 && !player.folded && (
        <div className="flex gap-0.5 mb-0.5">
          {player.holeCards.map((c, i) => (
            <CardView key={i} card={c as Card} faceDown={!isShowdown} size="sm" />
          ))}
        </div>
      )}

      {/* Player container */}
      <div className={`relative ${player.folded ? 'opacity-25 grayscale' : ''} transition-all duration-300`}>
        {/* Timer ring */}
        {isAction && !player.folded && (
          <svg className="absolute" viewBox="0 0 52 52" style={{ width: '130%', height: '130%', left: '-15%', top: '-15%' }}>
            <circle cx="26" cy="26" r="24" fill="none" stroke="rgba(212,175,55,0.08)" strokeWidth="2" />
            <circle cx="26" cy="26" r="24" fill="none"
              stroke={timerPct > 0.5 ? '#D4AF37' : timerPct > 0.25 ? '#f59e0b' : '#ef4444'}
              strokeWidth="2.5"
              strokeDasharray={`${timerPct * 150.8} 150.8`}
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
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* Avatar */}
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden" style={{
          border: `2px solid ${
            isWinner ? '#D4AF37'
            : isAction ? 'rgba(212,175,55,0.8)'
            : isHero ? 'rgba(212,175,55,0.4)'
            : 'rgba(255,255,255,0.08)'
          }`,
          boxShadow: isWinner
            ? '0 0 20px rgba(212,175,55,0.6)'
            : isAction
            ? '0 0 12px rgba(212,175,55,0.3)'
            : '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          <img src={avatarUrl} alt={player.name} className="w-full h-full object-cover" />
        </div>

        {/* Position badges */}
        {isDealer && (
          <div className="absolute -top-0.5 -right-0.5 z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[5px] font-black"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)', color: '#000', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>D</div>
        )}
        {isSB && !isDealer && (
          <div className="absolute -top-0.5 -right-0.5 z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[5px] font-black"
            style={{ background: '#3b82f6', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>S</div>
        )}
        {isBB && !isDealer && !isSB && (
          <div className="absolute -top-0.5 -right-0.5 z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[5px] font-black"
            style={{ background: '#ef4444', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>B</div>
        )}
      </div>

      {/* Name + stack plate */}
      <div className="mt-0.5 text-center px-1.5 py-0.5 rounded-md" style={{
        background: isHero
          ? 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))'
          : 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        border: isHero
          ? '1px solid rgba(212,175,55,0.15)'
          : '1px solid rgba(255,255,255,0.03)',
        minWidth: 44,
      }}>
        <div className={`text-[7px] sm:text-[8px] font-semibold truncate max-w-[50px] sm:max-w-[60px] ${isHero ? 'text-gold-light' : 'text-gray-300'}`}>
          {isHero ? 'YOU' : player.name}
        </div>
        <div className="text-[7px] sm:text-[8px] font-bold text-gold font-mono-poker">
          {player.chipStack >= 1000 ? `${(player.chipStack / 1000).toFixed(1)}k` : player.chipStack.toLocaleString()}
        </div>
      </div>

      {/* Current bet */}
      {player.currentBet > 0 && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-0.5">
          <ChipStack amount={player.currentBet} />
        </motion.div>
      )}

      {/* Last action badge */}
      {player.lastAction && (
        <motion.div
          initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
          className="mt-0.5 px-1.5 py-0.5 rounded-full text-[6px] sm:text-[7px] font-black uppercase tracking-wider"
          style={{
            background: player.lastAction.startsWith('WIN')
              ? 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))'
              : player.lastAction === 'FOLD'
              ? 'rgba(255,0,0,0.15)'
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
            <CardView key={i} card={c as Card} faceDown={!isShowdown} size="sm" />
          ))}
        </div>
      )}
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

  const { data: tableConfig } = trpc.tables.get.useQuery({ id: tableId });

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
      { label: '2BB', value: Math.min(bb * 2 + gameState.currentBet, maxRaise) },
      { label: '3BB', value: Math.min(bb * 3 + gameState.currentBet, maxRaise) },
      { label: '½ Pot', value: Math.min(Math.floor(pot / 2) + gameState.currentBet, maxRaise) },
      { label: 'Pot', value: Math.min(pot + gameState.currentBet, maxRaise) },
    ].filter(p => p.value >= minR && p.value <= maxRaise);
  }, [gameState, heroPlayer, totalPot, minRaise, maxRaise]);

  /* ─── Loading State ─── */
  if (!connected || !gameState) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 noise-overlay" style={{
        background: 'radial-gradient(ellipse at center, rgba(10,8,4,1) 0%, rgba(4,4,6,1) 100%)',
      }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <img src={ASSETS.ui.crown} alt="" className="w-12 h-12" style={{ filter: 'drop-shadow(0 4px 12px rgba(212,175,55,0.3))' }} />
        </motion.div>
        <p className="text-gray-400 text-sm font-medium">{!connected ? 'Connecting...' : 'Joining table...'}</p>
        {!user && <p className="text-gold/60 text-xs">Please sign in to play</p>}
        <button onClick={() => navigate('/lobby')} className="text-gray-600 text-xs underline mt-4 hover:text-gray-400 transition-colors">
          Back to Lobby
        </button>
      </div>
    );
  }

  /* ─── Main Render ─── */
  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden select-none noise-overlay" style={{
      background: `url(${ASSETS.gameBg}) center/cover no-repeat`,
      backgroundColor: '#050507',
    }}>
      {/* Dark overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(4,4,6,0.6)' }} />

      {/* ─── Top HUD ─── */}
      <div className="relative z-30 flex items-center justify-between px-2 py-1.5 shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 80%, transparent 100%)',
      }}>
        <button onClick={() => { leaveTable(tableId); navigate('/lobby'); }}
          className="w-7 h-7 rounded-full flex items-center justify-center glass-card active:scale-90 transition-transform">
          <ArrowLeft size={12} className="text-gray-400" />
        </button>

        <div className="flex items-center gap-1.5">
          <div className="glass-card px-2.5 py-1 rounded-lg text-center">
            <div className="text-[7px] uppercase tracking-[0.15em] text-gray-500 font-semibold">
              {PHASE_LABELS[gameState.phase]} #{gameState.handNumber}
            </div>
            <div className="text-[10px] font-bold text-gold font-mono-poker">
              {gameState.smallBlind}/{gameState.bigBlind}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {gameState.phase !== 'showdown' && gameState.phase !== 'waiting' && (
            <div className={`glass-card px-1.5 py-1 rounded-lg flex items-center gap-0.5 ${turnTimer <= 10 ? 'border border-red-500/20' : ''}`}>
              <Clock size={9} className={turnTimer <= 10 ? 'text-red-400' : 'text-gray-500'} />
              <span className={`text-[9px] font-bold font-mono-poker ${turnTimer <= 10 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
                {turnTimer}s
              </span>
            </div>
          )}
          <div className="glass-card px-1.5 py-1 rounded-lg flex items-center gap-0.5">
            {connected ? <Wifi size={8} className="text-emerald-400" /> : <WifiOff size={8} className="text-red-400" />}
            <Users size={8} className="text-gray-500" />
            <span className="text-[8px] text-gray-500">{gameState.players.length}</span>
          </div>
        </div>
      </div>

      {/* ─── Table Area ─── */}
      <div className="flex-1 relative z-10" style={{ minHeight: 0 }}>
        <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full" style={{ maxWidth: 720, aspectRatio: '16/10' }}>

            {/* Poker table — outer rim */}
            <div className="absolute inset-[3%] sm:inset-[5%]" style={{
              borderRadius: '50%/50%',
              background: 'linear-gradient(180deg, rgba(20,18,12,0.98) 0%, rgba(10,10,16,0.99) 100%)',
              boxShadow: `
                0 0 0 2px rgba(212,175,55,0.04),
                0 0 0 5px rgba(6,6,10,0.95),
                0 0 60px rgba(0,0,0,0.8),
                inset 0 0 40px rgba(0,0,0,0.3)
              `,
              border: '1px solid rgba(212,175,55,0.04)',
            }}>
              {/* Green felt */}
              <div className="absolute" style={{
                left: '4%', right: '4%', top: '6%', bottom: '6%',
                borderRadius: '50%',
                background: 'radial-gradient(ellipse at 50% 40%, #1a7035 0%, #14602c 20%, #0d4d22 45%, #083a17 70%, #042810 100%)',
                boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), inset 0 -10px 30px rgba(0,0,0,0.2)',
                border: '1px solid rgba(212,175,55,0.02)',
              }}>
                {/* Felt texture overlay */}
                <div className="absolute inset-0 rounded-[50%] opacity-[0.02]" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 5h1v1H1V5zm2-2h1v1H3V3zm2-2h1v1H5V1z' fill='%23ffffff' fill-opacity='0.3'/%3E%3C/svg%3E")`,
                }} />
              </div>
            </div>

            {/* ─── Pot Display ─── */}
            {totalPot > 0 && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-0.5"
                style={{
                  top: '18%',
                  background: 'rgba(0,0,0,0.85)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: 10,
                  padding: '3px 10px',
                  border: '1px solid rgba(212,175,55,0.2)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}
              >
                <div className="flex items-center gap-1">
                  <img src={ASSETS.chips.gold} alt="" className="w-3 h-3" style={{ filter: 'drop-shadow(0 1px 3px rgba(212,175,55,0.4))' }} />
                  <span className="text-[10px] sm:text-xs font-bold text-gold font-mono-poker">
                    {totalPot.toLocaleString()}
                  </span>
                </div>
                {/* Side pots */}
                {hasMultiplePots && (
                  <div className="flex gap-1">
                    {gameState!.pots.filter(p => p.amount > 0).map((pot, i) => (
                      <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono-poker">
                        {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── Community Cards ─── */}
            <div className="absolute left-1/2 flex gap-0.5 sm:gap-1 z-10" style={{ top: '40%', transform: 'translate(-50%, -50%)' }}>
              <AnimatePresence>
                {gameState.communityCards.map((card, i) => (
                  <motion.div key={`cc-${i}`} initial={{ y: -12, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
                    <CardView card={card as Card} size="sm" />
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* Empty slots */}
              {gameState.communityCards.length < 5 && gameState.phase !== 'waiting' && (
                Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                  <div key={`e-${i}`} className="rounded-md" style={{
                    width: 26, height: 38,
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px dashed rgba(255,255,255,0.03)',
                  }} />
                ))
              )}
            </div>

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
          </div>
        </div>
      </div>

      {/* ─── Hero Cards ─── */}
      <div className="shrink-0 relative z-20" style={{
        background: 'linear-gradient(0deg, rgba(4,4,6,0.85) 0%, rgba(4,4,6,0.4) 60%, transparent 100%)',
        minHeight: 36,
      }}>
        {heroPlayer && !heroPlayer.folded && heroPlayer.holeCards && heroPlayer.holeCards.length > 0 ? (
          <div className="flex justify-center gap-1.5 sm:gap-2 py-1">
            {heroPlayer.holeCards.map((card, i) => (
              <motion.div
                key={`hero-${i}-${card.rank}-${card.suit}`}
                whileHover={{ y: -4, scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <CardView card={card as Card} size="lg" />
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
              className="glass-card rounded-2xl p-5 mx-4 text-center max-w-xs"
              style={{ border: '1px solid rgba(212,175,55,0.2)', boxShadow: '0 0 40px rgba(212,175,55,0.15)' }}
            >
              <img src={ASSETS.ui.trophy} alt="" className="w-12 h-12 mx-auto mb-2" style={{ filter: 'drop-shadow(0 4px 12px rgba(212,175,55,0.3))' }} />
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
      <div className="shrink-0 relative z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {gameState.phase === 'waiting' ? (
          <div className="px-3 py-3 text-center" style={{
            background: 'rgba(4,4,6,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.03)',
          }}>
            <div className="text-sm text-gray-400 font-medium">Waiting for players...</div>
            <div className="text-[10px] text-gray-600 mt-0.5 font-mono-poker">{gameState.players.length} / {tableSize} seated</div>
          </div>
        ) : isMyTurn ? (
          /* YOUR TURN */
          <div className="px-2 py-2 space-y-1.5" style={{
            background: 'rgba(4,4,6,0.96)',
            backdropFilter: 'blur(24px)',
            borderTop: '2px solid rgba(212,175,55,0.2)',
          }}>
            {/* YOUR TURN label */}
            <div className="text-center">
              <span className="text-[9px] font-bold text-gold animate-pulse uppercase tracking-[0.2em]">Your Turn</span>
            </div>

            {/* Raise slider */}
            <AnimatePresence>
              {showRaise && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {/* Presets */}
                  <div className="flex gap-1 mb-1.5">
                    {raisePresets.map(p => (
                      <button key={p.label} onClick={() => setRaiseAmount(p.value)}
                        className={`flex-1 py-1 rounded-lg text-[8px] sm:text-[9px] font-bold transition-all ${
                          raiseAmount === p.value
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'glass-card text-gray-500 hover:text-gray-300'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {/* Slider + confirm */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] sm:text-[10px] font-bold text-gold font-mono-poker w-12 text-right">
                      {raiseAmount >= 1000 ? `${(raiseAmount / 1000).toFixed(1)}k` : raiseAmount.toLocaleString()}
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
                      className="btn-primary-poker px-3 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold tracking-wider">
                      RAISE
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main action buttons */}
            <div className="flex gap-1 sm:gap-1.5">
              {/* FOLD */}
              <button onClick={() => handleAction('fold')}
                className="flex-1 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all active:scale-95 tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, #7f1d1d, #450a0a)',
                  color: '#fca5a5',
                  border: '1px solid rgba(220,38,38,0.2)',
                  boxShadow: '0 2px 8px rgba(127,29,29,0.3)',
                }}>
                FOLD
              </button>

              {/* CHECK / CALL */}
              {canCheck ? (
                <button onClick={() => handleAction('check')}
                  className="flex-1 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all active:scale-95 tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #065f46, #022c22)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16,185,129,0.2)',
                    boxShadow: '0 2px 8px rgba(6,95,70,0.3)',
                  }}>
                  CHECK
                </button>
              ) : (
                <button onClick={() => handleAction('call')}
                  className="flex-1 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all active:scale-95 tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #065f46, #022c22)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16,185,129,0.2)',
                    boxShadow: '0 2px 8px rgba(6,95,70,0.3)',
                  }}>
                  CALL {callAmount >= 1000 ? `${(callAmount / 1000).toFixed(1)}k` : callAmount.toLocaleString()}
                </button>
              )}

              {/* RAISE toggle */}
              <button onClick={() => setShowRaise(!showRaise)}
                className="flex-1 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all active:scale-95 tracking-wider"
                style={{
                  background: showRaise
                    ? 'rgba(212,175,55,0.1)'
                    : 'linear-gradient(135deg, #D4AF37, #9A7B1F)',
                  color: showRaise ? '#D4AF37' : '#0a0a0f',
                  border: showRaise ? '1px solid rgba(212,175,55,0.2)' : '1px solid rgba(212,175,55,0.3)',
                  boxShadow: showRaise ? 'none' : '0 2px 8px rgba(212,175,55,0.2)',
                }}>
                RAISE
              </button>

              {/* ALL IN */}
              {heroPlayer && heroPlayer.chipStack > 0 && (
                <button onClick={() => handleAction('allin')}
                  className="py-2.5 px-2 rounded-xl text-[8px] sm:text-[9px] font-bold transition-all active:scale-95 tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #c2410c, #7c2d12)',
                    color: '#fed7aa',
                    border: '1px solid rgba(234,88,12,0.2)',
                    boxShadow: '0 2px 8px rgba(194,65,12,0.3)',
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
            borderTop: '1px solid rgba(255,255,255,0.03)',
          }}>
            {heroPlayer?.folded ? (
              <div className="text-center py-1">
                <span className="text-[10px] text-gray-600 tracking-wider">Folded — waiting for next hand</span>
              </div>
            ) : gameState.phase === 'showdown' ? (
              <div className="text-center py-1">
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
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all tracking-wider ${
                      preAction === 'check_fold'
                        ? 'bg-red-900/20 text-red-400/80 border border-red-500/20'
                        : 'glass-card text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {preAction === 'check_fold' ? '✓ ' : ''}Check/Fold
                  </button>
                  <button
                    onClick={() => setPreAction(preAction === 'call_any' ? null : 'call_any')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all tracking-wider ${
                      preAction === 'call_any'
                        ? 'bg-emerald-900/20 text-emerald-400/80 border border-emerald-500/20'
                        : 'glass-card text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {preAction === 'call_any' ? '✓ ' : ''}Call Any
                  </button>
                  <button
                    onClick={() => setPreAction(preAction === 'fold_to_bet' ? null : 'fold_to_bet')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all tracking-wider ${
                      preAction === 'fold_to_bet'
                        ? 'bg-orange-900/20 text-orange-400/80 border border-orange-500/20'
                        : 'glass-card text-gray-500 hover:text-gray-300'
                    }`}
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
