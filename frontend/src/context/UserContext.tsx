import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { googleIdentityProvider, keycloak } from '../auth/keycloak';
import { getMyProfile } from '../api/userApi';
import type { KeycloakUser } from '../api/userApi';

interface User {
  /** Keycloak user id (UUID string). */
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

interface JwtClaims {
  sub: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  realm_access?: { roles?: string[] };
}

function fromKeycloak(
  profile: KeycloakUser | undefined,
  token: JwtClaims | null | undefined,
): User | null {
  if (!profile?.email && !token?.email) return null;
  const isAdmin = profile?.role === 'ADMIN' || Boolean(token?.realm_access?.roles?.includes('ADMIN'));
  return {
    id: profile?.id ?? token?.sub,
    firstName: profile?.firstName ?? token?.given_name,
    lastName: profile?.lastName ?? token?.family_name,
    email: profile?.email ?? token?.email,
    phone: profile?.phone ?? '',
    role: isAdmin ? 'ADMIN' : 'USER',
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!keycloak?.authenticated || !keycloak.token) {
        setUser(null);
        setAuthReady(true);
        return;
      }
      const accessToken = keycloak.token;
      localStorage.setItem('accessToken', accessToken);
      const tokenParsed = keycloak.tokenParsed as JwtClaims | undefined;
      // Seed from the JWT so the UI has values immediately.
      setUser(fromKeycloak(undefined, tokenParsed));
      try {
        const response = await getMyProfile(accessToken);
        const merged = fromKeycloak(response, tokenParsed);
        if (merged) setUser(merged);
      } catch {
        // Best-effort: we already populated from the JWT.
      } finally {
        setAuthReady(true);
      }
    };
    fetchUser();

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
