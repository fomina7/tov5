/**
 * Lobby — Real data from DB via tRPC
 * Shows game tables, online stats, quick play
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { Users, Zap, Crown, Star, Timer, Flame, ChevronRight, Wifi } from 'lucide-react';
import { ASSETS } from '@/lib/assets';
import BottomNav from '@/components/BottomNav';
import { trpc } from '@/lib/trpc';

type GameMode = 'holdem' | 'omaha';

const TIER_STYLES: Record<string, { bg: string; border: string; iconBg: string }> = {
  micro: { bg: 'from-amber-950/30 to-amber-900/10', border: 'border-amber-700/30', iconBg: 'bg-amber-800/40 text-amber-400' },
  low: { bg: 'from-gray-800/30 to-gray-700/10', border: 'border-gray-500/30', iconBg: 'bg-gray-700/40 text-gray-300' },
  medium: { bg: 'from-yellow-950/30 to-yellow-900/10', border: 'border-yellow-600/30', iconBg: 'bg-yellow-800/40 text-yellow-400' },
  high: { bg: 'from-cyan-950/30 to-cyan-900/10', border: 'border-cyan-500/30', iconBg: 'bg-cyan-800/40 text-cyan-300' },
  vip: { bg: 'from-purple-950/30 to-purple-900/10', border: 'border-purple-500/30', iconBg: 'bg-purple-800/40 text-purple-300' },
};

function getTier(bigBlind: number): string {
  if (bigBlind <= 2) return 'micro';
  if (bigBlind <= 10) return 'low';
  if (bigBlind <= 50) return 'medium';
  if (bigBlind <= 200) return 'high';
  return 'vip';
}

function getTierIcon(bigBlind: number) {
  if (bigBlind <= 2) return Star;
  if (bigBlind <= 10) return Zap;
  if (bigBlind <= 50) return Crown;
  if (bigBlind <= 200) return Flame;
  return Crown;
}

export default function Lobby() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<GameMode>('holdem');

  const { data: tables, isLoading } = trpc.tables.list.useQuery();
  const { data: stats } = trpc.tables.onlineStats.useQuery();
  const { data: balance } = trpc.balance.get.useQuery(undefined, {
    retry: false,
  });

  const filteredTables = tables?.filter(t => t.gameType === mode) || [];

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse at top, #0d1117 0%, #080a0f 50%, #050507 100%)',
    }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold gold-text" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              HOUSE POKER
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Premium Poker Platform</p>
              {stats && (
                <div className="flex items-center gap-1">
                  <Wifi size={8} className="text-green-400" />
                  <span className="text-[9px] text-green-400">{stats.onlinePlayers} online</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
              onClick={() => navigate('/cashier')}
              style={{
                background: 'rgba(10, 10, 20, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(212, 175, 55, 0.2)',
              }}>
              <img src={ASSETS.ui.coin} alt="" className="w-4 h-4" />
              <span className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {balance ? balance.balanceReal.toLocaleString() : '---'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick play banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(0, 240, 255, 0.05) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}
        >
          <div className="p-4 flex items-center gap-4">
            <motion.img
              src={ASSETS.ui.lootbox}
              alt=""
              className="w-14 h-14"
              animate={{ y: [0, -4, 0], rotate: [0, 2, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gold mb-0.5">Quick Play</h3>
              <p className="text-[11px] text-gray-400">Jump into the next available table</p>
            </div>
            <motion.button
              onClick={() => {
                const firstTable = filteredTables[0];
                if (firstTable) navigate(`/game/${firstTable.id}`);
              }}
              className="btn-primary-poker px-5 py-2.5 rounded-xl text-sm font-bold tracking-wider"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              PLAY
            </motion.button>
          </div>
        </motion.div>

        {/* Game mode tabs */}
        <div className="flex gap-1.5 mb-4 p-1 rounded-xl" style={{
          background: 'rgba(10, 10, 20, 0.5)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {(['holdem', 'omaha'] as GameMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                mode === m ? 'btn-primary-poker' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m === 'holdem' ? "Hold'em" : 'Omaha'}
            </button>
          ))}
        </div>
      </div>

      {/* Tables list */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            {mode === 'holdem' ? "Texas Hold'em NL" : 'Pot Limit Omaha'}
          </h2>
          <span className="text-[10px] text-gray-600">{filteredTables.length} tables</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              {filteredTables.map((table, i) => {
                const tier = getTier(table.bigBlind);
                const style = TIER_STYLES[tier] || TIER_STYLES.micro;
                const Icon = getTierIcon(table.bigBlind);
                const isHot = table.playerCount >= parseInt(table.tableSize) / 2;
                return (
                  <motion.div
                    key={table.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => navigate(`/game/${table.id}`)}
                    className={`rounded-xl p-3.5 border bg-gradient-to-r ${style.bg} ${style.border} cursor-pointer hover:brightness-110 transition-all active:scale-[0.98] relative overflow-hidden`}
                  >
                    {isHot && (
                      <motion.div
                        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <span className="text-[8px] font-bold text-red-400 uppercase">Hot</span>
                      </motion.div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${style.iconBg}`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{table.name}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-gray-400">
                              Blinds: <span className="text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{table.smallBlind}/{table.bigBlind}</span>
                            </span>
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Users size={11} /> {table.playerCount}/{table.tableSize}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-[9px] text-gray-500 uppercase">Buy-in</div>
                          <div className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {table.minBuyIn.toLocaleString()}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-gray-600" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {filteredTables.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No tables available for this game mode
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
