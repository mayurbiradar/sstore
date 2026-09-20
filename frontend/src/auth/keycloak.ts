import Keycloak from 'keycloak-js';

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
const keycloakRealm = import.meta.env.VITE_KEYCLOAK_REALM;
const keycloakClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;
const usePkce = import.meta.env.VITE_KEYCLOAK_USE_PKCE !== 'false';
const keycloakFlow = usePkce ? 'standard' : 'implicit';

export const isKeycloakConfigured = Boolean(
  keycloakUrl && keycloakRealm && keycloakClientId,
);

export const keycloak = isKeycloakConfigured
  ? new Keycloak({
      url: keycloakUrl,
      realm: keycloakRealm,
      clientId: keycloakClientId,
    })
  : null;

if (keycloak && !usePkce) {
  const httpKeycloak = keycloak as Keycloak & {
    pkceMethod?: false;
    flow?: 'implicit';
  };
  httpKeycloak.pkceMethod = false;
  httpKeycloak.flow = 'implicit';
}

export const googleIdentityProvider =
  import.meta.env.VITE_KEYCLOAK_GOOGLE_IDP_HINT || 'google';

export async function initializeKeycloak() {
  if (!keycloak) return false;

  try {
    return await keycloak.init({
      onLoad: 'check-sso',
      checkLoginIframe: false,
      flow: keycloakFlow,
      pkceMethod: usePkce ? 'S256' : false,
    });
  } catch (error) {
    console.error('Keycloak initialization failed', error);
    return false;
  }
}
