import { Link } from 'react-router-dom'

export default function NotFound() {
  return <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#f7f8fa] px-4 text-center"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">404</p><h1 className="mt-3 text-4xl font-black text-slate-950">That page took a wrong turn.</h1><p className="mx-auto mt-3 max-w-md text-slate-500">The page may have moved, or the link may be outdated. Let us get you back to something good.</p><Link to="/collection" className="mt-7 inline-block rounded-xl bg-rose-600 px-6 py-3 font-bold text-white transition hover:bg-rose-700">Browse products</Link></div></main>
}
