/**
 * GameTable — Premium Poker Table (PokerBros / PPPoker style)
 * Dark luxury design with gold accents, large action buttons,
 * player action badges, countdown timer, "TEXAS HOLD'EM" branding
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Clock, Users, Wifi, WifiOff, MessageCircle, Smile, Settings } from 'lucide-react';
import { useSocket, ServerPlayer } from '@/hooks/useSocket';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { ASSETS } from '@/lib/assets';
import type { Card } from '@/lib/assets';
import { toast } from 'sonner';
import PokerCard from '@/components/PokerCard';
import { formatChipAmount } from '@/components/PokerChip';
import TableBackground from '@/components/TableBackground';

/* ─── Seat positions for 6-max (% of table area) ─── */
const SEATS_6 = [
  { x: 50, y: 86 },   // 0: hero (bottom center)
  { x: 15, y: 68 },   // 1: left-bottom
  { x: 15, y: 28 },   // 2: left-top
  { x: 50, y: 10 },   // 3: top center
  { x: 85, y: 28 },   // 4: right-top
  { x: 85, y: 68 },   // 5: right-bottom
];
const SEATS_9 = [
  { x: 50, y: 86 }, { x: 14, y: 72 }, { x: 12, y: 48 },
  { x: 14, y: 20 }, { x: 36, y: 6 }, { x: 64, y: 6 },
  { x: 86, y: 20 }, { x: 88, y: 48 }, { x: 86, y: 72 },
];
const SEATS_2 = [{ x: 50, y: 84 }, { x: 50, y: 8 }];

function getSeats(n: number) {
  return n <= 2 ? SEATS_2 : n <= 6 ? SEATS_6 : SEATS_9;
}

/* ─── Bet pill positions — closer to center ─── */
function getBetPos(px: number, py: number) {
  const cx = 50, cy = 44;
  const dx = cx - px, dy = cy - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const factor = Math.min(0.5, 20 / dist);
  return { x: px + dx * factor, y: py + dy * factor };
}

const PHASE_LABELS: Record<string, string> = {
  waiting: 'WAITING', preflop: 'PRE-FLOP', flop: 'FLOP',
  turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
};

/* ─── Action status badge colors ─── */
const ACTION_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  fold:  { bg: '#374151', text: '#9CA3AF', border: '#4B5563' },
  call:  { bg: '#1E3A5F', text: '#60A5FA', border: '#2563EB' },
  check: { bg: '#1E3A5F', text: '#60A5FA', border: '#2563EB' },
  raise: { bg: '#14532D', text: '#4ADE80', border: '#16A34A' },
  bet:   { bg: '#14532D', text: '#4ADE80', border: '#16A34A' },
  allin: { bg: '#7F1D1D', text: '#FCA5A5', border: '#DC2626' },
  'all-in': { bg: '#7F1D1D', text: '#FCA5A5', border: '#DC2626' },
};

function getActionBadge(action: string) {
  const key = action.toLowerCase().replace(/[^a-z-]/g, '');
  return ACTION_BADGE[key] || ACTION_BADGE.fold;
}

/* ─── Position Badge (D/SB/BB) ─── */
function PosBadge({ label, bg }: { label: string; bg: string }) {
  return (
    <div className="absolute -top-1 -right-1 z-20 w-[16px] h-[16px] rounded-full flex items-center justify-center text-[7px] font-black text-white shadow-lg"
      style={{ background: bg, border: '1.5px solid rgba(255,255,255,0.3)' }}>
      {label}
    </div>
  );
}

