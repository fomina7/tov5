/**
 * Home — HOUSE POKER Premium Club Landing
 * Shows real online stats: tables, players, bots
 */
import { useAuth } from '@/_core/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { ASSETS } from '@/lib/assets';
import { getLoginUrl } from '@/const';
import { trpc } from '@/lib/trpc';
import { useMemo, useState, useEffect } from 'react';
import HousePokerLogo from '@/components/HousePokerLogo';

/* ─── Subtle gold dust particles ─── */
function GoldDust() {
  const particles = useMemo(() =>
    Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * 1.5,
      dur: 6 + Math.random() * 8,
      delay: Math.random() * 5,
      drift: -20 + Math.random() * 40,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            left: `${p.x}%`, top: `${p.y}%`,
            background: `rgba(212, 175, 55, ${0.15 + Math.random() * 0.25})`,
          }}
          animate={{
            y: [0, -80 - Math.random() * 60],
            x: [0, p.drift],
            opacity: [0, 0.6, 0],
          }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Animated card fan ─── */
function CardFan() {
  const cards = [
    { src: ASSETS.cards.aceSpades, rot: -12, x: -40 },
    { src: ASSETS.cards.kingHearts, rot: -4, x: -14 },
    { src: ASSETS.cards.queenDiamonds, rot: 4, x: 14 },
    { src: ASSETS.cards.jackClubs, rot: 12, x: 40 },
  ];
  return (
    <div className="relative h-28 sm:h-36 w-56 sm:w-72 mx-auto">
      {cards.map((card, i) => (
        <motion.img
          key={i}
          src={card.src}
          alt=""
          className="absolute left-1/2 bottom-0 w-16 sm:w-20 rounded-lg"
          style={{
            transformOrigin: 'bottom center',
            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
          }}
          initial={{ opacity: 0, y: 30, rotate: 0, x: '-50%' }}
          animate={{ opacity: 1, y: 0, rotate: card.rot, x: `calc(-50% + ${card.x}px)` }}
          transition={{ delay: 0.8 + i * 0.12, type: 'spring', stiffness: 120, damping: 14 }}
        />
      ))}
    </div>
  );
}

/* ─── Pulsing live dot ─── */
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { data: stats } = trpc.tables.onlineStats.useQuery(undefined, {
    refetchInterval: 5000, // refresh every 5 seconds for live feel
  });
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden noise-overlay" style={{
      background: 'radial-gradient(ellipse at 50% 30%, rgba(20, 16, 8, 1) 0%, rgba(8, 8, 12, 1) 50%, rgba(4, 4, 6, 1) 100%)',
    }}>
      <GoldDust />

      {/* Top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(212, 175, 55, 0.04) 0%, transparent 70%)' }} />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">

        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-6 sm:mb-8"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HousePokerLogo size={90} showText={false} />
          </motion.div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-wide gold-text leading-tight mt-3">
            HOUSE POKER
          </h1>
          <div className="divider-gold w-32 sm:w-48 mx-auto mt-3 mb-3" />
          <p className="text-[11px] sm:text-xs tracking-[0.3em] uppercase text-gray-500 font-medium">
            Premium Poker Club
          </p>
        </motion.div>

        {/* Card Fan */}
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mb-6 sm:mb-8"
            >
              <CardFan />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chip row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8"
        >
          {[ASSETS.chips.gold, ASSETS.chips.red, ASSETS.chips.blue, ASSETS.chips.green, ASSETS.chips.black].map((chip, i) => (
            <motion.img
              key={i}
              src={chip}
              alt=""
              className="w-8 h-8 sm:w-10 sm:h-10"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>

        {/* Real Online Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-2.5 sm:gap-3 mb-6 sm:mb-8"
        >
          {/* Active Tables */}
          <div className="glass-card px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-center min-w-[70px]">
            <div className="text-base sm:text-lg font-bold text-gold font-mono-poker">
              {stats?.activeTables ?? 0}
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-[0.15em] font-medium">Tables</div>
          </div>

          {/* Total Players */}
          <div className="glass-card px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-center min-w-[70px]">
            <div className="flex items-center justify-center gap-1.5">
              <LiveDot />
              <span className="text-base sm:text-lg font-bold text-green-400 font-mono-poker">
                {stats?.onlinePlayers ?? 0}
              </span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-[0.15em] font-medium">Playing</div>
          </div>

          {/* Real Players */}
          <div className="glass-card px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-center min-w-[70px]">
            <div className="text-base sm:text-lg font-bold text-blue-400 font-mono-poker">
              {stats?.onlineHumans ?? 0}
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-[0.15em] font-medium">Players</div>
          </div>

          {/* Bots */}
          <div className="glass-card px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-center min-w-[70px]">
            <div className="text-base sm:text-lg font-bold text-amber-400 font-mono-poker">
              {stats?.onlineBots ?? 0}
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-[0.15em] font-medium">Bots</div>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
          onClick={() => isAuthenticated ? navigate('/lobby') : window.location.href = getLoginUrl()}
          className="btn-primary-poker px-10 sm:px-14 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base tracking-[0.15em] font-display font-bold relative overflow-hidden group"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <span className="relative">{isAuthenticated ? 'PLAY NOW' : 'ENTER CLUB'}</span>
        </motion.button>

        {/* Welcome back */}
        {user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
            className="mt-4 text-xs text-gray-500"
          >
            Welcome back, <span className="text-gold-light font-medium">{user.name}</span>
          </motion.div>
        )}
      </div>

      {/* Bottom section */}
      <div className="relative z-10 pb-6 sm:pb-8 flex flex-col items-center gap-4">
        {/* Avatar row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="flex items-center gap-2 sm:gap-3"
        >
          {['fox', 'shark', 'owl', 'wolf', 'bear', 'dragon', 'lion'].map((key, i) => (
            <motion.div
              key={key}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden gold-border"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.25 }}
            >
              <img src={ASSETS.avatars[key as keyof typeof ASSETS.avatars]} alt={key} className="w-full h-full object-cover" />
            </motion.div>
          ))}
        </motion.div>

        <p className="text-[10px] text-gray-700 tracking-wider">v4.0 — Play responsibly</p>
      </div>
    </div>
  );
}
