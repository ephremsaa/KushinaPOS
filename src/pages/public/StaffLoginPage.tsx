import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Store, Loader2, Delete, WifiOff, AlertTriangle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Shake animation (inline — avoids needing a CSS class)
// ─────────────────────────────────────────────────────────────
const SHAKE_KEYFRAMES = `
@keyframes pin-shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-8px); }
  30%       { transform: translateX(8px); }
  45%       { transform: translateX(-6px); }
  60%       { transform: translateX(6px); }
  75%       { transform: translateX(-3px); }
  90%       { transform: translateX(3px); }
}
`;

// ─────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-5 animate-pulse">
        <div className="w-24 h-24 rounded-3xl bg-slate-800" />
        <div className="w-40 h-5 rounded-full bg-slate-800" />
        <div className="w-24 h-3.5 rounded-full bg-slate-800/60" />
        <div className="flex gap-4 mt-4">
          {[0,1,2,3].map(i => <div key={i} className="w-14 h-14 rounded-xl bg-slate-800" />)}
        </div>
        <div className="grid grid-cols-3 gap-3 w-[280px] mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-slate-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Unavailable screen (suspended, inactive, or bad slug)
// ─────────────────────────────────────────────────────────────
function UnavailableScreen({ restaurantName, reason }: { restaurantName?: string; reason: 'not_found' | 'suspended' | 'rejected' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6">
          {reason === 'not_found' ? (
            <WifiOff className="w-9 h-9 text-slate-500" />
          ) : (
            <AlertTriangle className="w-9 h-9 text-amber-500" />
          )}
        </div>
        <h1 className="text-xl font-display font-bold text-white mb-2">
          {restaurantName ? `${restaurantName} is currently unavailable` : 'System Unavailable'}
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          {reason === 'not_found'
            ? "This staff login URL doesn't match any active restaurant. Check the address or contact your manager."
            : reason === 'suspended'
            ? "This restaurant's account is temporarily paused. This is not a device issue — please contact your manager."
            : "This restaurant's account is no longer active. Please contact your manager."}
        </p>
        <p className="text-slate-600 text-xs mt-6">
          If this seems wrong, contact your manager — not IT support.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function StaffLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { staffSignIn } = useAuth();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<'not_found' | 'suspended' | 'rejected' | null>(null);

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  // Load restaurant config from public endpoint
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await api.get<any>(`/public/restaurant/${slug}`);
        // Check if restaurant is accessible
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

  // Inject shake animation CSS once
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = SHAKE_KEYFRAMES;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) handleLogin();
  }, [pin]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }, []);

  async function handleLogin() {
    if (pin.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      await staffSignIn(slug!, pin);
      // Navigate to root — App's getHome() will route by staff role
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Invalid PIN';
      setError(msg);
      setPin('');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (num: number) => {
    if (pin.length < 4 && !loading) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    if (!loading) setPin(prev => prev.slice(0, -1));
  };

  // ── States ────────────────────────────────────────────────
  if (loadingConfig) return <LoadingSkeleton />;
  if (unavailableReason) {
    return (
      <UnavailableScreen
        restaurantName={restaurant?.name}
        reason={unavailableReason}
      />
    );
  }

  // ── Normal login UI ───────────────────────────────────────
  const themeColor = restaurant.theme_color || '#f97316';

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center text-white font-sans overflow-hidden relative"
      style={{ background: '#0a0a0f' }}
    >
      {/* Themed ambient glow from restaurant's brand color */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${themeColor}22 0%, transparent 70%)`,
        }}
      />
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      <div className="relative z-10 w-full max-w-xs sm:max-w-sm flex flex-col items-center px-6 py-10">

        {/* ── Restaurant branding ── */}
        <div className="flex flex-col items-center mb-10">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-24 h-24 rounded-3xl object-cover shadow-2xl mb-5 border-2"
              style={{ borderColor: `${themeColor}40` }}
            />
          ) : (
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl mb-5 border-2"
              style={{
                background: `${themeColor}15`,
                borderColor: `${themeColor}30`,
              }}
            >
              <Store className="w-11 h-11" style={{ color: themeColor }} />
            </div>
          )}

          <h1 className="text-2xl font-display font-bold text-center tracking-tight text-white">
            {restaurant.name}
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 uppercase tracking-[0.2em] font-medium">
            Staff Login
          </p>
        </div>

        {/* ── PIN dots ── */}
        <div
          className="flex gap-4 mb-3"
          style={{
            animation: shaking ? 'pin-shake 0.5s ease-in-out' : 'none',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-200"
              style={{
                borderColor: i < pin.length ? themeColor : 'rgba(255,255,255,0.08)',
                background: i < pin.length ? `${themeColor}15` : 'rgba(255,255,255,0.03)',
                boxShadow: i < pin.length ? `0 0 12px ${themeColor}30` : 'none',
              }}
            >
              {i < pin.length && (
                <div
                  className="w-3.5 h-3.5 rounded-full transition-all duration-200"
                  style={{ background: themeColor }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error / loading indicator below dots */}
        <div className="h-7 flex items-center justify-center mb-3">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: themeColor }} />
          ) : error ? (
            <p className="text-red-400 text-xs font-semibold tracking-wide">{error}</p>
          ) : null}
        </div>

        {/* ── PIN pad ── */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              disabled={loading || pin.length >= 4}
              className="w-full aspect-square rounded-2xl text-2xl font-semibold transition-all duration-150
                active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed
                select-none focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'white',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              {num}
            </button>
          ))}

          {/* Empty bottom-left cell */}
          <div />

          {/* 0 */}
          <button
            onClick={() => handleKeyPress(0)}
            disabled={loading || pin.length >= 4}
            className="w-full aspect-square rounded-2xl text-2xl font-semibold transition-all duration-150
              active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed
              select-none focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'white',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            0
          </button>

          {/* Backspace */}
          <button
            onClick={handleDelete}
            disabled={loading || pin.length === 0}
            className="w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-150
              active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed
              select-none focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-slate-600 text-[11px] mt-10 text-center">
          Enter your 4-digit staff PIN
        </p>

      </div>
    </div>
  );
}

