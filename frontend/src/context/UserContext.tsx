import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { googleIdentityProvider, keycloak } from '../auth/keycloak';
import { getMyProfile } from '../api/userApi';

interface User {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface UserContextType {
  user: User | null;
  authReady: boolean;
  setUser: (user: User | null) => void;
  login: (google?: boolean) => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!keycloak?.authenticated || !keycloak.token) {
        setUser(null);
        return;
      }
      try {
        const accessToken = keycloak.token;
        localStorage.setItem('accessToken', accessToken);
        
        // Use Keycloak's token data directly
        const profile = keycloak.tokenParsed as any;
        if (profile?.email) {
          setUser({
            id: profile.sub,
            firstName: profile.given_name,
            lastName: profile.family_name,
            email: profile.email,
            phone: '',
            role: profile.realm_access?.roles?.includes('ADMIN') ? 'ADMIN' : 'USER',
          });
          try {
            const response = await getMyProfile(accessToken);
            setUser({
              id: profile.sub,
              firstName: response.data.firstName || profile.given_name,
              lastName: response.data.lastName || profile.family_name,
              email: response.data.email || profile.email,
              phone: response.data.phone || '',
              role: profile.realm_access?.roles?.includes('ADMIN') ? 'ADMIN' : 'USER',
            });
          } catch {
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
      }
    };
    fetchUser().finally(() => setAuthReady(true));

    const authClient = keycloak;
    if (!authClient) return;
    authClient.onTokenExpired = async () => {
      try {
        await authClient.updateToken(30);
        if (authClient.token) localStorage.setItem('accessToken', authClient.token);
      } catch {
        await authClient.logout({ redirectUri: window.location.origin + '/login' });
      }
    };
    authClient.onAuthLogout = () => {
      localStorage.removeItem('accessToken');
      setUser(null);
    };
  }, []);

  const login = async (google = false) => {
    if (!keycloak) return;
    await keycloak.login({
      redirectUri: window.location.origin + '/login',
      ...(google ? { idpHint: googleIdentityProvider } : {}),
    });
  };

  const register = async () => {
    if (!keycloak) return;
    await keycloak.register({
      redirectUri: window.location.origin + '/login',
    });
  };

  const logout = async () => {
    if (keycloak?.authenticated) {
      await keycloak.logout({ redirectUri: window.location.origin + '/login' });
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, authReady, setUser, login, register, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
