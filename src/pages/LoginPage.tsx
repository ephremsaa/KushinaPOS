import React, { useState, type FormEvent, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, LanguageSwitcher } from '../components/ui';
import { useLanguage } from '../contexts/LanguageContext';

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Autofocus email input when switching modes or mounting
  useEffect(() => {
    emailInputRef.current?.focus();
  }, [isForgotPassword]);

  // Handle auto-redirect if already signed in (just in case)
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        // Fallback if AppRoutes Navigate hasn't kicked in
        if (user.role === 'platform_admin') navigate('/admin', { replace: true });
        else navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate, location.state]);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError('');
    
    try {
      await signIn(email.trim(), password, rememberMe);
      // Let AuthContext state update trigger App.tsx redirect, or the useEffect above.
    } catch (err: any) {
      setPassword(''); // Always clear password on error
      
      const msg = err.message ? err.message.toLowerCase() : '';
      if (msg.includes('rate limit') || msg.includes('429')) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
        setError("We can't reach the server. Check your internet connection and try again.");
      } else {
        setError("That email or password isn't right. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      // Simulate network request for now
      await new Promise(r => setTimeout(r, 800));
      setForgotPasswordMessage("Contact the platform admin to reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative font-sans selection:bg-orange-500 selection:text-white">
      {/* Top right language toggle */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-2xl p-8">
          
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg border border-white/10">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display font-bold text-2xl text-white tracking-tight mb-2">
              kushinaPOS
            </h1>
            <h2 className="text-lg font-semibold text-slate-200">
              {isForgotPassword ? 'Reset password' : 'Welcome back'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {isForgotPassword 
                ? 'Enter your email to receive a reset link.' 
                : 'Sign in to manage your restaurant.'}
            </p>
          </div>

          {error && (
            <div aria-live="polite" className="p-3.5 mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-400 flex items-start gap-2.5 animate-scale-in">
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}

          {forgotPasswordMessage && isForgotPassword && (
            <div aria-live="polite" className="p-3.5 mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-sm text-emerald-400 flex items-start gap-2.5 animate-scale-in">
              <span className="flex-1 font-medium">{forgotPasswordMessage}</span>
            </div>
          )}

          {!isForgotPassword ? (
            <form onSubmit={handleLoginSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-sm font-semibold text-slate-300 mb-2 ml-1">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-orange-400" />
                  <input
                    ref={emailInputRef}
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 pl-11 pr-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label htmlFor="login-password" className="block text-sm font-semibold text-slate-300">
                    Password
                  </label>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError('');
                    }}
                    className="text-sm text-slate-400 hover:text-orange-400 transition-colors font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-orange-400" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 pl-11 pr-12 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none text-sm font-medium">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900 bg-slate-950 cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
                disabled={loading}
                className="py-4 mt-4 font-bold text-base"
              >
                Sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-300 mb-2 ml-1">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-orange-400" />
                  <input
                    ref={emailInputRef}
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 pl-11 pr-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
                disabled={loading}
                className="py-4 mt-2 font-bold text-base"
              >
                Send reset link
              </Button>

              <div className="text-center pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError('');
                    setForgotPasswordMessage('');
                  }}
                  className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {!isForgotPassword && (
            <div className="mt-8 pt-6 border-t border-slate-800/80 text-center space-y-6">
              <p className="text-sm text-slate-400 font-medium">
                New restaurant?{' '}
                <Link 
                  to="/register" 
                  className="text-orange-400 font-bold hover:text-orange-300 transition-colors"
                >
                  Register
                </Link>
              </p>
              
              <div className="inline-block px-4 py-3 rounded-2xl bg-slate-950/50 border border-slate-800/50">
                <p className="text-sm text-slate-400 font-medium">
                  Staff member? Use your restaurant's staff login link.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
