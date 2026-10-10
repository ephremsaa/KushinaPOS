import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Loader2, WifiOff, AlertTriangle, ChefHat, ShieldCheck, KeyRound } from 'lucide-react';
import { PinPad } from '../../components/ui';
import { cn, isDarkColor } from '../../lib/utils';

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-5 animate-pulse">
        <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800" />
        <div className="w-44 h-6 rounded-full bg-slate-900" />
        <div className="w-24 h-3.5 rounded-full bg-slate-900/60" />
        <div className="flex gap-4 mt-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 w-[320px] mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-3xl bg-slate-900 border border-slate-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Unavailable screen ───────────────────────────────────────────────────────

function UnavailableScreen({
  restaurantName,
  reason,
}: {
  restaurantName?: string;
  reason: 'not_found' | 'suspended' | 'rejected';
}) {
  const messages = {
    not_found: {
      icon: <WifiOff className="w-10 h-10 text-slate-500" />,
      title: restaurantName ? `${restaurantName} is Unavailable` : 'Terminal Unavailable',
      body:  "This staff login URL doesn't match any active restaurant. Check the address or contact your manager.",
    },
    suspended: {
      icon: <AlertTriangle className="w-10 h-10 text-amber-500" />,
      title: `${restaurantName ?? 'Restaurant'} Paused`,
      body:  "This restaurant's account is temporarily paused. Please contact your restaurant manager.",
    },
    rejected: {
      icon: <AlertTriangle className="w-10 h-10 text-red-500" />,
      title: 'Account Inactive',
      body:  "This restaurant's account is no longer active. Please contact your restaurant manager for details.",
    },
  };
  const m = messages[reason];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="text-center max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-10 shadow-2xl">
        <div className="w-20 h-20 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto mb-6">
          {m.icon}
        </div>
        <h1 className="text-xl font-display font-black text-white mb-3">{m.title}</h1>
        <p className="text-slate-400 text-sm leading-relaxed">{m.body}</p>
        <p className="text-slate-600 text-[11px] mt-8 font-medium">KushinaPOS Terminal Security Gateway</p>
      </div>
    </div>
  );
}

// ─── StaffLoginPage ──────────────────────────────────────────────────────────

export default function StaffLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { staffSignIn } = useAuth();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<
    'not_found' | 'suspended' | 'rejected' | null
  >(null);

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  // Check for expired session parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired')) {
      setError('Your session ended. Please sign in again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load restaurant config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await api.get<any>(`/public/restaurant/${slug}`);
        if (res.status === 'suspended') {
          setUnavailableReason('suspended');
        } else if (res.status === 'rejected' || res.status === 'pending') {
          setUnavailableReason('rejected');
        } else {
          setRestaurant(res);
        }
      } catch {
        setUnavailableReason('not_found');
      } finally {
        setLoadingConfig(false);
      }
    }
    if (slug) loadConfig();
  }, [slug]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }, []);

  const handleLogin = useCallback(async (currentPin: string) => {
    if (currentPin.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      await staffSignIn(slug!, currentPin);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Incorrect PIN. Please try again.');
      setPin('');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }, [slug, staffSignIn, navigate, triggerShake]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) handleLogin(pin);
  }, [pin, handleLogin]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => prev.length < 4 ? prev + e.key : prev);
        setError('');
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setPin('');
        setError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading]);

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loadingConfig) return <LoadingSkeleton />;
  if (unavailableReason) {
    return (
      <UnavailableScreen
        restaurantName={restaurant?.name}
        reason={unavailableReason}
      />
    );
  }

  const themeColor = restaurant?.theme_color || '#2F7D32';
  const bgColor = restaurant?.background_color || '#080c14';
  const isDark = isDarkColor(bgColor);
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#475569';

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center font-sans
                 overflow-hidden relative select-none px-6 py-10"
      style={{ background: bgColor, color: textColor }}
    >
      {/* Ambient brand glow from tenant color */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${themeColor}28 0%, transparent 70%)`,
        }}
      />
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} 1.5px, transparent 1.5px)`,
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center">

        {/* ── Restaurant identity — large & prominent ── */}
        <div className="flex flex-col items-center mb-10 text-center">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-28 h-28 rounded-3xl object-cover shadow-2xl mb-5 border-2"
              style={{ borderColor: `${themeColor}60` }}
            />
          ) : (
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl mb-5 border-2"
              style={{
                background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}12)`,
                borderColor: `${themeColor}50`,
              }}
            >
              <ChefHat className="w-14 h-14" style={{ color: themeColor }} />
            </div>
          )}
          <h1 className="text-3xl font-display font-black tracking-tight leading-tight" style={{ color: textColor }}>
            {restaurant.name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <KeyRound className="w-3.5 h-3.5" style={{ color: subtextColor }} />
            <span className="text-xs uppercase tracking-[0.2em] font-bold" style={{ color: subtextColor }}>
              Staff PIN Terminal
            </span>
          </div>
        </div>

        {/* ── Error / status feedback ── */}
        <div className="h-8 flex items-center justify-center mb-4 w-full">
          {loading ? (
            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: subtextColor }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: themeColor }} />
              <span>Authenticating…</span>
            </div>
          ) : error ? (
            <p className="text-rose-500 text-sm font-bold tracking-wide animate-scale-in flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          ) : (
            <p className="text-xs font-medium" style={{ color: subtextColor }}>Enter your 4-digit shift PIN</p>
          )}
        </div>

        {/* ── PinPad — shared component, large touch targets ── */}
        <PinPad
          value={pin}
          onChange={newPin => { setPin(newPin); setError(''); }}
          maxLength={4}
          disabled={loading}
          shaking={shaking}
          masked={true}
        />

        {/* ── Security note ── */}
        <p className="text-slate-600 text-[11px] mt-10 text-center font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
          <span>Encrypted terminal access • Rate limited</span>
        </p>
      </div>
    </div>
  );
}
