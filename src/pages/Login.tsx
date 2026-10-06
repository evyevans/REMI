/* ═══════════════════════════════════════════════════════════
   Login Page — Premium Split-Layout Authentication
   Cream/Titanium aesthetic matching REMI design system
   ═══════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { GUEST_KEY } from '../App';
import { useMarketStore } from '../stores/marketStore';

type Mode = 'signin' | 'signup';

const DEMO_MARKET = {
  id: 'austin-tx-us',
  city: 'Austin',
  state_province: 'TX',
  abbr: 'TX',
  country: 'US',
  displayName: 'Austin, TX',
  lat: 30.2672,
  lng: -97.7431,
  resolution: 'city' as const,
};

export default function Login() {
  const navigate = useNavigate();
  const { signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const { setCurrentMarket } = useMarketStore();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGoogle = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      await signInWithGoogle();
      // Supabase handles the OAuth redirect
    } catch (err: unknown) {
      console.error('Google sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect with Google');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await signUp(email, password, fullName);
        if (signUpError) {
          setError(signUpError);
        } else {
          setSuccess('Account created! Check your email to confirm, then sign in.');
          setMode('signin');
        }
      } else {
        const { error: signInError } = await signInWithPassword(email, password);
        if (signInError) {
          setError(signInError);
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-bg-primary overflow-hidden selection:bg-accent selection:text-white">
      
      {/* ── Liquid Ambient Background ─────────────────────── */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#D5D2C4] opacity-40 blur-[120px]"
        />
        <motion.div 
          animate={{ x: [0, -40, 0], y: [0, -50, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#E8E6DD] opacity-60 blur-[150px]"
        />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full bg-white opacity-20 blur-[100px]"
        />
      </div>

      {/* ── Glassmorphic Login Container ──────────────────── */}
      <div className="relative z-10 w-full max-w-[440px] px-6 flex flex-col items-center">
        
        {/* ── Typographic Branding (Above Card) ── */}
        <div className="mb-10 text-center flex flex-col items-center">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">REMI</h1>
          <p className="text-xs text-text-tertiary mt-2 tracking-[0.2em] uppercase font-semibold">Real Estate Market Intelligence</p>
        </div>

        {/* The Glass Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-bg-elevated/80 backdrop-blur-2xl border border-white/40 shadow-[0_8px_40px_rgba(0,0,0,0.04)] rounded-4xl p-8 sm:p-10 relative overflow-hidden"
        >
          {/* Inner card subtle top highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/80 to-transparent opacity-50" />

          <div className="mb-8 text-center">
            <h2 className="text-xl font-semibold text-text-primary">
              {mode === 'signin' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-sm text-text-tertiary mt-1.5">
              {mode === 'signin' ? 'Enter your details to access the system.' : 'Join the elite echelon of real estate.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Error / Success banners */}
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-red-50/50 border border-red-100 rounded-xl flex items-center gap-2 text-sm text-red-600">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-green-50/50 border border-green-100 rounded-xl text-sm text-green-700 text-center">
                {success}
              </motion.div>
            )}

            {mode === 'signup' && (
              <div>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-white/50 border border-border/50 rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:bg-white focus:border-border focus:ring-4 focus:ring-accent/5 transition-all shadow-sm"
                />
              </div>
            )}

            <div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full bg-white/50 border border-border/50 rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:bg-white focus:border-border focus:ring-4 focus:ring-accent/5 transition-all shadow-sm"
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="w-full bg-white/50 border border-border/50 rounded-xl px-4 py-3.5 pr-10 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:bg-white focus:border-border focus:ring-4 focus:ring-accent/5 transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition cursor-pointer p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 px-4 bg-[#111111] text-white text-sm font-medium rounded-xl hover:bg-black active:scale-[0.98] transition-all disabled:bg-[#111111] disabled:opacity-90 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-black/20 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading
                ? (mode === 'signin' ? 'Authenticating...' : 'Creating...')
                : (mode === 'signin' ? 'Sign in' : 'Continue')
              }
              {!loading && <ArrowRight size={16} className="opacity-70" />}
            </button>
          </form>

          {/* ── Guest Access ─────────────────────────────────── */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/20 shadow-sm" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-bg-elevated px-3 text-text-tertiary font-medium relative top-px">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCurrentMarket(DEMO_MARKET);
              localStorage.setItem(GUEST_KEY, 'true');
              navigate('/', { replace: true });
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl border border-accent/30 bg-accent/8 hover:bg-accent/12 text-accent text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer group"
          >
            Click here to access
            <ArrowRight size={15} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <p className="text-center text-[11px] text-text-tertiary mt-2">
            No sign-up required &mdash; explore as a guest
          </p>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/20 shadow-sm" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-bg-elevated px-3 text-text-tertiary font-medium relative top-px">or</span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/60 border border-border/60 hover:bg-white rounded-xl text-sm font-medium text-text-primary transition-all disabled:opacity-50 active:scale-[0.98] disabled:active:scale-100 shadow-sm cursor-pointer"
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>
        </motion.div>

        {/* Footer Links */}
        <div className="mt-8 text-center space-y-4 relative z-10">
          <p className="text-sm text-text-secondary font-medium">
            {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null); }}
              className="text-text-primary font-bold hover:text-text-primary transition-colors cursor-pointer"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
          <p className="text-[11px] text-text-tertiary">
            By continuing, you agree to REMI&apos;s Terms of Service and Privacy.
          </p>
        </div>

      </div>
    </div>
  );
}
