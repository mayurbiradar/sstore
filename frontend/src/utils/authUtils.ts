import { keycloak } from '../auth/keycloak';

export const ACCESS_TOKEN_KEY = 'accessToken';

export interface KeycloakTokenClaims {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles?: string[];
  };
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token?: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getRealmRoles(tokenParsed: unknown): string[] {
  if (!tokenParsed || typeof tokenParsed !== 'object') return [];
  const claims = tokenParsed as Partial<KeycloakTokenClaims>;
  const roles = claims.realm_access?.roles;
  return Array.isArray(roles) ? roles : [];
}

export async function checkAdminAndProceed(callback: () => void, redirect: (path: string) => void) {
  if (!keycloak?.authenticated) {
    redirect('/');
    return;
  }

  try {
    const realmRoles = getRealmRoles(keycloak.tokenParsed);

    if (realmRoles.includes('ADMIN')) {
      callback();
    } else {
      redirect('/');
    }
  } catch (error) {
    console.error('Failed to check admin role:', error);
    redirect('/');
  }
}
