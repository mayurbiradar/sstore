import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { keycloak } from '../auth/keycloak';
import { useUser } from '../context/UserContext';

export default function ProtectedRoute({ children, requiredRole }: { children: React.ReactElement; requiredRole?: 'ADMIN' }) {
  const location = useLocation();
  const { user, authReady } = useUser();

  if (!authReady) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#f7f8fa] text-sm text-slate-500">Checking your session...</div>;
  if (!keycloak?.authenticated) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/" replace />;

  return children;
}
