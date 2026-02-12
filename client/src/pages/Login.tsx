import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Spade } from 'lucide-react';
import { AUTH_TOKEN_KEY } from '@/main';

export default function Login() {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const guestMutation = trpc.auth.guestLogin.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result: any;
      if (mode === 'login') {
        result = await loginMutation.mutateAsync({ email, password });
      } else {
        if (name.length < 2) {
          setError('Name must be at least 2 characters');
          setLoading(false);
          return;
        }
        result = await registerMutation.mutateAsync({ email, password, name });
      }
      // Save token to localStorage
      if (result?.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      }
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await guestMutation.mutateAsync();
      // Save token to localStorage
      if (result?.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      }
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isDark
        ? 'bg-gradient-to-br from-[#0a0e17] via-[#111827] to-[#0a0e17]'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {isDark && Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: i % 3 === 0 ? '#D4AF37' : i % 3 === 1 ? '#00F0FF' : '#fff',
            }}
            animate={{
              y: [0, -40 - Math.random() * 30, 0],
              opacity: [0.05, 0.3, 0.05],
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative w-full max-w-md rounded-2xl p-8 ${
          isDark
            ? 'bg-[#1a1f2e]/90 border border-[#D4AF37]/20 shadow-2xl shadow-[#D4AF37]/5'
            : 'bg-white/90 border border-gray-200 shadow-2xl shadow-gray-200/50'
        } backdrop-blur-xl`}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)'
                : 'linear-gradient(135deg, #1a1f2e 0%, #2d3548 100%)',
            }}
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Spade className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className={`text-2xl font-bold tracking-wide ${
            isDark ? 'text-[#D4AF37]' : 'text-gray-900'
          }`}>
            HOUSE POKER
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {mode === 'login' ? 'Welcome back, player' : 'Join the table'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="relative">
              <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-xl text-sm transition-all ${
                  isDark
                    ? 'bg-[#0d1117] border border-[#2a3040] text-white placeholder-gray-500 focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30'
                    : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200'
                } outline-none`}
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 rounded-xl text-sm transition-all ${
                isDark
                  ? 'bg-[#0d1117] border border-[#2a3040] text-white placeholder-gray-500 focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30'
                  : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200'
              } outline-none`}
              required
            />
          </div>

          <div className="relative">
            <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`w-full pl-11 pr-11 py-3 rounded-xl text-sm transition-all ${
                isDark
                  ? 'bg-[#0d1117] border border-[#2a3040] text-white placeholder-gray-500 focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30'
                  : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200'
              } outline-none`}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              isDark
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black hover:from-[#E5C04B] hover:to-[#D4AF37]'
                : 'bg-gradient-to-r from-gray-900 to-gray-700 text-white hover:from-gray-800 hover:to-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </motion.button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className={`flex-1 h-px ${isDark ? 'bg-[#2a3040]' : 'bg-gray-200'}`} />
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>or</span>
          <div className={`flex-1 h-px ${isDark ? 'bg-[#2a3040]' : 'bg-gray-200'}`} />
        </div>

        {/* Guest Login */}
        <motion.button
          onClick={handleGuestLogin}
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
            isDark
              ? 'bg-[#0d1117] border border-[#2a3040] text-gray-300 hover:border-[#D4AF37]/30 hover:text-white'
              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
          } disabled:opacity-50`}
        >
          Play as Guest
        </motion.button>

        {/* Toggle mode */}
        <p className={`text-center text-sm mt-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('register'); setError(''); }}
                className={`font-semibold ${isDark ? 'text-[#D4AF37] hover:text-[#E5C04B]' : 'text-blue-600 hover:text-blue-700'}`}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className={`font-semibold ${isDark ? 'text-[#D4AF37] hover:text-[#E5C04B]' : 'text-blue-600 hover:text-blue-700'}`}
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
