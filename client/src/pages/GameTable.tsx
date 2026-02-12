/**
 * GameTable — Premium Poker Table (Reference: dark luxury casino)
 * Programmatic rendering (nano banano) — no external images for UI elements
 * Dark luxury design: dark felt table, gold trim, large cards, action badges
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Clock, Users, Wifi, WifiOff, Settings, Mail } from 'lucide-react';
import { useSocket, ServerPlayer } from '@/hooks/useSocket';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { ASSETS } from '@/lib/assets';
import type { Card } from '@/lib/assets';
import { toast } from 'sonner';
import PokerCard from '@/components/PokerCard';
import { formatChipAmount } from '@/components/PokerChip';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

/* ─── 6-max seat positions (% of container) ─── */
const SEATS_6 = [
  { x: 50, y: 80 },   // 0: hero (bottom center)
  { x: 13, y: 60 },   // 1: left-bottom
  { x: 13, y: 28 },   // 2: left-top
  { x: 50, y: 10 },   // 3: top center
  { x: 87, y: 28 },   // 4: right-top
  { x: 87, y: 60 },   // 5: right-bottom
];

/* Bet pill positions — offset toward center */
function getBetPos(px: number, py: number) {
  const cx = 50, cy = 42;
  const dx = cx - px, dy = cy - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const factor = Math.min(0.45, 18 / dist);
  return { x: px + dx * factor, y: py + dy * factor };
}

const PHASE_LABELS: Record<string, string> = {
  waiting: 'WAITING', preflop: 'PRE-FLOP', flop: 'FLOP',
  turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
};

/* ─── Action Badge Colors (matching reference) ─── */
const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  fold:    { bg: '#4B5563', text: '#E5E7EB' },
  call:    { bg: '#1D4ED8', text: '#BFDBFE' },
  check:   { bg: '#1D4ED8', text: '#BFDBFE' },
  raise:   { bg: '#15803D', text: '#BBF7D0' },
  bet:     { bg: '#15803D', text: '#BBF7D0' },
  allin:   { bg: '#B91C1C', text: '#FCA5A5' },
  'all-in':{ bg: '#B91C1C', text: '#FCA5A5' },
};

function getActionColor(action: string) {
  const key = action.toLowerCase().replace(/[^a-z-]/g, '');
  return ACTION_COLORS[key] || ACTION_COLORS.fold;
}

/* ─── Programmatic Chip Stack (nano banano) ─── */
function ChipStackSVG({ amount, side = 'left' }: { amount: number; side?: 'left' | 'right' }) {
  if (amount <= 0) return null;
  const chipCount = Math.min(Math.max(1, Math.ceil(Math.log10(Math.max(amount, 2)))), 5);
  const colors = ['#D4AF37', '#DC2626', '#2563EB', '#16A34A', '#1F2937'];
  return (
    <div className={`flex items-end gap-0.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className="relative" style={{ width: 16, height: 8 + chipCount * 4 }}>
        {Array.from({ length: chipCount }).map((_, i) => (
          <svg key={i} className="absolute" style={{ bottom: i * 4, left: 0 }} width="16" height="10" viewBox="0 0 16 10">
            <ellipse cx="8" cy="6" rx="7" ry="3.5" fill={colors[i % colors.length]} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            <ellipse cx="8" cy="5" rx="7" ry="3.5" fill={colors[i % colors.length]} />
            <ellipse cx="8" cy="5" rx="5" ry="2.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
            {[0, 45, 90, 135].map(a => {
              const rad = (a * Math.PI) / 180;
              return <line key={a} x1={8 + 5.5 * Math.cos(rad)} y1={5 + 2.8 * Math.sin(rad)} x2={8 + 7 * Math.cos(rad)} y2={5 + 3.5 * Math.sin(rad)} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" />;
            })}
          </svg>
        ))}
      </div>
    </div>
  );
}

/* ─── Timer (ornate frame style) ─── */
function TimerDisplay({ deadline, serverOffset }: { deadline: number; serverOffset: number }) {
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
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="relative">
      {/* Ornate frame */}
      <svg width="100" height="36" viewBox="0 0 100 36">
        <defs>
          <linearGradient id="timerFrameGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="50%" stopColor="#F5E6A3" />
            <stop offset="100%" stopColor="#B8941F" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="98" height="34" rx="17" fill="rgba(0,0,0,0.7)" stroke="url(#timerFrameGrad)" strokeWidth="1.5" />
        {/* Decorative dots */}
        <circle cx="12" cy="18" r="2" fill="rgba(212,175,55,0.3)" />
        <circle cx="88" cy="18" r="2" fill="rgba(212,175,55,0.3)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-base font-bold font-mono tracking-wider ${isLow ? 'text-red-400' : 'text-amber-300'}`}>
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

/* ─── Dealer Button (gold circle) ─── */
function DealerButton() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28">
      <defs>
        <radialGradient id="dealerGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#F5E6A3" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#8B6914" />
        </radialGradient>
      </defs>
      <circle cx="14" cy="14" r="12" fill="url(#dealerGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="900" fill="#1a1a2e" letterSpacing="0.5">DEALER</text>
    </svg>
  );
}

