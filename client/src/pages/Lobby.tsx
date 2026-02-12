/**
 * Lobby — HOUSE POKER Premium Club
 * Sleek table selection with premium dark/gold aesthetic
 */
import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { Users, Zap, Crown, Star, Flame, ChevronRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ASSETS } from '@/lib/assets';
import { getLoginUrl } from '@/const';
import BottomNav from '@/components/BottomNav';

type GameMode = 'holdem' | 'omaha';

const TIER_CONFIG: Record<string, { gradient: string; border: string; glow: string; text: string; label: string }> = {
  micro: {
    gradient: 'linear-gradient(145deg, rgba(34,197,94,0.04) 0%, rgba(34,197,94,0.01) 100%)',
    border: 'rgba(34,197,94,0.12)',
    glow: 'rgba(34,197,94,0.06)',
    text: '#4ade80',
    label: 'Micro',
  },
  low: {
    gradient: 'linear-gradient(145deg, rgba(59,130,246,0.04) 0%, rgba(59,130,246,0.01) 100%)',
    border: 'rgba(59,130,246,0.12)',
    glow: 'rgba(59,130,246,0.06)',
    text: '#60a5fa',
    label: 'Low',
  },
  medium: {
    gradient: 'linear-gradient(145deg, rgba(168,85,247,0.04) 0%, rgba(168,85,247,0.01) 100%)',
    border: 'rgba(168,85,247,0.12)',
    glow: 'rgba(168,85,247,0.06)',
    text: '#c084fc',
    label: 'Medium',
  },
  high: {
    gradient: 'linear-gradient(145deg, rgba(212,175,55,0.06) 0%, rgba(212,175,55,0.02) 100%)',
    border: 'rgba(212,175,55,0.15)',
    glow: 'rgba(212,175,55,0.08)',
    text: '#D4AF37',
    label: 'High',
  },
  vip: {
    gradient: 'linear-gradient(145deg, rgba(236,72,153,0.04) 0%, rgba(236,72,153,0.01) 100%)',
    border: 'rgba(236,72,153,0.12)',
    glow: 'rgba(236,72,153,0.06)',
    text: '#f472b6',
    label: 'VIP',
  },
};

function getTier(bb: number): string {
  if (bb <= 2) return 'micro';
  if (bb <= 10) return 'low';
  if (bb <= 50) return 'medium';
  if (bb <= 200) return 'high';
  return 'vip';
}

function getTierIcon(bb: number) {
  if (bb <= 2) return Star;
  if (bb <= 10) return Zap;
  if (bb <= 50) return Crown;
  if (bb <= 200) return Flame;
  return Crown;
}