/* ─── Countdown Timer ─── */
function CountdownTimer({ deadline, serverOffset }: { deadline: number; serverOffset: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => {
      const now = Date.now() - serverOffset;
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
      setSeconds(remaining);
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [deadline, serverOffset]);

  const isLow = seconds <= 5;
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold font-mono-poker ${isLow ? 'text-red-400' : 'text-amber-300'}`}
      style={{
        background: isLow ? 'rgba(220,38,38,0.15)' : 'rgba(212,175,55,0.1)',
        border: `1px solid ${isLow ? 'rgba(220,38,38,0.3)' : 'rgba(212,175,55,0.2)'}`,
      }}>
      <Clock size={12} />
      <span>{seconds}s</span>
    </div>
  );
}

/* ─── Player Card (avatar + name + stack + action badge) ─── */
function PlayerSeat({
  player, isHero, isDealer, isSB, isBB, isActive, seatPos, maxSeats,
  onSit,
}: {
  player: ServerPlayer | null;
  isHero: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isActive: boolean;
  seatPos: { x: number; y: number };
  maxSeats: number;
  onSit: () => void;
}) {
  if (!player) {
    // Empty seat
    return (
      <div className="absolute flex flex-col items-center" style={{
        left: `${seatPos.x}%`, top: `${seatPos.y}%`,
        transform: 'translate(-50%, -50%)',
      }}>
        <button
          onClick={onSit}
          className="w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-[10px] font-bold hover:border-gold hover:text-gold transition-colors"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          SIT
        </button>
      </div>
    );
  }

  const avatarKey = player.avatar || 'fox';
  const avatarUrl = ASSETS.avatars[avatarKey as keyof typeof ASSETS.avatars] || ASSETS.avatars.fox;
  const isLeft = seatPos.x < 30;
  const isRight = seatPos.x > 70;

  return (
    <div className="absolute flex flex-col items-center" style={{
      left: `${seatPos.x}%`, top: `${seatPos.y}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: isHero ? 30 : isActive ? 25 : 10,
    }}>
      {/* Face-down cards for non-hero players */}
      {!isHero && !player.folded && player.holeCards.length === 0 && (
        <div className="flex -mb-1 relative z-0">
          <div className="transform -rotate-6">
            <PokerCard card={{ suit: 's', rank: 'A' }} faceDown size="sm" animate={false} />
          </div>
          <div className="transform rotate-6 -ml-4">
            <PokerCard card={{ suit: 's', rank: 'A' }} faceDown size="sm" animate={false} />
          </div>
        </div>
      )}

      {/* Showdown cards for non-hero */}
      {!isHero && player.holeCards.length > 0 && (
        <div className="flex -mb-2 relative z-0 gap-0.5">
          {player.holeCards.map((c, i) => (
            <PokerCard key={i} card={c} size="sm" animate delay={i * 0.1} />
          ))}
        </div>
      )}

      {/* Avatar + Info card */}
      <div className="relative">
        {/* Active turn glow */}
        {isActive && (
          <motion.div
            className="absolute -inset-1 rounded-xl"
            style={{ background: 'rgba(212,175,55,0.15)', border: '1.5px solid rgba(212,175,55,0.4)' }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* Info card with avatar */}
        <div className="relative rounded-lg overflow-hidden" style={{
          background: isHero
            ? 'linear-gradient(180deg, rgba(30,30,50,0.95) 0%, rgba(15,15,25,0.98) 100%)'
            : 'linear-gradient(180deg, rgba(20,20,35,0.9) 0%, rgba(10,10,20,0.95) 100%)',
          border: isActive ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.08)',
          minWidth: '90px',
        }}>
          <div className="flex items-center gap-2 px-2 py-1.5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden" style={{
                border: isHero ? '2px solid #D4AF37' : '1.5px solid rgba(255,255,255,0.15)',
                boxShadow: isHero ? '0 0 10px rgba(212,175,55,0.3)' : 'none',
              }}>
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              </div>
              {/* Position badges */}
              {isDealer && <PosBadge label="D" bg="#D4AF37" />}
              {isSB && !isDealer && <PosBadge label="SB" bg="#3B82F6" />}
              {isBB && !isDealer && <PosBadge label="BB" bg="#EF4444" />}
            </div>

            {/* Name + Stack */}
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-gray-200 truncate max-w-[80px] leading-tight">
                {player.name}
              </span>
              <span className="text-[12px] font-bold text-amber-300 font-mono-poker leading-tight flex items-center gap-0.5">
                <img src={ASSETS.ui.coin} alt="" className="w-3.5 h-3.5" />
                {formatChipAmount(player.chipStack)}
              </span>
            </div>
          </div>
        </div>

        {/* Action badge below card */}
        {player.lastAction && !player.folded && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="px-3 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
              style={{
                background: getActionBadge(player.lastAction).bg,
                color: getActionBadge(player.lastAction).text,
                border: `1px solid ${getActionBadge(player.lastAction).border}`,
              }}>
              {player.allIn ? 'ALL-IN' : player.lastAction.toUpperCase()}
              {player.currentBet > 0 && !player.allIn && ` ${formatChipAmount(player.currentBet)}`}
            </div>
          </motion.div>
        )}

        {/* Folded overlay */}
        {player.folded && (
          <div className="absolute inset-0 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">FOLD</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Bet Pill ─── */
function BetPill({ amount, x, y }: { amount: number; x: number; y: number }) {
  if (amount <= 0) return null;
  return (
    <div className="absolute z-15 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
      style={{
        left: `${x}%`, top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, rgba(180,140,40,0.85) 0%, rgba(140,100,20,0.9) 100%)',
        border: '1px solid rgba(255,220,100,0.3)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}>
      <img src={ASSETS.chips.gold} alt="" className="w-3 h-3" />
      <span className="text-[9px] font-bold text-white font-mono-poker">{formatChipAmount(amount)}</span>
    </div>
  );
}

/* ─── Main GameTable Component ─── */
export default function GameTable() {
  const params = useParams<{ id: string }>();
  const tableId = parseInt(params.id || '1');
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { connected, gameState, mySeatIndex, error, joinTable, leaveTable, sendAction, sendChat, timeOffset } = useSocket();
  const { data: tableConfig } = trpc.tables.get.useQuery({ id: tableId });

  // Raise state
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaisePanel, setShowRaisePanel] = useState(false);
  // Pre-action
  const [preAction, setPreAction] = useState<string | null>(null);
  // Showdown
  const [showdownOverlay, setShowdownOverlay] = useState<any>(null);

  // Auto-join
  useEffect(() => {
    console.log('[GameTable] Auto-join check:', { connected, hasUser: !!user, userId: user?.id, tableId });
    if (connected && user && tableId) {
      console.log('[GameTable] Calling joinTable:', tableId, user.id);
      joinTable(tableId, user.id);
    }
  }, [connected, user, tableId, joinTable]);

  // Auto-leave on unmount
  useEffect(() => {
    return () => { if (tableId) leaveTable(tableId); };
  }, [tableId, leaveTable]);

  // Initialize raise amount
  useEffect(() => {
    if (gameState) {
      setRaiseAmount(gameState.minRaise || gameState.bigBlind * 2);
    }
  }, [gameState?.minRaise, gameState?.bigBlind]);

  // Execute pre-action when it's our turn
  useEffect(() => {
    if (!gameState || !preAction || mySeatIndex < 0) return;
    if (gameState.actionSeat !== mySeatIndex) return;

    const heroPlayer = gameState.players.find(p => p.seatIndex === mySeatIndex);
    if (!heroPlayer) return;

    const toCall = gameState.currentBet - heroPlayer.currentBet;

    if (preAction === 'check_fold') {
      sendAction(tableId, toCall > 0 ? 'fold' : 'check');
    } else if (preAction === 'call_any') {
      sendAction(tableId, toCall > 0 ? 'call' : 'check');
    } else if (preAction === 'fold_to_bet') {
      if (toCall > 0) sendAction(tableId, 'fold');
    }
    setPreAction(null);
  }, [gameState?.actionSeat, preAction, mySeatIndex]);

  // Showdown detection
  useEffect(() => {
    if (gameState?.phase === 'showdown') {
      const winners = gameState.players.filter(p => !p.folded && p.holeCards.length > 0);
      if (winners.length > 0) {
        setShowdownOverlay({
          winners,
          pots: gameState.pots,
        });
        setTimeout(() => setShowdownOverlay(null), 4000);
      }
    }
  }, [gameState?.phase, gameState?.handNumber]);

  // Derived state
  const maxSeats = tableConfig ? parseInt(tableConfig.tableSize) : 6;
  const seats = getSeats(maxSeats);
  const heroPlayer = gameState?.players.find(p => p.seatIndex === mySeatIndex);
  const isMyTurn = gameState?.actionSeat === mySeatIndex && mySeatIndex >= 0;
  const toCall = heroPlayer ? gameState!.currentBet - heroPlayer.currentBet : 0;
  const canCheck = toCall <= 0;
  const totalPot = gameState ? gameState.pots.reduce((s, p) => s + p.amount, 0) + gameState.players.reduce((s, p) => s + p.currentBet, 0) : 0;

  // Action handlers
  const handleFold = useCallback(() => { sendAction(tableId, 'fold'); setShowRaisePanel(false); }, [tableId, sendAction]);
  const handleCall = useCallback(() => { sendAction(tableId, 'call'); setShowRaisePanel(false); }, [tableId, sendAction]);
  const handleCheck = useCallback(() => { sendAction(tableId, 'check'); setShowRaisePanel(false); }, [tableId, sendAction]);
  const handleRaise = useCallback(() => { sendAction(tableId, 'raise', raiseAmount); setShowRaisePanel(false); }, [tableId, sendAction, raiseAmount]);
  const handleAllIn = useCallback(() => {
    if (heroPlayer) sendAction(tableId, 'raise', heroPlayer.chipStack + heroPlayer.currentBet);
    setShowRaisePanel(false);
  }, [tableId, sendAction, heroPlayer]);

  const handleSit = useCallback((seatIdx: number) => {
    if (user) joinTable(tableId, user.id, seatIdx);
  }, [user, tableId, joinTable]);

  // Raise presets
  const bb = gameState?.bigBlind || 2;
  const minR = gameState?.minRaise || bb * 2;
  const maxR = heroPlayer ? heroPlayer.chipStack + heroPlayer.currentBet : 0;

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden relative"
      style={{ background: '#0A0A12' }}>

      {/* Background */}
      <TableBackground />

      {/* ─── Top Bar ─── */}
      <div className="relative z-40 flex items-center justify-between px-3 py-2 safe-area-top"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/lobby')} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <ArrowLeft size={16} />
          </button>
          {user && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <img src={ASSETS.ui.coin} alt="" className="w-3.5 h-3.5" />
              <span className="text-xs font-bold text-amber-300 font-mono-poker">
                {formatChipAmount(heroPlayer?.chipStack || 0)}
              </span>
            </div>
          )}
        </div>

        {/* Timer */}
        {gameState && gameState.actionDeadline > 0 && gameState.phase !== 'waiting' && (
          <CountdownTimer deadline={gameState.actionDeadline} serverOffset={timeOffset} />
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            {connected ? <Wifi size={10} className="text-green-500" /> : <WifiOff size={10} className="text-red-500" />}
            <Users size={10} />
            <span>{gameState?.players.length || 0}/{maxSeats}</span>
          </div>
          <button className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-300"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* ─── Game Info Bar ─── */}
      <div className="relative z-30 flex items-center justify-center gap-2 py-1">
        <span className="text-[10px] font-medium text-gray-500 tracking-wider">
          NLH ~ {tableConfig?.smallBlind || 1}/{tableConfig?.bigBlind || 2} {maxSeats}MAX
        </span>
        <span className="text-[9px] text-gray-600">•</span>
        <span className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: gameState?.phase === 'showdown' ? '#D4AF37' : '#6B7280' }}>
          {PHASE_LABELS[gameState?.phase || 'waiting']} #{gameState?.handNumber || 0}
        </span>
      </div>

      {/* ─── TABLE AREA (flex-1) ─── */}
      <div className="flex-1 relative z-10 mx-auto w-full" style={{ maxWidth: '420px' }}>
        {/* Table oval */}
        <div className="absolute inset-2 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Outer glow */}
            <div className="absolute inset-0 rounded-[50%]" style={{
              background: 'transparent',
              boxShadow: '0 0 60px rgba(255,255,255,0.06), 0 0 120px rgba(212,175,55,0.03)',
            }} />

            {/* White border ring */}
            <div className="absolute inset-0 rounded-[50%]" style={{
              border: '2.5px solid rgba(255,255,255,0.2)',
              boxShadow: '0 0 30px rgba(255,255,255,0.08), 0 0 60px rgba(255,255,255,0.04), inset 0 0 30px rgba(255,255,255,0.03)',
            }} />

            {/* Dark felt surface */}
            <div className="absolute inset-[3px] rounded-[50%] overflow-hidden" style={{
              background: 'radial-gradient(ellipse at 50% 35%, #1a3a28 0%, #142e1f 25%, #0d2216 50%, #091a10 75%, #06120b 100%)',
              boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5)',
            }}>
              {/* Subtle felt texture */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }} />

              {/* Center light spot */}
              <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse at 50% 40%, rgba(30,80,45,0.3) 0%, transparent 50%)',
              }} />
            </div>

            {/* ─── "TEXAS HOLD'EM" center text ─── */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center" style={{ transform: 'translateY(10%)' }}>
                <div className="text-[11px] font-display font-bold tracking-[0.3em] uppercase"
                  style={{ color: 'rgba(212,175,55,0.12)' }}>
                  Texas Hold'em
                </div>
              </div>
            </div>

            {/* ─── Pot Display ─── */}
            {totalPot > 0 && (
              <div className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{
                  top: '30%',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(212,175,55,0.2)',
                  backdropFilter: 'blur(8px)',
                }}>
                <img src={ASSETS.ui.trophy} alt="" className="w-3.5 h-3.5" />
                <span className="text-xs font-bold text-amber-300 font-mono-poker">{formatChipAmount(totalPot)}</span>
              </div>
            )}

            {/* ─── Community Cards ─── */}
            {gameState && gameState.communityCards.length > 0 && (
              <div className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-1"
                style={{ top: '42%', transform: 'translate(-50%, -50%)' }}>
                {gameState.communityCards.map((card, i) => (
                  <PokerCard key={`cc-${i}`} card={card} size="md" delay={i * 0.08} />
                ))}
                {/* Placeholder slots for remaining cards */}
                {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-[44px] h-[63px] rounded-md"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.05)' }} />
                ))}
              </div>
            )}

            {/* ─── Player Seats ─── */}
            {seats.map((seatPos, seatIdx) => {
              const player = gameState?.players.find(p => p.seatIndex === seatIdx) || null;
              const isHero = seatIdx === mySeatIndex;
              const isDealer = gameState?.dealerSeat === seatIdx;
              const isSB = gameState?.smallBlindSeat === seatIdx;
              const isBB = gameState?.bigBlindSeat === seatIdx;
              const isActive = gameState?.actionSeat === seatIdx;

              return (
                <PlayerSeat
                  key={seatIdx}
                  player={player}
                  isHero={isHero}
                  isDealer={isDealer}
                  isSB={isSB}
                  isBB={isBB}
                  isActive={isActive}
                  seatPos={seatPos}
                  maxSeats={maxSeats}
                  onSit={() => handleSit(seatIdx)}
                />
              );
            })}

            {/* ─── Bet Pills ─── */}
            {gameState?.players.map(player => {
              if (player.currentBet <= 0) return null;
              const seatPos = seats[player.seatIndex];
              if (!seatPos) return null;
              const bp = getBetPos(seatPos.x, seatPos.y);
              return <BetPill key={`bet-${player.seatIndex}`} amount={player.currentBet} x={bp.x} y={bp.y} />;
            })}
          </div>
        </div>
      </div>

      {/* ─── HERO CARDS ─── */}
      {heroPlayer && heroPlayer.holeCards.length > 0 && !heroPlayer.folded && (
        <div className="relative z-30 flex justify-center -mt-4 mb-1">
          <div className="flex gap-1.5">
            {heroPlayer.holeCards.map((card, i) => (
              <motion.div
                key={`hero-${i}`}
                initial={{ y: 30, opacity: 0, rotateY: 90 }}
                animate={{ y: 0, opacity: 1, rotateY: 0 }}
                transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
              >
                <PokerCard card={card} size="xl" animate={false} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Hero folded indicator */}
      {heroPlayer && heroPlayer.folded && (
        <div className="relative z-30 flex justify-center -mt-2 mb-1">
          <span className="text-[10px] text-gray-600 font-medium tracking-wider">FOLDED</span>
        </div>
      )}

      {/* ─── ACTION PANEL ─── */}
      <div className="relative z-40 px-3 pb-3 safe-area-bottom"
        style={{
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
        }}>

        {/* YOUR TURN indicator */}
        {isMyTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mb-1.5"
          >
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-400">Your Turn</span>
          </motion.div>
        )}

        {/* Raise preset panel */}
        <AnimatePresence>
          {showRaisePanel && isMyTurn && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-2"
            >
              {/* Presets row */}
              <div className="flex gap-1.5 mb-2">
                {[
                  { label: 'Min', value: minR },
                  { label: '3BB', value: bb * 3 },
                  { label: '5BB', value: bb * 5 },
                  { label: 'All In', value: maxR },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setRaiseAmount(Math.min(preset.value, maxR))}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-gray-300 transition-colors"
                    style={{
                      background: raiseAmount === Math.min(preset.value, maxR)
                        ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                      border: raiseAmount === Math.min(preset.value, maxR)
                        ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Slider + amount */}
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setRaiseAmount(Math.max(minR, raiseAmount - bb))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  −
                </button>
                <input
                  type="range"
                  min={minR}
                  max={maxR}
                  value={raiseAmount}
                  onChange={e => setRaiseAmount(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none"
                  style={{
                    background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${((raiseAmount - minR) / (maxR - minR)) * 100}%, rgba(255,255,255,0.1) ${((raiseAmount - minR) / (maxR - minR)) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
                <button onClick={() => setRaiseAmount(Math.min(maxR, raiseAmount + bb))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  +
                </button>
              </div>

              {/* Raise amount display + BACK/RAISE buttons */}
              <div className="flex gap-2">
                <button onClick={() => setShowRaisePanel(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-400 tracking-wider"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  BACK
                </button>
                <button onClick={handleRaise}
                  className="flex-[2] py-2.5 rounded-xl text-xs font-bold tracking-wider text-black"
                  style={{
                    background: 'linear-gradient(135deg, #F5E6A3, #D4AF37, #B8941F)',
                    boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
                  }}>
                  RAISE {formatChipAmount(raiseAmount)}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main action buttons */}
        {isMyTurn && !showRaisePanel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2"
          >
            {/* FOLD */}
            <button onClick={handleFold}
              className="flex-1 py-3 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #374151 0%, #1F2937 100%)',
                border: '1px solid #4B5563',
                color: '#D1D5DB',
              }}>
              FOLD
            </button>

            {/* CHECK / CALL */}
            {canCheck ? (
              <button onClick={handleCheck}
                className="flex-1 py-3 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #1E40AF 0%, #1E3A8A 100%)',
                  border: '1px solid #2563EB',
                  color: '#BFDBFE',
                }}>
                CHECK
              </button>
            ) : (
              <button onClick={handleCall}
                className="flex-1 py-3 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #1E40AF 0%, #1E3A8A 100%)',
                  border: '1px solid #2563EB',
                  color: '#BFDBFE',
                }}>
                CALL {formatChipAmount(toCall)}
              </button>
            )}

            {/* RAISE */}
            <button onClick={() => setShowRaisePanel(true)}
              className="flex-1 py-3 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #166534 0%, #14532D 100%)',
                border: '1px solid #16A34A',
                color: '#BBF7D0',
              }}>
              RAISE
            </button>

            {/* ALL-IN */}
            <button onClick={handleAllIn}
              className="flex-1 py-3 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #991B1B 0%, #7F1D1D 100%)',
                border: '1px solid #DC2626',
                color: '#FCA5A5',
              }}>
              ALL-IN
            </button>
          </motion.div>
        )}

        {/* Pre-action buttons (when not our turn) */}
        {!isMyTurn && heroPlayer && !heroPlayer.folded && gameState?.phase !== 'waiting' && gameState?.phase !== 'showdown' && (
          <div className="flex gap-2">
            <button
              onClick={() => setPreAction(preAction === 'check_fold' ? null : 'check_fold')}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold tracking-wider transition-all ${preAction === 'check_fold' ? 'ring-1 ring-amber-400' : ''}`}
              style={{
                background: preAction === 'check_fold' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: preAction === 'check_fold' ? '#D4AF37' : '#6B7280',
              }}>
              Check/Fold
            </button>
            <button
              onClick={() => setPreAction(preAction === 'call_any' ? null : 'call_any')}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold tracking-wider transition-all ${preAction === 'call_any' ? 'ring-1 ring-amber-400' : ''}`}
              style={{
                background: preAction === 'call_any' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: preAction === 'call_any' ? '#D4AF37' : '#6B7280',
              }}>
              Call Any
            </button>
            <button
              onClick={() => setPreAction(preAction === 'fold_to_bet' ? null : 'fold_to_bet')}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold tracking-wider transition-all ${preAction === 'fold_to_bet' ? 'ring-1 ring-amber-400' : ''}`}
              style={{
                background: preAction === 'fold_to_bet' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: preAction === 'fold_to_bet' ? '#D4AF37' : '#6B7280',
              }}>
              Fold to Bet
            </button>
          </div>
        )}

        {/* Waiting state */}
        {gameState?.phase === 'waiting' && (
          <div className="text-center py-2">
            <span className="text-xs text-gray-500 tracking-wider">Waiting for players...</span>
          </div>
        )}

        {/* Chat/emoji buttons */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-400 transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
              onClick={() => toast('Chat coming soon')}>
              <MessageCircle size={14} />
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-400 transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
              onClick={() => toast('Emojis coming soon')}>
              <Smile size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Showdown Overlay ─── */}
      <AnimatePresence>
        {showdownOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-2xl px-6 py-4 text-center"
              style={{
                background: 'linear-gradient(145deg, rgba(20,20,35,0.95) 0%, rgba(10,10,20,0.98) 100%)',
                border: '1px solid rgba(212,175,55,0.2)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(212,175,55,0.1)',
              }}
            >
              <div className="text-[10px] tracking-[0.3em] uppercase text-gray-500 mb-2">Showdown</div>
              {showdownOverlay.winners.map((w: ServerPlayer, i: number) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <img
                    src={ASSETS.avatars[(w.avatar || 'fox') as keyof typeof ASSETS.avatars] || ASSETS.avatars.fox}
                    alt="" className="w-8 h-8 rounded-full"
                    style={{ border: '1.5px solid #D4AF37' }}
                  />
                  <div className="text-left">
                    <div className="text-xs font-bold text-white">{w.name}</div>
                    <div className="flex gap-1 mt-0.5">
                      {w.holeCards.map((c, j) => (
                        <PokerCard key={j} card={c} size="sm" animate delay={j * 0.1} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {showdownOverlay.pots.map((pot: any, i: number) => (
                <div key={i} className="text-xs text-amber-300 font-bold font-mono-poker mt-1">
                  Pot: {formatChipAmount(pot.amount)}
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-xs text-red-300"
          style={{ background: 'rgba(127,29,29,0.9)', border: '1px solid rgba(220,38,38,0.3)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
