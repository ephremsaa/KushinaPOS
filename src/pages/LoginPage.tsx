import React, { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChefHat, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  Sparkles, 
  Zap, 
  Utensils, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  Store
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password.trim());
      // AuthContext sets user — App router will redirect based on role
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  const fillDemo = (demoEmail: string, demoPw: string = 'password123') => {
    setEmail(demoEmail);
    setPassword(demoPw);
    setError('');
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center relative overflow-hidden font-sans selection:bg-orange-500 selection:text-white">
      {/* ── Background Mesh & Glowing Ambient Lighting ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-left orange glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px] animate-pulse-soft" />
        {/* Bottom-right amber glow */}
        <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-amber-500/15 rounded-full blur-[140px] animate-pulse-soft" style={{ animationDelay: '1s' }} />
        {/* Center subtle violet depth */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-indigo-900/10 rounded-full blur-[160px]" />
        
        {/* Radial grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }} 
        />
      </div>

      {/* ── Main Container ── */}
      <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* ── Left Column: Brand & Feature Showcase (Desktop 7 cols) ── */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-8 pr-0 lg:pr-8">
            
            {/* Top Tagline / Brand Badge */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen Restaurant POS v2.0</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-white tracking-tight leading-[1.15]">
                Powering your <br />
                <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
                  Culinary Vision.
                </span>
              </h1>
              
              <p className="text-slate-400 text-base sm:text-lg max-w-lg leading-relaxed font-normal">
                Seamless table management, real-time Kitchen Display System, smart inventory, and offline-first ordering in one unified platform.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl hover:border-orange-500/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-3 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold text-sm">3s Checkout</h3>
                <p className="text-slate-400 text-xs mt-1">Sub-second order dispatch & offline sync.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl hover:border-amber-500/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-110 transition-transform">
                  <Utensils className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold text-sm">Smart KDS</h3>
                <p className="text-slate-400 text-xs mt-1">Live order tickets with prep timers.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl hover:border-orange-500/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold text-sm">Live Analytics</h3>
                <p className="text-slate-400 text-xs mt-1">Automated daily revenue & menu insights.</p>
              </div>
            </div>

            {/* Live Interactive Widget Preview */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800 flex items-center justify-between backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Terminal Status</div>
                  <div className="text-xs font-semibold text-white">All Systems Operational • Cloud Sync Active</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Encrypted POS</span>
              </div>
            </div>

            {/* Demo Accounts Quick-Fill Chips */}
            <div className="pt-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Quick Demo Access:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('owner@restaurant.com', 'password123')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-orange-500/20 hover:border-orange-500/50 border border-slate-700 text-xs text-slate-300 hover:text-orange-300 transition-all cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-orange-400" />
                  <span>Restaurant Owner</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('admin@kushina.com', 'admin123')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-amber-500/20 hover:border-amber-500/50 border border-slate-700 text-xs text-slate-300 hover:text-amber-300 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Platform Admin</span>
                </button>
              </div>
            </div>

          </div>

          {/* ── Right Column: Ultra-Modern Glass Login Card (Desktop 5 cols) ── */}
          <div className="lg:col-span-5 w-full">
            <div className="relative group">
              {/* Outer soft glowing border effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
              
              {/* Glass Card */}
              <div className="relative rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-slate-800/90 shadow-2xl p-6 sm:p-8">
                
                {/* Header Logo & Title */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_25px_rgba(249,115,22,0.4)] border border-white/20 transform group-hover:scale-105 transition-transform duration-300">
                    <ChefHat className="w-9 h-9 text-white" />
                  </div>
                  <h2 className="font-display font-bold text-2xl text-white tracking-tight">
                    Welcome back
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Sign in to access your kushinaPOS account
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3.5 mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 flex items-start gap-2.5 animate-scale-in">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                    <span className="flex-1">{error}</span>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 ml-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-orange-400" />
                      <input
                        type="email"
                        className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 backdrop-blur-sm pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all duration-200"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@restaurant.com"
                        required
                        id="login-email"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Password
                      </label>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-orange-400" />
                      <input
                        type={showPw ? 'text' : 'password'}
                        className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 backdrop-blur-sm pl-11 pr-11 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all duration-200"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        id="login-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
                        onClick={() => setShowPw(!showPw)}
                        tabIndex={-1}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Option */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900 bg-slate-950 cursor-pointer"
                      />
                      <span>Keep me signed in</span>
                    </label>

                    <span className="text-slate-400 hover:text-orange-400 transition-colors cursor-pointer">
                      Need help?
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-semibold text-sm shadow-[0_0_20px_rgba(249,115,22,0.35)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
                    disabled={loading}
                    id="login-submit"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Authenticating…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in to Terminal</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer Register Link */}
                <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                  <p className="text-xs text-slate-400">
                    New restaurant?{' '}
                    <Link 
                      to="/register" 
                      className="text-orange-400 font-semibold hover:text-orange-300 hover:underline transition-colors inline-flex items-center gap-1"
                    >
                      Register your store
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </p>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

