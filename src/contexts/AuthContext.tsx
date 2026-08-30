import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi, setToken, getToken, clearToken } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────
export type UserRole = 'platform_admin' | 'restaurant_owner' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  staffRole?: string;            // owner | manager | cashier | kitchen | waiter
  restaurantId?: string;
  restaurantStatus?: string;     // pending | active | suspended | rejected
  restaurantName?: string;
  hasSubscription?: boolean;     // false = approved but no plan selected yet
  // Full restaurant object (for owners)
  restaurant?: Record<string, unknown>;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  staffSignIn: (slug: string, pin: string) => Promise<void>;
  signOut: () => void;
  register: (data: Record<string, unknown>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from stored token on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      loadMe().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  async function loadMe() {
    try {
      const me = await authApi.me() as Record<string, unknown>;
      setUser(buildUser(me));
    } catch {
      clearToken();
      setUser(null);
    }
  }

  async function signIn(email: string, password: string) {
    const { token, user: raw } = await authApi.login(email, password);
    setToken(token);
    setUser(buildUser(raw as Record<string, unknown>));
  }

  async function staffSignIn(slug: string, pin: string) {
    const { token, user: raw } = await authApi.staffLogin(slug, pin);
    setToken(token);
    localStorage.setItem('kushina_staff_slug', slug);
    setUser(buildUser(raw as Record<string, unknown>));
  }

  async function register(data: Record<string, unknown>) {
    const { token, user: raw } = await authApi.register(data);
    setToken(token);
    setUser(buildUser(raw as Record<string, unknown>));
  }

  function signOut() {
    clearToken();
    setUser(null);
  }

  async function refreshUser() {
    await loadMe();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, staffSignIn, signOut, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ── Map raw API user object to AuthUser ───────────────────────
function buildUser(raw: Record<string, unknown>): AuthUser {
  const role = raw.role as UserRole;

  if (role === 'platform_admin') {
    return {
      id: raw.id as string,
      email: raw.email as string,
      name: raw.name as string,
      role,
    };
  }

  if (role === 'restaurant_owner') {
    return {
      id: raw.id as string,
      email: raw.email as string,
      name: raw.name as string,
      role,
      restaurantId: raw.id as string,         // owner id = restaurant id
      restaurantStatus: raw.status as string,
      hasSubscription: raw.has_subscription as boolean ?? false,
      restaurant: raw,
    };
  }

  // staff
  return {
    id: raw.id as string,
    email: raw.email as string,
    name: raw.name as string,
    role,
    staffRole: raw.staffRole as string,
    restaurantId: raw.restaurantId as string,
    restaurantStatus: raw.restaurantStatus as string,
    restaurantName: raw.restaurantName as string,
    restaurant: raw.restaurant as Record<string, unknown>,
  };
}