/* ─── Player Seat Component ─── */
function PlayerSeat({
  player, isHero, isDealer, isSB, isBB, isActive, seatPos, onSit, isDark = true,
}: {
  player: ServerPlayer | null;
  isHero: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isActive: boolean;
  seatPos: { x: number; y: number };
  onSit: () => void;
  isDark?: boolean;
}) {
  if (!player) {
    return (
      <div className="absolute flex flex-col items-center" style={{
        left: `${seatPos.x}%`, top: `${seatPos.y}%`,
        transform: 'translate(-50%, -50%)',
      }}>
        <button onClick={onSit}
          className="w-14 h-14 rounded-full border-2 border-dashed border-gray-600/50 flex items-center justify-center text-gray-500 text-xs font-bold hover:border-amber-500/50 hover:text-amber-400 transition-all"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          SIT
        </button>
      </div>
    );
  }

  const avatarKey = player.avatar || 'fox';
  const avatarUrl = ASSETS.avatars[avatarKey as keyof typeof ASSETS.avatars] || ASSETS.avatars.fox;
  const isLeft = seatPos.x < 40;
  const isRight = seatPos.x > 60;
  const bb = player.chipStack > 0 ? Math.floor(player.chipStack / 2) : 0; // approximate BB count

  return (
    <div className="absolute flex flex-col items-center" style={{
      left: `${seatPos.x}%`, top: `${seatPos.y}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: isHero ? 30 : isActive ? 25 : 10,
    }}>
      {/* Face-down cards above non-hero players */}
      {!isHero && !player.folded && player.holeCards.length === 0 && (
        <div className="flex -mb-1 relative z-0">
          <div className="transform -rotate-8">
            <PokerCard card={{ suit: 's', rank: 'A' }} faceDown size="sm" animate={false} />
          </div>
          <div className="transform rotate-8 -ml-4">
            <PokerCard card={{ suit: 's', rank: 'A' }} faceDown size="sm" animate={false} />
          </div>
        </div>
      )}

      {/* Showdown cards for non-hero */}
      {!isHero && player.holeCards.length > 0 && (
        <div className="flex -mb-1 relative z-0 gap-0.5">
          {player.holeCards.map((c, i) => (
            <PokerCard key={i} card={c} size="sm" animate delay={i * 0.1} />
          ))}
        </div>
      )}

      {/* Player info card — dark with gold border */}
      <div className="relative">
        {/* Active turn glow */}
        {isActive && (
          <motion.div
            className="absolute -inset-1.5 rounded-xl"
            style={{
              background: 'rgba(212,175,55,0.1)',
              border: '2px solid rgba(212,175,55,0.5)',
              boxShadow: '0 0 15px rgba(212,175,55,0.3)',
            }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        <div className="relative rounded-lg overflow-hidden" style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(25,25,40,0.95) 0%, rgba(12,12,20,0.98) 100%)'
            : 'linear-gradient(180deg, rgba(30,30,20,0.92) 0%, rgba(20,20,15,0.95) 100%)',
          border: `1.5px solid ${isActive ? 'rgba(212,175,55,0.6)' : 'rgba(212,175,55,0.25)'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
          minWidth: '100px',
        }}>
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden" style={{
                border: isHero ? '2px solid #D4AF37' : '1.5px solid rgba(212,175,55,0.3)',
                boxShadow: isHero ? '0 0 8px rgba(212,175,55,0.4)' : 'none',
              }}>
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Name + Stack */}
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-bold text-white truncate max-w-[100px] leading-tight">
                {player.name}
              </span>
              <span className="text-[13px] font-bold text-amber-300 font-mono leading-tight flex items-center gap-1">
                <img src={ASSETS.ui.coin} alt="" className="w-3.5 h-3.5" />
                {formatChipAmount(player.chipStack)}
              </span>
            </div>
          </div>

          {/* Dealer badge */}
          {isDealer && (
            <div className="absolute -top-2 -right-2 z-20">
              <DealerButton />
            </div>
          )}

          {/* SB/BB badge */}
          {isSB && !isDealer && (
            <div className="absolute -top-1 -right-1 z-20 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[7px] font-black text-white"
              style={{ background: '#3B82F6', border: '1.5px solid rgba(255,255,255,0.3)' }}>SB</div>
          )}
          {isBB && !isDealer && (
            <div className="absolute -top-1 -right-1 z-20 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[7px] font-black text-white"
              style={{ background: '#EF4444', border: '1.5px solid rgba(255,255,255,0.3)' }}>BB</div>
          )}
        </div>

        {/* Action badge BELOW the card (matching reference) */}
        {player.lastAction && !player.folded && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex justify-center mt-1"
          >
            <div className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
              style={{
                background: getActionColor(player.lastAction).bg,
                color: getActionColor(player.lastAction).text,
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}>
              {player.allIn ? 'ALL-IN' : player.lastAction.toUpperCase()}
              {player.currentBet > 0 && !player.allIn && ` ${formatChipAmount(player.currentBet)}`}
            </div>
          </motion.div>
        )}

        {/* Folded badge */}
        {player.folded && (
          <div className="flex justify-center mt-1">
            <div className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ background: '#374151', color: '#9CA3AF' }}>
              FOLD
            </div>
          </div>
        )}

        {/* BB indicator for hero */}
        {isHero && !player.folded && !player.lastAction && (
          <div className="flex justify-center mt-1">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider">
              {bb} BB
            </span>
          </div>
        )}
      </div>

      {/* Chip stack next to player */}
      {player.currentBet > 0 && (
        <div className="absolute" style={{
          left: isLeft ? '100%' : isRight ? 'auto' : '50%',
          right: isRight ? '100%' : 'auto',
          top: '50%',
          transform: `translate(${isLeft ? '4px' : isRight ? '-4px' : '-50%'}, -50%)`,
        }}>
          <ChipStackSVG amount={player.currentBet} side={isLeft ? 'left' : 'right'} />
        </div>
      )}
    </div>
  );
}

