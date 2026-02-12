/**
 * Admin Panel — Full admin dashboard
 * Only accessible to users with admin/superadmin role
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, CreditCard, Table2, History, Shield,
  ArrowLeft, Plus, Minus, Eye, RefreshCw, ChevronDown
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

type Tab = 'dashboard' | 'users' | 'transactions' | 'tables' | 'history' | 'logs';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'transactions', label: 'Transactions', icon: CreditCard },
  { id: 'tables', label: 'Tables', icon: Table2 },
  { id: 'history', label: 'Hand History', icon: History },
  { id: 'logs', label: 'Admin Logs', icon: Shield },
];

export default function Admin() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [adjustUserId, setAdjustUserId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // Queries
  const { data: stats, refetch: refetchStats } = trpc.admin.stats.useQuery(undefined, {
    retry: false,
  });
  const { data: usersList, refetch: refetchUsers } = trpc.admin.users.useQuery(
    { limit: 50, offset: 0 },
    { enabled: tab === 'users', retry: false }
  );
  const { data: txList, refetch: refetchTx } = trpc.admin.transactions.useQuery(
    { limit: 50, offset: 0 },
    { enabled: tab === 'transactions', retry: false }
  );
  const { data: handHistoryList } = trpc.admin.handHistory.useQuery(
    { limit: 50 },
    { enabled: tab === 'history', retry: false }
  );
  const { data: logsList } = trpc.admin.logs.useQuery(
    { limit: 50 },
    { enabled: tab === 'logs', retry: false }
  );

  // Mutations
  const adjustBalance = trpc.admin.adjustBalance.useMutation({
    onSuccess: () => {
      toast.success('Balance adjusted');
      setAdjustUserId(null);
      setAdjustAmount('');
      setAdjustNote('');
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveTx = trpc.admin.approveTransaction.useMutation({
    onSuccess: () => {
      toast.success('Transaction approved');
      refetchTx();
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'radial-gradient(ellipse at center, #0d1117 0%, #080a0f 50%, #050507 100%)',
      }}>
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{
        background: 'radial-gradient(ellipse at center, #0d1117 0%, #080a0f 50%, #050507 100%)',
      }}>
        <Shield size={48} className="text-red-500" />
        <h1 className="text-xl font-bold text-white">Access Denied</h1>
        <p className="text-gray-400 text-sm">Admin privileges required</p>
        <button onClick={() => navigate('/lobby')} className="btn-primary-poker px-6 py-2 rounded-xl text-sm">
          Back to Lobby
        </button>
      </div>
    );
  }

  const glassCard = {
    background: 'rgba(10, 10, 20, 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(ellipse at top, #0d1117 0%, #080a0f 50%, #050507 100%)',
    }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={() => navigate('/lobby')} className="p-2 rounded-lg" style={glassCard}>
          <ArrowLeft size={16} className="text-gray-300" />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-gold" />
          <h1 className="text-lg font-bold gold-text" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            ADMIN PANEL
          </h1>
        </div>
        <button onClick={() => refetchStats()} className="ml-auto p-2 rounded-lg" style={glassCard}>
          <RefreshCw size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.id ? 'btn-primary-poker' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {/* Dashboard */}
        {tab === 'dashboard' && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-400' },
                { label: 'Online Players', value: stats.onlinePlayers, color: 'text-green-400' },
                { label: 'Active Tables', value: stats.activeTables, color: 'text-yellow-400' },
                { label: 'Total Hands', value: stats.totalHands, color: 'text-purple-400' },
                { label: 'Total Tables', value: stats.totalTables, color: 'text-cyan-400' },
                { label: 'Transactions', value: stats.totalTransactions, color: 'text-orange-400' },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-3" style={glassCard}>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</div>
                  <div className={`text-xl font-bold ${stat.color} mt-1`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="space-y-2">
            {usersList?.map(u => (
              <div key={u.id} className="rounded-xl p-3" style={glassCard}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                          {(u.nickname || u.name || '?')[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{u.nickname || u.name || 'Anonymous'}</div>
                      <div className="text-[10px] text-gray-500">ID: {u.id} | Role: {u.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {u.balanceReal.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {u.handsPlayed} hands | {u.handsWon} won
                    </div>
                  </div>
                </div>

                {/* Balance adjustment */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setAdjustUserId(adjustUserId === u.id ? null : u.id)}
                    className="text-[10px] px-2 py-1 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30"
                  >
                    Adjust Balance
                  </button>
                  <button
                    onClick={() => {
                      // View table state if player is in a game
                      toast.info('Player stats: ' + JSON.stringify({
                        hands: u.handsPlayed,
                        won: u.handsWon,
                        winnings: u.totalWinnings,
                        losses: u.totalLosses,
                      }));
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-700/30"
                  >
                    <Eye size={10} className="inline mr-1" /> Stats
                  </button>
                </div>

                {adjustUserId === u.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-2 flex items-center gap-2"
                  >
                    <input
                      type="number"
                      placeholder="Amount (+/-)"
                      value={adjustAmount}
                      onChange={e => setAdjustAmount(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Note"
                      value={adjustNote}
                      onChange={e => setAdjustNote(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-white"
                    />
                    <button
                      onClick={() => {
                        const amt = parseInt(adjustAmount);
                        if (!amt) return toast.error('Enter amount');
                        adjustBalance.mutate({ userId: u.id, amount: amt, note: adjustNote || undefined });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold btn-primary-poker"
                    >
                      Apply
                    </button>
                  </motion.div>
                )}
              </div>
            ))}

            {(!usersList || usersList.length === 0) && (
              <div className="text-center py-8 text-gray-500 text-sm">No users found</div>
            )}
          </div>
        )}

        {/* Transactions */}
        {tab === 'transactions' && (
          <div className="space-y-2">
            {txList?.map(tx => (
              <div key={tx.id} className="rounded-xl p-3" style={glassCard}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white capitalize">{tx.type.replace('_', ' ')}</div>
                    <div className="text-[10px] text-gray-500">
                      User #{tx.userId} | {new Date(tx.createdAt).toLocaleString()}
                    </div>
                    {tx.note && <div className="text-[10px] text-gray-600 mt-0.5">{tx.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </div>
                    <div className={`text-[10px] px-1.5 py-0.5 rounded inline-block mt-0.5 ${
                      tx.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                      tx.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-red-900/30 text-red-400'
                    }`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
                {tx.status === 'pending' && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => approveTx.mutate({ transactionId: tx.id })}
                      className="text-[10px] px-3 py-1 rounded bg-green-900/30 text-green-400 border border-green-700/30"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ))}

            {(!txList || txList.length === 0) && (
              <div className="text-center py-8 text-gray-500 text-sm">No transactions</div>
            )}
          </div>
        )}

        {/* Tables */}
        {tab === 'tables' && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 mb-2">Active game tables and their current state</div>
            {/* TODO: Show real-time table states */}
            <div className="text-center py-8 text-gray-500 text-sm">
              Table monitoring coming soon. Use Dashboard for overview stats.
            </div>
          </div>
        )}

        {/* Hand History */}
        {tab === 'history' && (
          <div className="space-y-2">
            {handHistoryList?.map(h => (
              <div key={h.id} className="rounded-xl p-3" style={glassCard}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Hand #{h.handNumber}</div>
                    <div className="text-[10px] text-gray-500">
                      Table #{h.tableId} | {new Date(h.playedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      Pot: {h.potTotal.toLocaleString()}
                    </div>
                    {h.winnerName && (
                      <div className="text-[10px] text-green-400">
                        Winner: {h.winnerName} ({h.winningHand})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(!handHistoryList || handHistoryList.length === 0) && (
              <div className="text-center py-8 text-gray-500 text-sm">No hand history yet</div>
            )}
          </div>
        )}

        {/* Admin Logs */}
        {tab === 'logs' && (
          <div className="space-y-2">
            {logsList?.map(log => (
              <div key={log.id} className="rounded-xl p-3" style={glassCard}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white capitalize">{log.action.replace('_', ' ')}</div>
                    <div className="text-[10px] text-gray-500">
                      Admin #{log.adminId} | {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {log.targetUserId && (
                    <div className="text-[10px] text-gray-400">Target: User #{log.targetUserId}</div>
                  )}
                </div>
              </div>
            ))}

            {(!logsList || logsList.length === 0) && (
              <div className="text-center py-8 text-gray-500 text-sm">No admin logs yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
