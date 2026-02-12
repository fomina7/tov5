/**
 * Admin Panel — Full management dashboard
 * Tabs: Dashboard, Tables, Bots, Users, Transactions, Rake, Logs
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, CreditCard, Table2, History, Shield,
  ArrowLeft, Plus, Minus, Eye, RefreshCw, Bot, BarChart3,
  ScrollText, Trash2, DollarSign, Activity, Gamepad2, UserCog,
  Trophy, Play, Pause, X, UserPlus
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

type Tab = 'dashboard' | 'tables' | 'bots' | 'users' | 'transactions' | 'rake' | 'history' | 'logs' | 'tournaments';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tables', label: 'Tables', icon: Table2 },
  { id: 'bots', label: 'Bots', icon: Bot },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'transactions', label: 'Transactions', icon: CreditCard },
  { id: 'rake', label: 'Rake', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'logs', label: 'Logs', icon: Shield },
  { id: 'tournaments', label: 'Tournaments', icon: Trophy },
];

export default function Admin() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'radial-gradient(ellipse at center, #0d1117 0%, #080a0f 50%, #050507 100%)',
      }}>
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
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
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'tables' && <TablesTab />}
        {tab === 'bots' && <BotsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'transactions' && <TransactionsTab />}
        {tab === 'rake' && <RakeTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'tournaments' && <TournamentsAdminTab />}
      </div>
    </div>
  );
}

const glassCard = {
  background: 'rgba(10, 10, 20, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.06)',
};

// ─── Dashboard ───────────────────────────────────────────
function DashboardTab() {
  const { data: stats, refetch } = trpc.admin.stats.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Dashboard</h2>
        <button onClick={() => refetch()} className="p-2 rounded-lg" style={glassCard}>
          <RefreshCw size={14} className="text-gray-400" />
        </button>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Online Players', value: stats.onlinePlayers, color: 'text-green-400' },
              { label: 'Active Tables', value: stats.activeTables, color: 'text-yellow-400' },
              { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-400' },
              { label: 'Total Hands', value: stats.totalHands, color: 'text-purple-400' },
              { label: 'Total Rake', value: stats.totalRakeCollected, color: 'text-gold' },
              { label: 'Transactions', value: stats.totalTransactions, color: 'text-orange-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3" style={glassCard}>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
                <div className={`text-xl font-bold ${s.color} mt-1`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Live table cards */}
          {stats.liveTableStates && stats.liveTableStates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Live Tables</h3>
              <div className="space-y-2">
                {stats.liveTableStates.map((t: any) => (
                  <div key={t.tableId} className="rounded-xl p-3" style={glassCard}>
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium text-sm">Table #{t.tableId}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${t.phase === 'waiting' ? 'bg-gray-700 text-gray-300' : 'bg-green-900/30 text-green-400'}`}>
                        {t.phase}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Hand #{t.handNumber} · Pot: {t.totalPot} · {t.humanCount}H + {t.botCount}B · Rake: {t.rakeCollected}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tables (with card viewing) ──────────────────────────
function TablesTab() {
  const { data: tables } = trpc.tables.list.useQuery();
  const { data: liveStates, refetch: refetchLive } = trpc.admin.liveTableStates.useQuery();
  const [viewingTable, setViewingTable] = useState<number | null>(null);
  const { data: tableState, refetch: refetchState } = trpc.admin.viewTable.useQuery(
    { tableId: viewingTable! },
    { enabled: viewingTable !== null, refetchInterval: 3000 }
  );
  const forceNewHand = trpc.admin.forceNewHand.useMutation({
    onSuccess: () => { toast.success('New hand forced'); refetchState(); },
    onError: (e) => toast.error(e.message),
  });
  const addBot = trpc.admin.addBotToTable.useMutation({
    onSuccess: () => { toast.success('Bot added'); refetchState(); },
    onError: (e) => toast.error(e.message),
  });
  const removeBot = trpc.admin.removeBotFromTable.useMutation({
    onSuccess: () => { toast.success('Bot removed'); refetchState(); },
    onError: (e) => toast.error(e.message),
  });

  const SUIT_MAP: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
  const suitColor = (s: string) => (s === 'h' || s === 'd') ? 'text-red-400' : 'text-white';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Table Management</h2>
        <button onClick={() => refetchLive()} className="p-2 rounded-lg" style={glassCard}>
          <RefreshCw size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Live table view */}
      {viewingTable !== null && tableState && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4" style={{ ...glassCard, border: '1px solid rgba(212,175,55,0.2)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold gold-text">Table #{viewingTable} — Live View</h3>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Phase: <span className="text-green-400">{tableState.phase}</span>
                {' · '}Hand #{tableState.handNumber}
                {' · '}Pot: <span className="text-gold">{tableState.pots?.reduce((s: number, p: any) => s + p.amount, 0) || 0}</span>
                {' · '}Rake: <span className="text-gold">{tableState.rakeCollected}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => refetchState()} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white">
                <RefreshCw size={12} />
              </button>
              <button onClick={() => setViewingTable(null)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white text-xs">
                ✕
              </button>
            </div>
          </div>

          {/* Community cards */}
          {tableState.communityCards && tableState.communityCards.length > 0 && (
            <div className="flex gap-1 mb-3 justify-center">
              <span className="text-[10px] text-gray-500 mr-2 self-center">Board:</span>
              {tableState.communityCards.map((c: any, i: number) => (
                <span key={i} className={`px-2 py-1 rounded bg-white/10 text-sm font-mono font-bold ${suitColor(c.suit)}`}>
                  {c.rank}{SUIT_MAP[c.suit] || c.suit}
                </span>
              ))}
            </div>
          )}

          {/* Players with ALL cards visible */}
          <div className="space-y-2">
            {tableState.players?.map((p: any) => (
              <div
                key={p.seatIndex}
                className={`rounded-lg p-2.5 flex items-center justify-between ${
                  p.seatIndex === tableState.actionSeat ? 'bg-gold/10 border border-gold/30' : 'bg-white/5 border border-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs">
                    {p.isBot ? <Bot size={12} className="text-blue-400" /> : <Users size={12} className="text-green-400" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-1">
                      {p.name}
                      {p.isBot && <span className="text-[9px] px-1 py-0 rounded bg-blue-900/30 text-blue-400">BOT</span>}
                      {p.seatIndex === tableState.actionSeat && <span className="text-[9px] px-1 py-0 rounded bg-gold/20 text-gold">ACTION</span>}
                      {p.folded && <span className="text-[9px] px-1 py-0 rounded bg-red-900/30 text-red-400">FOLD</span>}
                      {p.allIn && <span className="text-[9px] px-1 py-0 rounded bg-purple-900/30 text-purple-400">ALL-IN</span>}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Seat {p.seatIndex} · Stack: {p.chipStack} · Bet: {p.currentBet}
                      {p.lastAction && <span className="text-yellow-400 ml-1">{p.lastAction}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {p.holeCards && p.holeCards.length > 0 ? (
                    p.holeCards.map((c: any, i: number) => (
                      <span key={i} className={`px-2 py-1 rounded bg-white/10 text-sm font-mono font-bold ${suitColor(c.suit)}`}>
                        {c.rank}{SUIT_MAP[c.suit] || c.suit}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-gray-600">no cards</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Admin actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => forceNewHand.mutate({ tableId: viewingTable })}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-orange-900/30 text-orange-400 border border-orange-700/30"
            >
              Force New Hand
            </button>
            <button
              onClick={() => addBot.mutate({ tableId: viewingTable })}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-700/30"
            >
              <Plus size={10} className="inline mr-1" /> Add Bot
            </button>
          </div>

          {/* Remove bot buttons */}
          {tableState.players?.filter((p: any) => p.isBot).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-[10px] text-gray-500 self-center mr-1">Remove:</span>
              {tableState.players.filter((p: any) => p.isBot).map((p: any) => (
                <button
                  key={p.seatIndex}
                  onClick={() => removeBot.mutate({ tableId: viewingTable, seatIndex: p.seatIndex })}
                  className="text-[9px] px-2 py-1 rounded bg-red-900/20 text-red-400 border border-red-700/20"
                >
                  {p.name} (S{p.seatIndex})
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Table list */}
      <div className="space-y-2">
        {tables?.map((table: any) => {
          const live = liveStates?.find((l: any) => l.tableId === table.id);
          return (
            <div key={table.id} className="rounded-xl p-3" style={glassCard}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{table.name}</div>
                  <div className="text-[10px] text-gray-400">
                    {table.smallBlind}/{table.bigBlind} · {table.tableSize}-max · Rake: {table.rakePercentage}%
                    {table.botsEnabled && ` · Bots: ${table.botCount} (${table.botDifficulty})`}
                  </div>
                  {live && (
                    <div className="text-[10px] text-green-400 mt-0.5">
                      LIVE: {live.humanCount}H + {live.botCount}B · Hand #{live.handNumber} · {live.phase}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setViewingTable(viewingTable === table.id ? null : table.id)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border ${
                    viewingTable === table.id
                      ? 'bg-gold/10 text-gold border-gold/30'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  <Eye size={10} className="inline mr-1" />
                  {viewingTable === table.id ? 'Viewing' : 'View Cards'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bots ────────────────────────────────────────────────
function BotsTab() {
  const { data: bots, refetch } = trpc.admin.botConfigs.useQuery();
  const createBot = trpc.admin.createBot.useMutation({
    onSuccess: () => { toast.success('Bot created'); refetch(); setNewName(''); },
    onError: (e) => toast.error(e.message),
  });
  const updateBot = trpc.admin.updateBot.useMutation({
    onSuccess: () => { toast.success('Bot updated'); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBot = trpc.admin.deleteBot.useMutation({
    onSuccess: () => { toast.success('Bot deleted'); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [newName, setNewName] = useState('');
  const [newDiff, setNewDiff] = useState<'beginner' | 'medium' | 'pro'>('medium');
  const [newPersonality, setNewPersonality] = useState('balanced');

  const AVATARS = ['fox', 'shark', 'owl', 'cat', 'bear', 'monkey', 'wolf', 'penguin'];
  const EMOJIS: Record<string, string> = {
    fox: '🦊', shark: '🦈', owl: '🦉', cat: '🐱', bear: '🐻', monkey: '🐵', wolf: '🐺', penguin: '🐧'
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Bot Management</h2>

      {/* Create bot */}
      <div className="rounded-xl p-4" style={glassCard}>
        <div className="text-xs text-gray-400 mb-2 font-medium">Create New Bot</div>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Bot name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm bg-black/40 border border-white/10 text-white w-40"
          />
          <select
            value={newDiff}
            onChange={e => setNewDiff(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg text-sm bg-black/40 border border-white/10 text-white"
          >
            <option value="beginner">Beginner</option>
            <option value="medium">Medium</option>
            <option value="pro">Pro</option>
          </select>
          <select
            value={newPersonality}
            onChange={e => setNewPersonality(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm bg-black/40 border border-white/10 text-white"
          >
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
            <option value="tight">Tight</option>
            <option value="loose">Loose</option>
          </select>
          <button
            onClick={() => {
              if (!newName.trim()) return toast.error('Enter bot name');
              createBot.mutate({
                name: newName,
                difficulty: newDiff,
                personality: newPersonality,
                avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
              });
            }}
            className="btn-primary-poker px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            <Plus size={14} className="inline mr-1" /> Create
          </button>
        </div>
      </div>

      {/* Bot list */}
      <div className="space-y-2">
        {bots?.map((bot: any) => (
          <div key={bot.id} className="rounded-xl p-3" style={glassCard}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-xl">
                  {EMOJIS[bot.avatar] || '🤖'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-1.5">
                    {bot.name}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      bot.difficulty === 'pro' ? 'bg-red-900/30 text-red-400' :
                      bot.difficulty === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-green-900/30 text-green-400'
                    }`}>{bot.difficulty}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">{bot.personality}</span>
                    {!bot.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Inactive</span>}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Games: {bot.gamesPlayed} · ID: {bot.id}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => updateBot.mutate({ id: bot.id, isActive: !bot.isActive })}
                  className={`text-[10px] px-2 py-1 rounded border ${
                    bot.isActive ? 'bg-orange-900/20 text-orange-400 border-orange-700/20' : 'bg-green-900/20 text-green-400 border-green-700/20'
                  }`}
                >
                  {bot.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete bot "${bot.name}"?`)) deleteBot.mutate({ id: bot.id });
                  }}
                  className="text-[10px] px-2 py-1 rounded bg-red-900/20 text-red-400 border border-red-700/20"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {(!bots || bots.length === 0) && (
          <div className="text-center py-8 text-gray-500 text-sm">No bots configured. Create one above.</div>
        )}
      </div>
    </div>
  );
}

// ─── Users ───────────────────────────────────────────────
function UsersTab() {
  const { data: usersList, refetch } = trpc.admin.users.useQuery({ limit: 50, offset: 0 });
  const adjustBalance = trpc.admin.adjustBalance.useMutation({
    onSuccess: () => { toast.success('Balance adjusted'); setAdjustId(null); setAdjustAmt(''); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { toast.success('Role updated'); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">User Management</h2>
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
                  <div className="text-sm font-medium text-white flex items-center gap-1">
                    {u.nickname || u.name || 'Anonymous'}
                    <span className={`text-[9px] px-1 py-0 rounded ${u.role === 'admin' ? 'bg-red-900/30 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    ID: {u.id} · {u.handsPlayed} hands · {u.handsWon} won · Rakeback: {u.rakebackBalance}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {u.balanceReal.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setAdjustId(adjustId === u.id ? null : u.id)}
                className="text-[10px] px-2 py-1 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30"
              >
                <DollarSign size={10} className="inline mr-0.5" /> Adjust
              </button>
              <button
                onClick={() => {
                  const newRole = u.role === 'admin' ? 'user' : 'admin';
                  if (confirm(`Set ${u.name} as ${newRole}?`)) setRole.mutate({ userId: u.id, role: newRole as any });
                }}
                className="text-[10px] px-2 py-1 rounded bg-purple-900/30 text-purple-400 border border-purple-700/30"
              >
                <UserCog size={10} className="inline mr-0.5" /> Role
              </button>
            </div>

            {adjustId === u.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 flex items-center gap-2">
                <input type="number" placeholder="Amount (+/-)" value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-white" />
                <input type="text" placeholder="Note" value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-white" />
                <button onClick={() => {
                  const amt = parseInt(adjustAmt);
                  if (!amt) return toast.error('Enter amount');
                  adjustBalance.mutate({ userId: u.id, amount: amt, note: adjustNote || undefined });
                }} className="px-3 py-1.5 rounded-lg text-xs font-bold btn-primary-poker">Apply</button>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Transactions ────────────────────────────────────────
function TransactionsTab() {
  const { data: txList, refetch } = trpc.admin.transactions.useQuery({ limit: 50, offset: 0 });
  const approve = trpc.admin.approveTransaction.useMutation({
    onSuccess: () => { toast.success('Approved'); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const reject = trpc.admin.rejectTransaction.useMutation({
    onSuccess: () => { toast.success('Rejected'); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Transactions</h2>
      <div className="space-y-2">
        {txList?.map(tx => (
          <div key={tx.id} className="rounded-xl p-3" style={glassCard}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white capitalize">{tx.type.replace('_', ' ')}</div>
                <div className="text-[10px] text-gray-500">
                  User #{tx.userId} · {new Date(tx.createdAt).toLocaleString()}
                </div>
                {tx.note && <div className="text-[10px] text-gray-600 mt-0.5 truncate max-w-64">{tx.note}</div>}
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
                }`}>{tx.status}</div>
              </div>
            </div>
            {tx.status === 'pending' && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => approve.mutate({ transactionId: tx.id })}
                  className="text-[10px] px-3 py-1 rounded bg-green-900/30 text-green-400 border border-green-700/30">Approve</button>
                <button onClick={() => reject.mutate({ transactionId: tx.id })}
                  className="text-[10px] px-3 py-1 rounded bg-red-900/30 text-red-400 border border-red-700/30">Reject</button>
              </div>
            )}
          </div>
        ))}
        {(!txList || txList.length === 0) && <div className="text-center py-8 text-gray-500 text-sm">No transactions</div>}
      </div>
    </div>
  );
}

// ─── Rake ────────────────────────────────────────────────
function RakeTab() {
  const { data: rakeData } = trpc.admin.rakeStats.useQuery({ days: 30 });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Rake Statistics (30 days)</h2>

      {rakeData && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Rake', value: rakeData.summary?.totalRake ?? 0, color: 'text-gold' },
              { label: 'Pot Volume', value: rakeData.summary?.totalPot ?? 0, color: 'text-blue-400' },
              { label: 'Hands Raked', value: rakeData.summary?.handCount ?? 0, color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3" style={glassCard}>
                <div className="text-[10px] text-gray-500 uppercase">{s.label}</div>
                <div className={`text-lg font-bold ${s.color} mt-1`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="text-sm font-medium text-gray-300 mt-4 mb-2">Recent Rake Entries</div>
          <div className="space-y-1">
            {rakeData.recentRakes?.map((r: any) => (
              <div key={r.id} className="rounded-lg p-2 flex items-center justify-between" style={glassCard}>
                <div className="text-[10px] text-gray-400">
                  Table #{r.tableId} · Hand #{r.handNumber}
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="text-gray-400">Pot: {r.potAmount}</span>
                  <span className="text-gold font-bold">Rake: {r.rakeAmount}</span>
                </div>
                <div className="text-[9px] text-gray-600">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {(!rakeData.recentRakes || rakeData.recentRakes.length === 0) && (
              <div className="text-center py-4 text-gray-500 text-sm">No rake entries yet</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── History ─────────────────────────────────────────────
function HistoryTab() {
  const { data: hands } = trpc.admin.handHistory.useQuery({ limit: 50 });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Hand History</h2>
      <div className="space-y-2">
        {hands?.map(h => (
          <div key={h.id} className="rounded-xl p-3" style={glassCard}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Hand #{h.handNumber}</div>
                <div className="text-[10px] text-gray-500">
                  Table #{h.tableId} · {new Date(h.playedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Pot: {h.potTotal.toLocaleString()}
                </div>
                {h.winnerName && (
                  <div className="text-[10px] text-green-400">
                    {h.winnerName} — {h.winningHand}
                  </div>
                )}
                {h.rakeAmount > 0 && (
                  <div className="text-[9px] text-gray-500">Rake: {h.rakeAmount}</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {(!hands || hands.length === 0) && <div className="text-center py-8 text-gray-500 text-sm">No hand history yet</div>}
      </div>
    </div>
  );
}

// ─── Logs ────────────────────────────────────────────────
function LogsTab() {
  const { data: logs } = trpc.admin.logs.useQuery({ limit: 50 });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Admin Logs</h2>
      <div className="space-y-2">
        {logs?.map(log => (
          <div key={log.id} className="rounded-xl p-3" style={glassCard}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-white capitalize">{log.action.replace(/_/g, ' ')}</span>
                {log.targetUserId && <span className="text-[10px] text-gray-400 ml-2">→ User #{log.targetUserId}</span>}
                <div className="text-[10px] text-gray-600 mt-0.5 truncate max-w-80">
                  {JSON.stringify(log.details)}
                </div>
              </div>
              <div className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        {(!logs || logs.length === 0) && <div className="text-center py-8 text-gray-500 text-sm">No admin logs yet</div>}
      </div>
    </div>
  );
}


// ─── Tournaments Admin ──────────────────────────────────
function TournamentsAdminTab() {
  const { data: tournamentList, refetch } = trpc.admin.tournamentList.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'sit_and_go' as 'sit_and_go' | 'mtt' | 'freeroll',
    buyIn: 0,
    entryFee: 0,
    startingChips: 1500,
    maxPlayers: 9,
    minPlayers: 2,
    tableSize: '6' as '2' | '4' | '6' | '9',
    guaranteedPrize: 0,
    botsEnabled: true,
    botCount: 3,
    botDifficulty: 'mixed' as 'beginner' | 'medium' | 'pro' | 'mixed',
    scheduledStart: '',
  });

  const createMut = trpc.admin.createTournament.useMutation({
    onSuccess: (data) => {
      toast.success(`Tournament created (ID: ${data.tournamentId})`);
      setShowCreate(false);
      setFormData({ ...formData, name: '' });
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.admin.deleteTournament.useMutation({
    onSuccess: () => { toast.success('Tournament deleted'); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.admin.updateTournament.useMutation({
    onSuccess: () => { toast.success('Tournament updated'); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const addBotsMut = trpc.admin.addBotsToTournament.useMutation({
    onSuccess: (data) => { toast.success(`${data.added} bots added`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const startMut = trpc.admin.startTournament.useMutation({
    onSuccess: (data) => { toast.success(`Tournament started! ${data.players} players, prize pool: ${data.prizePool}`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm bg-black/40 border border-white/10 text-white focus:border-gold/50 focus:outline-none";
  const labelClass = "text-[11px] text-gray-400 uppercase tracking-wider mb-1 block";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Tournament Management</h2>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg" style={glassCard}>
            <RefreshCw size={14} className="text-gray-400" />
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold btn-primary-poker">
            <Plus size={12} /> Create
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 space-y-3"
          style={{ ...glassCard, border: '1px solid rgba(212,175,55,0.2)' }}
        >
          <h3 className="text-sm font-bold gold-text">Create Tournament</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Name</label>
              <input type="text" placeholder="Tournament name" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Type</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                className={inputClass}>
                <option value="sit_and_go">Sit & Go</option>
                <option value="mtt">MTT</option>
                <option value="freeroll">Freeroll</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Table Size</label>
              <select value={formData.tableSize} onChange={e => setFormData({ ...formData, tableSize: e.target.value as any })}
                className={inputClass}>
                <option value="2">Heads Up (2)</option>
                <option value="4">Short (4)</option>
                <option value="6">6-Max</option>
                <option value="9">Full Ring (9)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Buy-in</label>
              <input type="number" value={formData.buyIn} onChange={e => setFormData({ ...formData, buyIn: Number(e.target.value) })}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Entry Fee (Rake)</label>
              <input type="number" value={formData.entryFee} onChange={e => setFormData({ ...formData, entryFee: Number(e.target.value) })}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Starting Chips</label>
              <input type="number" value={formData.startingChips} onChange={e => setFormData({ ...formData, startingChips: Number(e.target.value) })}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Guaranteed Prize</label>
              <input type="number" value={formData.guaranteedPrize} onChange={e => setFormData({ ...formData, guaranteedPrize: Number(e.target.value) })}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Max Players</label>
              <input type="number" value={formData.maxPlayers} onChange={e => setFormData({ ...formData, maxPlayers: Number(e.target.value) })}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Min Players</label>
              <input type="number" value={formData.minPlayers} onChange={e => setFormData({ ...formData, minPlayers: Number(e.target.value) })}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Bot Count</label>
              <input type="number" value={formData.botCount} onChange={e => setFormData({ ...formData, botCount: Number(e.target.value) })}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Bot Difficulty</label>
              <select value={formData.botDifficulty} onChange={e => setFormData({ ...formData, botDifficulty: e.target.value as any })}
                className={inputClass}>
                <option value="mixed">Mixed</option>
                <option value="beginner">Beginner</option>
                <option value="medium">Medium</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Scheduled Start (optional)</label>
              <input type="datetime-local" value={formData.scheduledStart}
                onChange={e => setFormData({ ...formData, scheduledStart: e.target.value })}
                className={inputClass} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => createMut.mutate(formData)}
              disabled={createMut.isPending || !formData.name}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold btn-primary-poker disabled:opacity-50"
            >
              {createMut.isPending ? 'Creating...' : 'Create Tournament'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Tournament list */}
      <div className="space-y-3">
        {tournamentList?.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl p-4"
            style={glassCard}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Trophy size={14} className="text-gold" />
                  {t.name}
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 uppercase">
                    {t.type === 'sit_and_go' ? 'SNG' : t.type === 'mtt' ? 'MTT' : 'FREE'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  ID: {t.id} · Created: {new Date(t.createdAt).toLocaleString()}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                t.status === 'registering' ? 'bg-green-900/30 text-green-400 border border-green-700/30' :
                t.status === 'running' ? 'bg-orange-900/30 text-orange-400 border border-orange-700/30' :
                t.status === 'completed' ? 'bg-gray-700/30 text-gray-400 border border-gray-600/30' :
                t.status === 'cancelled' ? 'bg-red-900/30 text-red-400 border border-red-700/30' :
                'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
              }`}>
                {t.status}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Players', value: `${t.currentPlayers}/${t.maxPlayers}` },
                { label: 'Buy-in', value: t.buyIn === 0 ? 'FREE' : t.buyIn.toLocaleString() },
                { label: 'Prize', value: Math.max(t.prizePool, t.guaranteedPrize).toLocaleString() },
                { label: 'Chips', value: t.startingChips.toLocaleString() },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-[9px] text-gray-500 uppercase">{s.label}</div>
                  <div className="text-xs font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {t.status === 'registering' && (
                <>
                  <button
                    onClick={() => addBotsMut.mutate({ tournamentId: t.id, count: 3 })}
                    disabled={addBotsMut.isPending}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-700/30 flex items-center gap-1"
                  >
                    <UserPlus size={10} /> +3 Bots
                  </button>
                  <button
                    onClick={() => addBotsMut.mutate({ tournamentId: t.id, count: 5 })}
                    disabled={addBotsMut.isPending}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-700/30 flex items-center gap-1"
                  >
                    <UserPlus size={10} /> +5 Bots
                  </button>
                  <button
                    onClick={() => startMut.mutate({ tournamentId: t.id })}
                    disabled={startMut.isPending}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-green-900/30 text-green-400 border border-green-700/30 flex items-center gap-1"
                  >
                    <Play size={10} /> Start
                  </button>
                </>
              )}
              {t.status === 'running' && (
                <button
                  onClick={() => updateMut.mutate({ id: t.id, status: 'paused' })}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-yellow-900/30 text-yellow-400 border border-yellow-700/30 flex items-center gap-1"
                >
                  <Pause size={10} /> Pause
                </button>
              )}
              {t.status === 'paused' && (
                <button
                  onClick={() => updateMut.mutate({ id: t.id, status: 'running' })}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-green-900/30 text-green-400 border border-green-700/30 flex items-center gap-1"
                >
                  <Play size={10} /> Resume
                </button>
              )}
              {(t.status === 'registering' || t.status === 'paused') && (
                <button
                  onClick={() => updateMut.mutate({ id: t.id, status: 'cancelled' })}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-900/30 text-orange-400 border border-orange-700/30 flex items-center gap-1"
                >
                  <X size={10} /> Cancel
                </button>
              )}
              {(t.status === 'registering' || t.status === 'cancelled') && (
                <button
                  onClick={() => {
                    if (confirm(`Delete tournament "${t.name}"?`)) {
                      deleteMut.mutate({ id: t.id });
                    }
                  }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-900/30 text-red-400 border border-red-700/30 flex items-center gap-1"
                >
                  <Trash2 size={10} /> Delete
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {(!tournamentList || tournamentList.length === 0) && (
          <div className="text-center py-12">
            <Trophy size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No tournaments yet</p>
            <p className="text-gray-500 text-xs mt-1">Click "Create" to add your first tournament</p>
          </div>
        )}
      </div>
    </div>
  );
}
