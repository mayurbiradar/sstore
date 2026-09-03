import { Link } from 'react-router-dom'
import { SearchX, Home as HomeIcon, ArrowRight } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#f7f8fa] px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <SearchX className="h-12 w-12" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">Error 404</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          That page took a wrong turn.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-slate-500">
          The page may have moved, or the link may be outdated. Let us get you back to something good.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/collection"
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 font-bold text-white transition hover:bg-rose-700"
          >
            Browse products
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            <HomeIcon className="h-4 w-4" strokeWidth={2.25} />
            Go home
          </Link>
        </div>
      </div>
    </main>
  )
}