export default function Lobby() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<GameMode>('holdem');

  const { data: tables, isLoading } = trpc.tables.list.useQuery();
  const { data: stats } = trpc.tables.onlineStats.useQuery();
  const { data: balance } = trpc.balance.get.useQuery(undefined, { retry: false, enabled: isAuthenticated });

  const filteredTables = tables?.filter(t => t.gameType === mode) || [];

  return (
    <div className="min-h-[100dvh] pb-24 noise-overlay" style={{
      background: 'linear-gradient(180deg, rgba(10, 8, 4, 1) 0%, rgba(6, 6, 10, 1) 30%, rgba(4, 4, 6, 1) 100%)',
    }}>
      {/* ─── Header ─── */}
      <div className="px-4 pt-4 pb-3 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <img src={ASSETS.logo} alt="" className="w-8 h-8" style={{ filter: 'drop-shadow(0 2px 8px rgba(212,175,55,0.2))' }} />
            <div>
              <h1 className="text-base font-bold gold-text-subtle font-display tracking-wide">HOUSE POKER</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400/80 font-medium">{stats?.onlinePlayers ?? 0} online</span>
              </div>
            </div>
          </div>
          {isAuthenticated && balance ? (
            <button onClick={() => navigate('/cashier')} className="glass-card px-3 py-1.5 rounded-lg flex items-center gap-2 active:scale-95 transition-transform">
              <img src={ASSETS.chips.gold} alt="" className="w-4 h-4" />
              <span className="text-sm font-semibold text-gold font-mono-poker">{balance.balanceReal.toLocaleString()}</span>
            </button>
          ) : (
            <button onClick={() => window.location.href = '/login'} className="btn-primary-poker px-4 py-2 rounded-lg text-xs font-bold tracking-wider">
              Sign In
            </button>
          )}
        </div>

        {/* ─── Quick Play Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl overflow-hidden mb-5 relative"
          style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(16,16,28,0.8) 60%, rgba(8,8,16,0.9) 100%)',
            border: '1px solid rgba(212,175,55,0.1)',
          }}
        >
          {/* Subtle shimmer */}
          <div className="absolute inset-0 animate-shimmer pointer-events-none" />
          <div className="p-4 flex items-center gap-3 relative">
            <motion.img
              src={ASSETS.ui.crown}
              alt=""
              className="w-11 h-11 sm:w-14 sm:h-14"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(212,175,55,0.2))' }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gold-light font-display tracking-wide">Quick Play</h3>
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">Jump into the next available table</p>
            </div>
            <motion.button
              onClick={() => {
                if (!isAuthenticated) { window.location.href = '/login'; return; }
                const first = filteredTables[0];
                if (first) navigate(`/game/${first.id}`);
              }}
              className="btn-primary-poker px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-[0.1em] font-display shrink-0"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              PLAY
            </motion.button>
          </div>
        </motion.div>

        {/* ─── Game Mode Tabs ─── */}
        <div className="flex gap-1 p-0.5 rounded-lg" style={{
          background: 'rgba(8,8,16,0.6)',
          border: '1px solid rgba(255,255,255,0.03)',
        }}>
          {(['holdem', 'omaha'] as GameMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-all duration-200 tracking-wider ${
                mode === m
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-[#0a0a0f]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m === 'holdem' ? "Hold'em" : 'Omaha'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Table List ─── */}
      <div className="px-4 relative z-10">
        <div className="flex items-center justify-between mb-3 mt-1">
          <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.2em]">
            {mode === 'holdem' ? "Texas Hold'em NL" : 'Pot Limit Omaha'}
          </h2>
          <span className="text-[10px] text-gray-600 font-mono-poker">{filteredTables.length} tables</span>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[68px] rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.02)' }} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {filteredTables.map((table, i) => {
                const tier = getTier(table.bigBlind);
                const cfg = TIER_CONFIG[tier] || TIER_CONFIG.micro;
                const Icon = getTierIcon(table.bigBlind);
                const playerCount = table.playerCount ?? 0;
                const isFull = playerCount >= Number(table.tableSize);

                return (
                  <motion.div
                    key={table.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      if (!isAuthenticated) { window.location.href = '/login'; return; }
                      navigate(`/game/${table.id}`);
                    }}
                    className="rounded-xl p-3 cursor-pointer transition-all duration-200 active:scale-[0.98] group"
                    style={{
                      background: cfg.gradient,
                      border: `1px solid ${cfg.border}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: cfg.glow, border: `1px solid ${cfg.border}` }}>
                          <Icon size={16} style={{ color: cfg.text }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-gray-100 truncate">{table.name}</div>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <span className="text-[10px] text-gray-500">
                              <span className="font-mono-poker" style={{ color: cfg.text }}>{table.smallBlind}/{table.bigBlind}</span>
                            </span>
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Users size={10} />
                              <span className={isFull ? 'text-red-400' : ''}>
                                {playerCount}/{table.tableSize}
                              </span>
                            </span>
                            {playerCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                <span className="text-[9px] text-emerald-400/70">Live</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="text-[8px] text-gray-600 uppercase tracking-wider font-medium">Buy-in</div>
                          <div className="text-[13px] font-bold font-mono-poker" style={{ color: cfg.text }}>
                            {table.minBuyIn.toLocaleString()}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-gray-700 group-hover:text-gray-500 transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {filteredTables.length === 0 && (
                <div className="text-center py-16">
                  <img src={ASSETS.ui.crown} alt="" className="w-14 h-14 mx-auto mb-4 opacity-15" />
                  <p className="text-gray-600 text-sm font-medium">No tables available</p>
                  <p className="text-gray-700 text-xs mt-1">Check back soon</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