/* ─── Bet Pill ─── */
function BetPill({ amount, x, y }: { amount: number; x: number; y: number }) {
  if (amount <= 0) return null;
  return (
    <div className="absolute z-15 flex items-center gap-1 px-2 py-0.5 rounded-full"
      style={{
        left: `${x}%`, top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, rgba(180,140,40,0.9) 0%, rgba(140,100,20,0.95) 100%)',
        border: '1px solid rgba(255,220,100,0.4)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}>
      <svg width="12" height="12" viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="5" fill="#D4AF37" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        <circle cx="6" cy="6" r="3" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.3" />
      </svg>
      <span className="text-[10px] font-bold text-white font-mono">{formatChipAmount(amount)}</span>
    </div>
  );
}

/* ─── Programmatic Table SVG (nano banano) ─── */
function PokerTableSVG({ isDark = true }: { isDark?: boolean }) {
  const feltColors = isDark
    ? { c1: '#1a2332', c2: '#141c28', c3: '#0f1520', c4: '#0a0e15', rim: '#0a0a12', glow: 'rgba(30,50,70,0.3)' }
    : { c1: '#1e7a3a', c2: '#166b30', c3: '#0f5424', c4: '#093d18', rim: '#2d5a1e', glow: 'rgba(40,100,50,0.3)' };

  return (
    <svg viewBox="0 0 400 320" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="feltGrad" cx="50%" cy="40%">
          <stop offset="0%" stopColor={feltColors.c1} />
          <stop offset="40%" stopColor={feltColors.c2} />
          <stop offset="70%" stopColor={feltColors.c3} />
          <stop offset="100%" stopColor={feltColors.c4} />
        </radialGradient>
        <linearGradient id="goldBorder" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="25%" stopColor="#F5E6A3" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="75%" stopColor="#B8941F" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
        <filter id="tableShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)'} />
        </filter>
        <radialGradient id="innerGlow" cx="50%" cy="35%">
          <stop offset="0%" stopColor={feltColors.glow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <ellipse cx="200" cy="160" rx="195" ry="150" fill={feltColors.rim} filter="url(#tableShadow)" />
      <ellipse cx="200" cy="160" rx="188" ry="144" fill="none" stroke="url(#goldBorder)" strokeWidth="2" />
      <ellipse cx="200" cy="160" rx="184" ry="140" fill="url(#feltGrad)" />
      <ellipse cx="200" cy="160" rx="170" ry="128" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="0.5" />
      <ellipse cx="200" cy="145" rx="120" ry="80" fill="url(#innerGlow)" />
      <ellipse cx="200" cy="160" rx="184" ry="140" fill="rgba(255,255,255,0.01)" opacity="0.5" />
      <ellipse cx="200" cy="160" rx="188" ry="144" fill="none" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)'} strokeWidth="4" />
      <circle cx="60" cy="160" r="3" fill="rgba(255,200,100,0.15)" />
      <circle cx="340" cy="160" r="3" fill="rgba(255,200,100,0.15)" />
      <circle cx="200" cy="30" r="3" fill="rgba(255,200,100,0.15)" />
      <circle cx="200" cy="290" r="3" fill="rgba(255,200,100,0.15)" />
    </svg>
  );
}

/* ─── Background (theme-aware casino atmosphere) ─── */
function CasinoBackground({ isDark = true }: { isDark?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        background: isDark
          ? 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0f0f1a 30%, #0a0a12 60%, #050508 100%)'
          : 'radial-gradient(ellipse at 50% 30%, #f5f0e8 0%, #e8dfd0 30%, #d4c9b0 60%, #c0b090 100%)',
      }} />

      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] rounded-[50%]" style={{
        background: isDark
          ? 'radial-gradient(ellipse, rgba(212,175,55,0.04) 0%, transparent 60%)'
          : 'radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 60%)',
        filter: 'blur(40px)',
      }} />

      <div className="absolute top-0 left-1/4 w-px h-[30%] opacity-[0.03]" style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(255,200,100,0.5), transparent)'
          : 'linear-gradient(180deg, rgba(180,150,80,0.3), transparent)',
      }} />
      <div className="absolute top-0 right-1/4 w-px h-[25%] opacity-[0.03]" style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(255,200,100,0.5), transparent)'
          : 'linear-gradient(180deg, rgba(180,150,80,0.3), transparent)',
      }} />

      <div className="absolute inset-0" style={{
        background: isDark
          ? 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)'
          : 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.15) 100%)',
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN GAME TABLE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function GameTable() {
  const params = useParams<{ id: string }>();
  const tableId = parseInt(params.id || '1');
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { connected, gameState, mySeatIndex, error, joinTable, leaveTable, sendAction, sendChat, timeOffset } = useSocket();
  const { data: tableConfig } = trpc.tables.get.useQuery({ id: tableId });

  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaisePanel, setShowRaisePanel] = useState(false);
  const [preAction, setPreAction] = useState<string | null>(null);
  const [showdownOverlay, setShowdownOverlay] = useState<any>(null);

  // Auto-join
  useEffect(() => {
    if (connected && user && tableId) {
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
        setShowdownOverlay({ winners, pots: gameState.pots });
        setTimeout(() => setShowdownOverlay(null), 4000);
      }
    }
  }, [gameState?.phase, gameState?.handNumber]);

  // Derived state
  const maxSeats = tableConfig ? parseInt(tableConfig.tableSize) : 6;
  const seats = SEATS_6;
  const heroPlayer = gameState?.players.find(p => p.seatIndex === mySeatIndex);
  const isMyTurn = gameState?.actionSeat === mySeatIndex && mySeatIndex >= 0 && !heroPlayer?.folded;
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

  const bb = gameState?.bigBlind || 2;
  const minR = gameState?.minRaise || bb * 2;
  const maxR = heroPlayer ? heroPlayer.chipStack + heroPlayer.currentBet : 0;

  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden relative" style={{ background: isDark ? '#050508' : '#c0b090' }}>
      <CasinoBackground isDark={isDark} />

      {/* ─── TOP BAR ─── */}
      <div className="relative z-40 flex items-center justify-between px-3 py-2 safe-area-top"
        style={{ background: isDark ? 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)' : 'linear-gradient(180deg, rgba(140,120,80,0.6) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/lobby')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-blue-400 hover:text-blue-300 transition-colors"
            style={{ background: 'rgba(59,130,246,0.1)' }}>
            <ArrowLeft size={18} />
          </button>
          {user && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(30,30,45,0.9) 0%, rgba(20,20,35,0.95) 100%)',
                border: '1px solid rgba(212,175,55,0.3)',
              }}>
              <img src={ASSETS.ui.coin} alt="" className="w-4 h-4" />
              <span className="text-sm font-bold text-amber-300 font-mono">
                {formatChipAmount(heroPlayer?.chipStack || 0)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-300 transition-colors"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)' }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-300"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Mail size={16} />
          </button>
        </div>
      </div>

      {/* ─── TIMER ─── */}
      {gameState && gameState.actionDeadline > 0 && gameState.phase !== 'waiting' && (
        <div className="relative z-30 flex justify-center -mt-1 mb-1">
          <TimerDisplay deadline={gameState.actionDeadline} serverOffset={timeOffset} />
        </div>
      )}

      {/* ─── TABLE AREA ─── */}
      <div className="flex-1 relative z-10 mx-auto w-full" style={{ maxWidth: '480px' }}>
        {/* Table SVG */}
        <div className="absolute inset-0" style={{ top: '4%', bottom: '4%', left: '2%', right: '2%' }}>
          <PokerTableSVG isDark={isDark} />
        </div>

        {/* "HOUSE POKER" center text */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-5" style={{ top: '57%' }}>
          <span className="text-[14px] font-bold tracking-[0.4em] uppercase"
            style={{ color: 'rgba(212,175,55,0.25)', fontFamily: "'Playfair Display', serif", textShadow: '0 0 20px rgba(212,175,55,0.1)' }}>
            House Poker
          </span>
        </div>

        {/* ─── Pot Display ─── */}
        {totalPot > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              top: '30%',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(212,175,55,0.25)',
              backdropFilter: 'blur(8px)',
            }}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 1 L10 6 L15 6 L11 9.5 L12.5 15 L8 11.5 L3.5 15 L5 9.5 L1 6 L6 6 Z" fill="#D4AF37" opacity="0.8" />
            </svg>
            <span className="text-sm font-bold text-white font-mono">{formatChipAmount(totalPot)}</span>
          </div>
        )}

        {/* ─── Community Cards ─── */}
        {gameState && gameState.communityCards.length > 0 && (
          <div className="absolute left-1/2 z-20 flex items-center justify-center gap-1.5"
            style={{ top: '42%', transform: 'translate(-50%, -50%)' }}>
            {gameState.communityCards.map((card, i) => (
              <PokerCard key={`cc-${i}`} card={card} size="lg" delay={i * 0.08} />
            ))}
            {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-md"
                style={{
                  width: 60, height: 86,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px dashed rgba(255,255,255,0.06)',
                }} />
            ))}
          </div>
        )}

        {/* ─── Game Info (inside table, below top seat) ─── */}
        <div className="absolute left-1/2 -translate-x-1/2 z-10 text-center" style={{ top: '18%' }}>
          <span className="text-[8px] font-medium tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
            NLH ~ {tableConfig?.smallBlind || 1}/{tableConfig?.bigBlind || 2} {maxSeats}MAX
            <span style={{ color: 'rgba(255,255,255,0.15)' }}> • </span>
            <span style={{ color: gameState?.phase === 'showdown' ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.25)' }}>
              {PHASE_LABELS[gameState?.phase || 'waiting']} #{gameState?.handNumber || 0}
            </span>
          </span>
        </div>

        {/* ─── Player Seats ─── */}
        {seats.map((seatPos, seatIdx) => {
          const player = gameState?.players.find(p => p.seatIndex === seatIdx) || null;
          const isHero = seatIdx === mySeatIndex;
          const isDealer = gameState?.dealerSeat === seatIdx;
          const isSB = gameState?.smallBlindSeat === seatIdx;
          const isBB = gameState?.bigBlindSeat === seatIdx;
          const isActive = gameState?.actionSeat === seatIdx;
          return (
            <PlayerSeat key={seatIdx} player={player} isHero={isHero}
              isDealer={isDealer} isSB={isSB} isBB={isBB} isActive={isActive}
              seatPos={seatPos} onSit={() => handleSit(seatIdx)} isDark={isDark} />
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

      {/* ─── HERO CARDS (large, bottom-left, tilted like reference) ─── */}
      {heroPlayer && heroPlayer.holeCards.length > 0 && !heroPlayer.folded && (
        <div className="relative z-30 flex justify-start pl-4 -mt-6 mb-1">
          <div className="flex">
            {heroPlayer.holeCards.map((card, i) => (
              <motion.div
                key={`hero-${i}`}
                initial={{ y: 40, opacity: 0, rotateZ: i === 0 ? -8 : 5 }}
                animate={{ y: 0, opacity: 1, rotateZ: i === 0 ? -8 : 5 }}
                transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
                style={{ marginLeft: i > 0 ? '-12px' : 0, zIndex: i + 1 }}
              >
                <PokerCard card={card} size="xxl" animate={false} />
              </motion.div>
            ))}
          </div>
          {/* ALL-IN badge for hero if applicable */}
          {heroPlayer.allIn && (
            <div className="absolute -bottom-2 left-4 px-3 py-1 rounded text-[10px] font-bold text-white"
              style={{ background: '#B91C1C', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
              ALL-IN
            </div>
          )}
        </div>
      )}

      {/* Hero folded indicator */}
      {heroPlayer && heroPlayer.folded && (
        <div className="relative z-30 flex justify-center -mt-2 mb-1">
          <span className="text-xs text-gray-600 font-medium tracking-wider">FOLDED</span>
        </div>
      )}

      {/* ─── ACTION PANEL ─── */}
      <div className="relative z-40 px-3 pb-3 safe-area-bottom"
        style={{ background: isDark
          ? 'linear-gradient(0deg, rgba(5,5,8,0.95) 0%, rgba(5,5,8,0.6) 70%, transparent 100%)'
          : 'linear-gradient(0deg, rgba(60,50,35,0.95) 0%, rgba(60,50,35,0.7) 70%, transparent 100%)'
        }}>

        {/* YOUR TURN indicator */}
        {isMyTurn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-1.5">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-400">Your Turn</span>
          </motion.div>
        )}

        {/* Raise preset panel */}
        <AnimatePresence>
          {showRaisePanel && isMyTurn && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-2">
              <div className="flex gap-1.5 mb-2">
                {[
                  { label: 'Min', value: minR },
                  { label: '3BB', value: bb * 3 },
                  { label: '½ Pot', value: Math.floor(totalPot / 2) },
                  { label: 'Pot', value: totalPot },
                  { label: 'All In', value: maxR },
                ].map(preset => (
                  <button key={preset.label}
                    onClick={() => setRaiseAmount(Math.min(Math.max(preset.value, minR), maxR))}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-gray-300 transition-colors"
                    style={{
                      background: raiseAmount === Math.min(Math.max(preset.value, minR), maxR)
                        ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                      border: raiseAmount === Math.min(Math.max(preset.value, minR), maxR)
                        ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    }}>
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setRaiseAmount(Math.max(minR, raiseAmount - bb))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>−</button>
                <input type="range" min={minR} max={maxR} value={raiseAmount}
                  onChange={e => setRaiseAmount(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${((raiseAmount - minR) / Math.max(maxR - minR, 1)) * 100}%, rgba(255,255,255,0.1) ${((raiseAmount - minR) / Math.max(maxR - minR, 1)) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  }} />
                <button onClick={() => setRaiseAmount(Math.min(maxR, raiseAmount + bb))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>+</button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowRaisePanel(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-400 tracking-wider"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>BACK</button>
                <button onClick={handleRaise}
                  className="flex-[2] py-2.5 rounded-xl text-sm font-bold tracking-wider text-white"
                  style={{
                    background: 'linear-gradient(135deg, #16A34A, #15803D)',
                    boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                  }}>
                  RAISE {formatChipAmount(raiseAmount)}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main Action Buttons (matching reference exactly) ─── */}
        {isMyTurn && !showRaisePanel && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
            {/* FOLD - Gray */}
            <button onClick={handleFold}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #6B7280 0%, #4B5563 100%)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                color: '#F9FAFB',
              }}>
              FOLD
            </button>

            {/* CHECK/CALL - Blue */}
            {canCheck ? (
              <button onClick={handleCheck}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                  color: '#EFF6FF',
                }}>
                CHECK
              </button>
            ) : (
              <button onClick={handleCall}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                  color: '#EFF6FF',
                }}>
                CALL {formatChipAmount(toCall)}
              </button>
            )}

            {/* RAISE - Green */}
            <button onClick={() => setShowRaisePanel(true)}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #16A34A 0%, #15803D 100%)',
                boxShadow: '0 4px 12px rgba(22,163,74,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                color: '#F0FDF4',
              }}>
              RAISE
            </button>

            {/* ALL-IN - Red */}
            <button onClick={handleAllIn}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #DC2626 0%, #B91C1C 100%)',
                boxShadow: '0 4px 12px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                color: '#FEF2F2',
              }}>
              ALL-IN
            </button>
          </motion.div>
        )}

        {/* Pre-action buttons */}
        {!isMyTurn && heroPlayer && !heroPlayer.folded && gameState?.phase !== 'waiting' && gameState?.phase !== 'showdown' && (
          <div className="flex gap-2">
            {[
              { key: 'check_fold', label: 'Check/Fold' },
              { key: 'call_any', label: 'Call Any' },
              { key: 'fold_to_bet', label: 'Fold to Bet' },
            ].map(pa => (
              <button key={pa.key}
                onClick={() => setPreAction(preAction === pa.key ? null : pa.key)}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold tracking-wider transition-all ${preAction === pa.key ? 'ring-1 ring-amber-400' : ''}`}
                style={{
                  background: preAction === pa.key ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: preAction === pa.key ? '#D4AF37' : '#6B7280',
                }}>
                {pa.label}
              </button>
            ))}
          </div>
        )}

        {/* Waiting state */}
        {gameState?.phase === 'waiting' && (
          <div className="text-center py-3">
            <span className="text-xs text-gray-500 tracking-wider">Waiting for players...</span>
          </div>
        )}

        {/* Connection status */}
        <div className="flex items-center justify-center mt-1.5 gap-2">
          <div className="flex items-center gap-1 text-[9px] text-gray-600">
            {connected ? <Wifi size={9} className="text-green-500" /> : <WifiOff size={9} className="text-red-500" />}
            <Users size={9} />
            <span>{gameState?.players.length || 0}/{maxSeats}</span>
          </div>
        </div>
      </div>

      {/* ─── Showdown Overlay ─── */}
      <AnimatePresence>
        {showdownOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-2xl px-8 py-5 text-center"
              style={{
                background: 'linear-gradient(145deg, rgba(20,20,35,0.97) 0%, rgba(10,10,20,0.99) 100%)',
                border: '1.5px solid rgba(212,175,55,0.3)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.1)',
              }}>
              <div className="text-[11px] tracking-[0.3em] uppercase text-gray-500 mb-3">Showdown</div>
              {showdownOverlay.winners.map((w: ServerPlayer, i: number) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <img src={ASSETS.avatars[(w.avatar || 'fox') as keyof typeof ASSETS.avatars] || ASSETS.avatars.fox}
                    alt="" className="w-10 h-10 rounded-full" style={{ border: '2px solid #D4AF37' }} />
                  <div className="text-left">
                    <div className="text-sm font-bold text-white">{w.name}</div>
                    <div className="flex gap-1 mt-1">
                      {w.holeCards.map((c, j) => (
                        <PokerCard key={j} card={c} size="md" animate delay={j * 0.1} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {showdownOverlay.pots.map((pot: any, i: number) => (
                <div key={i} className="text-sm text-amber-300 font-bold font-mono mt-2">
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
