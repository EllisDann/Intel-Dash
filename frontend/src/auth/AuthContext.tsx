import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

interface User { id: string; email: string; role: string; name?: string; profileImage?: string | null; }
interface Tenant { id: string; name: string; trialStartDate: string | null; trialEndDate: string | null; isTrialActive: boolean; paymentStatus: string; }

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  tenant: Tenant | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  updateProfile: (payload: { email?: string; tenant_name?: string; profile_image?: string | null; name?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_STORAGE_TOKEN_KEY = 'intel_dash_token';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/api/user/profile');
      setUser({
        id: response.data.id,
        email: response.data.email,
        role: response.data.role,
        name: response.data.name || undefined,
        profileImage: response.data.profileImage || null,
      });
      setTenant(response.data.tenant);
    } catch (error) {
      localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
      setToken(null);
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const authToken = response.data.token;
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, authToken);
    setToken(authToken);
    setUser(response.data.user);
    setTenant(response.data.tenant);
  };

  const register = async (email: string, password: string) => {
    const response = await api.post('/auth/register', {
      email,
      password,
    });
    const authToken = response.data.token;
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, authToken);
    setToken(authToken);
    setUser(response.data.user);
    setTenant(response.data.tenant);
  };

  const updateProfile = async (payload: { email?: string; tenant_name?: string; profile_image?: string | null; name?: string }) => {
    const response = await api.put('/api/user/profile', payload);
    setUser(response.data.user);
    setTenant(response.data.tenant);
  };

  const logout = () => {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  const value = useMemo(
    () => ({
      isAuthenticated: !!user,
      loading,
      user,
      tenant,
      login,
      register,
      updateProfile,
      logout,
    }),
    [loading, user, tenant]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
