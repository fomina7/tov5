/**
 * Cashier — HOUSE POKER
 * Real balance from DB, deposit/withdraw with tRPC, transaction history
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, ArrowDownToLine, ArrowUpFromLine, History, Wallet, CreditCard, Copy, Check } from 'lucide-react';
import { ASSETS } from '@/lib/assets';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

export default function Cashier() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: balance, refetch: refetchBalance } = trpc.balance.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: txHistory } = trpc.balance.transactions.useQuery(
    { limit: 20, offset: 0 },
    { enabled: isAuthenticated && activeTab === 'history', retry: false }
  );

  const requestDeposit = trpc.balance.requestDeposit.useMutation({
    onSuccess: (data) => {
      toast.success(`Deposit request created! Transaction #${data.transactionId}`);
      setDepositAmount('');
      refetchBalance();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const requestWithdraw = trpc.balance.requestWithdraw.useMutation({
    onSuccess: () => {
      toast.success('Withdrawal request submitted! Admin will process it shortly.');
      setWithdrawAmount('');
      setWithdrawAddress('');
      refetchBalance();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'radial-gradient(ellipse at top, #0d1117 0%, #080a0f 50%, #050507 100%)',
      }}>
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 pb-24" style={{
        background: 'radial-gradient(ellipse at top, #0d1117 0%, #080a0f 50%, #050507 100%)',
      }}>
        <CreditCard size={48} className="text-gold opacity-50" />
        <h2 className="text-lg font-bold text-white">Sign In Required</h2>
        <p className="text-sm text-gray-400">Please sign in to access the cashier</p>
        <a href={getLoginUrl()} className="btn-primary-poker px-8 py-3 rounded-xl text-sm font-bold">
          SIGN IN
        </a>
        <BottomNav />
      </div>
    );
  }

  const glassCard = {
    background: 'rgba(10, 10, 20, 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  // Placeholder deposit address (in production, generate per-user)
  const depositAddress = 'UQBv...HOUSE_POKER_DEPOSIT';

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse at top, #0d1117 0%, #080a0f 50%, #050507 100%)',
    }}>
      <div className="px-4 pt-4 pb-3">
        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 mb-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(0, 240, 255, 0.04) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
          }}
        >
          <motion.div
            className="absolute -top-10 -right-10 w-32 h-32 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 relative z-10">Your Balance</div>
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <img src={ASSETS.ui.coin} alt="" className="w-8 h-8" />
            <span className="text-3xl font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {balance ? balance.balanceReal.toLocaleString() : '---'}
            </span>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <img src={ASSETS.ui.gem} alt="" className="w-5 h-5" />
            <span className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#00F0FF' }}>
              {balance ? balance.balanceBonus.toLocaleString() : '---'}
            </span>
            <span className="text-xs text-gray-500 ml-1">Bonus</span>
          </div>
        </motion.div>

        {/* Daily bonus */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => toast.info('Daily bonus feature coming soon')}
          className="w-full rounded-xl p-4 mb-5 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 200, 0, 0.08) 0%, rgba(0, 240, 255, 0.03) 100%)',
            border: '1px solid rgba(0, 200, 0, 0.25)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
            background: 'rgba(0, 200, 0, 0.1)',
            border: '1px solid rgba(0, 200, 0, 0.2)',
          }}>
            <Gift size={24} className="text-green-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-bold text-green-400">Daily Bonus</div>
            <div className="text-xs text-gray-400">Claim your free chips!</div>
          </div>
          <div className="px-4 py-2 rounded-lg text-sm font-bold" style={{
            background: 'rgba(0, 200, 0, 0.15)',
            color: '#4CAF50',
            border: '1px solid rgba(0, 200, 0, 0.3)',
          }}>
            CLAIM
          </div>
        </motion.button>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4 p-1 rounded-xl" style={{
          background: 'rgba(10, 10, 20, 0.5)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {[
            { key: 'deposit' as const, label: 'Deposit', icon: ArrowDownToLine },
            { key: 'withdraw' as const, label: 'Withdraw', icon: ArrowUpFromLine },
            { key: 'history' as const, label: 'History', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === tab.key ? 'btn-primary-poker' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Deposit */}
        {activeTab === 'deposit' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-xl p-4" style={glassCard}>
              <h3 className="text-sm font-bold text-white mb-3">Deposit Amount</h3>

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[100, 500, 1000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setDepositAmount(amt.toString())}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      depositAmount === amt.toString()
                        ? 'bg-gold/20 text-gold border border-gold/30'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="Enter amount..."
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/40 border border-white/10 text-white mb-3"
              />

              <button
                onClick={() => {
                  const amt = parseInt(depositAmount);
                  if (!amt || amt < 1) return toast.error('Enter a valid amount');
                  requestDeposit.mutate({ amount: amt });
                }}
                disabled={requestDeposit.isPending}
                className="w-full py-3 rounded-xl text-sm font-bold btn-primary-poker tracking-wider disabled:opacity-50"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {requestDeposit.isPending ? 'Processing...' : 'REQUEST DEPOSIT'}
              </button>

              <p className="text-[10px] text-gray-500 mt-2 text-center">
                Deposits are processed by admin. Your balance will be updated after approval.
              </p>
            </div>

            {/* Deposit address info */}
            <div className="rounded-xl p-4" style={glassCard}>
              <h3 className="text-sm font-bold text-white mb-2">Deposit Address (USDT/TON)</h3>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
                <code className="text-xs text-gray-300 flex-1 truncate">{depositAddress}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(depositAddress);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast.success('Address copied!');
                  }}
                  className="p-1.5 rounded"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                Send USDT (TRC-20) or TON to this address, then submit a deposit request above.
              </p>
            </div>
          </motion.div>
        )}

        {/* Withdraw */}
        {activeTab === 'withdraw' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4"
            style={glassCard}
          >
            <h3 className="text-sm font-bold text-white mb-3">Withdraw Funds</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/40 border border-white/10 text-white"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-500">Min: 100</span>
                  <span className="text-[10px] text-gray-400">
                    Available: <span className="text-gold">{balance?.balanceReal.toLocaleString() || 0}</span>
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Wallet Address</label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={e => setWithdrawAddress(e.target.value)}
                  placeholder="Enter your wallet address..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/40 border border-white/10 text-white"
                />
              </div>

              <button
                onClick={() => {
                  const amt = parseInt(withdrawAmount);
                  if (!amt || amt < 100) return toast.error('Minimum withdrawal is 100');
                  if (!withdrawAddress || withdrawAddress.length < 10) return toast.error('Enter a valid wallet address');
                  if (balance && amt > balance.balanceReal) return toast.error('Insufficient balance');
                  requestWithdraw.mutate({ amount: amt, walletAddress: withdrawAddress });
                }}
                disabled={requestWithdraw.isPending}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-wider disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(0, 200, 255, 0.05))',
                  color: '#00F0FF',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                {requestWithdraw.isPending ? 'Processing...' : 'REQUEST WITHDRAWAL'}
              </button>

              <p className="text-[10px] text-gray-500 text-center">
                Withdrawals are processed within 24 hours by admin.
              </p>
            </div>
          </motion.div>
        )}

        {/* Transaction History */}
        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            {txHistory && txHistory.length > 0 ? (
              txHistory.map((tx) => (
                <div key={tx.id} className="rounded-xl p-3" style={glassCard}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white capitalize">
                        {tx.type.replace('_', ' ')}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                      </div>
                      <div className={`text-[10px] px-1.5 py-0.5 rounded inline-block ${
                        tx.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                        tx.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {tx.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 text-sm">
                No transactions yet
              </div>
            )}
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
