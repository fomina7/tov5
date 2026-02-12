/**
 * Profile — HOUSE POKER
 * Real player profile with data from DB, avatar selection, stats
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Target, Award, Star, Shield, Flame, Crosshair, Zap, Crown, LogOut, Settings } from 'lucide-react';
import { ASSETS, AVATAR_LIST } from '@/lib/assets';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

const ACHIEVEMENTS = [
  { name: 'First Blood', desc: 'Win your first hand', threshold: 1, stat: 'handsWon', icon: Crosshair, color: 'text-red-400' },
  { name: 'High Roller', desc: 'Win over 10,000 chips total', threshold: 10000, stat: 'totalWinnings', icon: Flame, color: 'text-orange-400' },
  { name: 'Shark', desc: 'Win 100 hands', threshold: 100, stat: 'handsWon', icon: Zap, color: 'text-cyan-400' },
  { name: 'Marathon', desc: 'Play 1000 hands', threshold: 1000, stat: 'handsPlayed', icon: Star, color: 'text-green-400' },
  { name: 'Legend', desc: 'Reach level 50', threshold: 50, stat: 'level', icon: Crown, color: 'text-gold' },
];

export default function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { data: profile, refetch } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const { data: balance } = trpc.balance.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success('Profile updated!');
      refetch();
      setEditingNick(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [editingNick, setEditingNick] = useState(false);
  const [newNickname, setNewNickname] = useState('');

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
        <img src={ASSETS.ui.crown} alt="" className="w-16 h-16 opacity-50" />
        <h2 className="text-lg font-bold text-white">Sign In to Play</h2>
        <p className="text-sm text-gray-400 text-center px-8">
          Create your profile, track stats, and compete with real players
        </p>
        <a
          href={getLoginUrl()}
          className="btn-primary-poker px-8 py-3 rounded-xl text-sm font-bold tracking-wider"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          SIGN IN
        </a>
        <BottomNav />
      </div>
    );
  }

  const displayName = profile?.nickname || profile?.name || user?.name || 'Player';
  const avatarKey = profile?.avatar || 'cat';
  const avatarUrl = ASSETS.avatars[avatarKey as keyof typeof ASSETS.avatars] || ASSETS.avatars.cat;
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const xpNeeded = level * 1000;
  const xpPercent = Math.min(100, (xp / xpNeeded) * 100);

  const stats = [
    { label: 'Hands Played', value: (profile?.handsPlayed || 0).toLocaleString(), icon: Target },
    { label: 'Win Rate', value: profile?.handsPlayed ? `${((profile.handsWon / profile.handsPlayed) * 100).toFixed(1)}%` : '0%', icon: TrendingUp },
    { label: 'Total Won', value: (profile?.totalWinnings || 0).toLocaleString(), icon: Trophy },
    { label: 'Hands Won', value: (profile?.handsWon || 0).toLocaleString(), icon: Award },
  ];

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse at top, #0d1117 0%, #080a0f 50%, #050507 100%)',
    }}>
      {/* Profile header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.div
                className="w-20 h-20 rounded-full overflow-hidden"
                style={{
                  border: '3px solid rgba(212, 175, 55, 0.5)',
                  boxShadow: '0 0 25px rgba(212, 175, 55, 0.25)',
                }}
                whileHover={{ scale: 1.05 }}
              >
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              </motion.div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                  boxShadow: '0 0 8px rgba(212, 175, 55, 0.4)',
                }}>
                <span className="text-xs font-bold text-black">{level}</span>
              </div>
            </div>
            <div>
              {editingNick ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newNickname}
                    onChange={e => setNewNickname(e.target.value)}
                    placeholder="New nickname"
                    className="px-2 py-1 rounded-lg text-sm bg-black/40 border border-white/10 text-white w-32"
                    maxLength={20}
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (newNickname.trim().length >= 2) {
                        updateProfile.mutate({ nickname: newNickname.trim() });
                      }
                    }}
                    className="text-xs px-2 py-1 rounded bg-gold/20 text-gold border border-gold/30"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingNick(false)}
                    className="text-xs px-2 py-1 rounded text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <h1 className="text-xl font-bold text-white cursor-pointer" onClick={() => {
                  setNewNickname(displayName);
                  setEditingNick(true);
                }}>
                  {displayName}
                </h1>
              )}
              <p className="text-sm text-gray-400">Level {level}</p>
              <div className="flex items-center gap-2 mt-1">
                <img src={ASSETS.ui.coin} alt="" className="w-4 h-4" />
                <span className="text-sm font-bold text-gold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {balance ? balance.balanceReal.toLocaleString() : '---'}
                </span>
                <img src={ASSETS.ui.gem} alt="" className="w-4 h-4 ml-2" />
                <span className="text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#00F0FF' }}>
                  {balance ? balance.balanceBonus.toLocaleString() : '---'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              window.location.href = '/';
            }}
            className="p-2 rounded-xl"
            style={{
              background: 'rgba(10, 10, 20, 0.7)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <LogOut size={16} className="text-gray-400" />
          </button>
        </div>

        {/* XP Progress */}
        <div className="rounded-xl p-3 mb-6" style={{
          background: 'rgba(10, 10, 20, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(212, 175, 55, 0.15)',
        }}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400">Level {level}</span>
            <span className="text-gold">{xp.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpPercent}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #D4AF37, #F5E6A3)' }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl p-3"
                style={{
                  background: 'rgba(10, 10, 20, 0.7)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon size={16} className="text-gold mb-1.5" />
                <div className="text-lg font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Avatar selection */}
        <h2 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Choose Avatar</h2>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {AVATAR_LIST.map((avatar) => (
            <motion.button
              key={avatar.id}
              onClick={() => updateProfile.mutate({ avatar: avatar.id })}
              className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                avatarKey === avatar.id
                  ? 'border-gold scale-105'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={avatarKey === avatar.id ? { boxShadow: '0 0 15px rgba(212, 175, 55, 0.3)' } : {}}
              whileTap={{ scale: 0.9 }}
            >
              <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
            </motion.button>
          ))}
        </div>

        {/* Achievements */}
        <h2 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Achievements</h2>
        <div className="space-y-2">
          {ACHIEVEMENTS.map((ach, i) => {
            const Icon = ach.icon;
            const statVal = profile ? (profile as any)[ach.stat] || 0 : 0;
            const done = statVal >= ach.threshold;
            return (
              <motion.div
                key={ach.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className={`rounded-xl p-3 flex items-center gap-3 ${!done ? 'opacity-40' : ''}`}
                style={{
                  background: 'rgba(10, 10, 20, 0.7)',
                  backdropFilter: 'blur(12px)',
                  border: done ? '1px solid rgba(212, 175, 55, 0.15)' : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
                  background: done ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255,255,255,0.03)',
                }}>
                  <Icon size={18} className={done ? ach.color : 'text-gray-600'} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">{ach.name}</div>
                  <div className="text-xs text-gray-400">{ach.desc}</div>
                </div>
                {done && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{
                    background: 'rgba(76, 175, 80, 0.15)',
                    border: '1px solid rgba(76, 175, 80, 0.3)',
                  }}>
                    <span className="text-green-400 text-xs font-bold">✓</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Admin link */}
        {user && (user.role === 'admin' || user.role === 'superadmin') && (
          <a href="/admin" className="block mt-6 rounded-xl p-3 text-center" style={{
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}>
            <div className="flex items-center justify-center gap-2">
              <Shield size={16} className="text-gold" />
              <span className="text-sm font-bold text-gold">Admin Panel</span>
            </div>
          </a>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
