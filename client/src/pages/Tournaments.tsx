/*
 * Tournaments — Real data from DB
 * Tournament listing and registration
 */
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { motion } from 'framer-motion';
import { Clock, Users, Trophy, Zap, Crown, Timer, Star, ChevronLeft, Loader2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  registering: { bg: 'rgba(0, 200, 0, 0.1)', border: 'rgba(0, 200, 0, 0.2)', text: 'text-green-400' },
  running: { bg: 'rgba(255, 150, 0, 0.1)', border: 'rgba(255, 150, 0, 0.2)', text: 'text-orange-400' },
  paused: { bg: 'rgba(255, 255, 0, 0.1)', border: 'rgba(255, 255, 0, 0.2)', text: 'text-yellow-400' },
  completed: { bg: 'rgba(150, 150, 150, 0.1)', border: 'rgba(150, 150, 150, 0.15)', text: 'text-gray-400' },
  cancelled: { bg: 'rgba(255, 0, 0, 0.1)', border: 'rgba(255, 0, 0, 0.15)', text: 'text-red-400' },
};

const TYPE_ICONS: Record<string, typeof Trophy> = {
  sit_and_go: Zap,
  mtt: Crown,
  freeroll: Star,
};

const TYPE_COLORS: Record<string, string> = {
  sit_and_go: 'from-blue-950/30 to-blue-900/10 border-blue-600/25',
  mtt: 'from-yellow-950/30 to-yellow-900/10 border-yellow-600/25',
  freeroll: 'from-green-950/30 to-green-900/10 border-green-600/25',
};

function formatChips(amount: number): string {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
  return amount.toLocaleString();
}

export default function Tournaments() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { data: tournamentList, isLoading, refetch } = trpc.tournaments.list.useQuery();

  const registerMut = trpc.tournaments.register.useMutation({
    onSuccess: () => {
      toast.success('Successfully registered!');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const unregisterMut = trpc.tournaments.unregister.useMutation({
    onSuccess: () => {
      toast.success('Unregistered successfully');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse at top, #0d1117 0%, #080a0f 50%, #050507 100%)',
    }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold gold-text" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                TOURNAMENTS
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {tournamentList?.length || 0} tournaments available
              </p>
            </div>
          </div>
          <Trophy size={28} className="text-gold" />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!tournamentList || tournamentList.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <Trophy size={48} className="text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-400 mb-2">No Tournaments Yet</h3>
          <p className="text-sm text-gray-500 text-center">
            Tournaments will appear here when created by admin.
            Check back soon!
          </p>
        </div>
      )}

      {/* Tournament list */}
      {tournamentList && tournamentList.length > 0 && (
        <div className="px-4 space-y-3">
          {tournamentList.map((t, i) => {
            const Icon = TYPE_ICONS[t.type] || Trophy;
            const tierClass = TYPE_COLORS[t.type] || TYPE_COLORS.sit_and_go;
            const statusStyle = STATUS_STYLES[t.status] || STATUS_STYLES.completed;
            const prizePool = Math.max(t.prizePool, t.guaranteedPrize);

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-xl p-4 border bg-gradient-to-r ${tierClass}`}
              >
                {/* Top row: name + status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-gold" />
                    <span className="text-sm font-bold text-white">{t.name}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusStyle.text}`}
                    style={{
                      background: statusStyle.bg,
                      border: `1px solid ${statusStyle.border}`,
                    }}>
                    {t.status}
                  </span>
                </div>

                {/* Info row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {t.currentPlayers}/{t.maxPlayers}
                    </span>
                    <span className="flex items-center gap-1">
                      <Timer size={12} /> {t.type === 'sit_and_go' ? 'Sit & Go' : t.type === 'mtt' ? 'MTT' : 'Freeroll'}
                    </span>
                    {t.scheduledStart && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {new Date(t.scheduledStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Prize + Buy-in row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Buy-in</div>
                      <div className="text-sm font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {t.buyIn === 0 ? 'FREE' : formatChips(t.buyIn)}
                        {t.entryFee > 0 && <span className="text-gray-500"> +{formatChips(t.entryFee)}</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Prize Pool</div>
                      <div className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {prizePool > 0 ? formatChips(prizePool) : t.guaranteedPrize > 0 ? formatChips(t.guaranteedPrize) + ' GTD' : 'TBD'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Starting Chips</div>
                      <div className="text-sm font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatChips(t.startingChips)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action button */}
                {t.status === 'registering' && isAuthenticated && (
                  <motion.button
                    onClick={() => registerMut.mutate({ tournamentId: t.id })}
                    disabled={registerMut.isPending}
                    className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
                      color: '#000',
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {registerMut.isPending ? 'REGISTERING...' : t.buyIn === 0 ? 'JOIN FREE' : `REGISTER — ${formatChips(t.buyIn + t.entryFee)}`}
                  </motion.button>
                )}

                {t.status === 'running' && (
                  <div className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-center text-orange-400"
                    style={{ background: 'rgba(255, 150, 0, 0.1)', border: '1px solid rgba(255, 150, 0, 0.2)' }}>
                    IN PROGRESS
                  </div>
                )}

                {t.status === 'completed' && (
                  <div className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-center text-gray-400"
                    style={{ background: 'rgba(150, 150, 150, 0.1)', border: '1px solid rgba(150, 150, 150, 0.15)' }}>
                    COMPLETED
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
