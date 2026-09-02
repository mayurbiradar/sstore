import { keycloak } from '../auth/keycloak';

export async function checkAdminAndProceed(callback: () => void, redirect: (path: string) => void) {
  if (!keycloak?.authenticated) {
    redirect('/');
    return;
  }
  
  try {
    // Parse the token to get roles
    const decodedToken = keycloak.tokenParsed as any;
    const realmRoles = decodedToken?.realm_access?.roles || [];
    
    // Check if user has admin role
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
