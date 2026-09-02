import { useEffect } from 'react'
import { useUser } from '../context/UserContext'
import { Navigate } from 'react-router-dom';
import { isKeycloakConfigured } from '../auth/keycloak'

export default function Login() {
  const { user, login, register } = useUser();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);
  const searchParams = new URLSearchParams(window.location.search);
  const redirect = searchParams.get('redirect');

  if (user && user.email) {
    if (redirect === 'checkout') return <Navigate to="/cart" replace />;
    if (redirect?.startsWith('/')) return <Navigate to={redirect} replace />;
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#f7f8fa] px-4 py-12">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[0.8fr_1.2fr]">
        <div className="hidden bg-slate-950 p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/70">SStore</p>
            <h1 className="mt-16 text-4xl font-black leading-tight">Shop what fits your life.</h1>
            <p className="mt-5 max-w-xs text-white/70">Save your details, follow your orders, and check out faster next time.</p>
          </div>
          <p className="text-sm text-white/60">Secure account access powered by Keycloak.</p>
        </div>
        <div className="p-7 sm:p-12">
          <div className="mb-9">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">SStore account</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-slate-500">Sign in to manage orders and continue shopping.</p>
          </div>

          {isKeycloakConfigured ? (
            <div className="space-y-3">
              <button type="button" onClick={() => login()} className="w-full rounded-xl bg-slate-950 px-4 py-3.5 font-bold text-white transition hover:bg-rose-600">
                Sign in
              </button>
              <button type="button" onClick={() => login(true)} className="w-full rounded-xl border border-slate-200 px-4 py-3.5 font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50">
                Continue with Google
              </button>
              <div className="flex items-center gap-3 py-4 text-xs uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
              <button type="button" onClick={() => register()} className="w-full rounded-xl border border-rose-200 px-4 py-3.5 font-semibold text-rose-700 transition hover:bg-rose-50">
                Create an account
              </button>
            </div>
          ) : (
            <p className="rounded-xl bg-red-50 p-4 text-center text-red-600">Keycloak is not configured. Add the VITE_KEYCLOAK_* environment variables to continue.</p>
          )}

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Your account is managed securely by Keycloak. We never store your password.</p>
        </div>
      </div>
    </div>
  );
}
