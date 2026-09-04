import { Link } from 'react-router-dom'
import { CreditCard, MessageCircle } from 'lucide-react'
import { STORE } from '../../constants/store'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <Link to="/" className="text-xl font-black text-slate-950">
            {STORE.name.split('').map((ch: string, i: number) =>
              i === 0 ? <span key={i} className="text-rose-600">{ch}</span> : ch
            )}
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-6">
            {STORE.tagline}
          </p>
          {STORE.instagram && (
            <a
              href={STORE.instagram}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
              aria-label={`Follow ${STORE.name} on Instagram`}
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              Follow us
            </a>
          )}
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Shop</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <Link to="/collection" className="hover:text-rose-600">All products</Link>
            <Link to="/about" className="hover:text-rose-600">About {STORE.name}</Link>
            <Link to="/contact" className="hover:text-rose-600">Contact us</Link>
          </div>
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Customer care</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <Link to="/faq" className="hover:text-rose-600">FAQs</Link>
            <Link to="/shippingpolicy" className="hover:text-rose-600">Shipping & returns</Link>
            <Link to="/privacypolicy" className="hover:text-rose-600">Privacy</Link>
            <Link to="/termsconditions" className="hover:text-rose-600">Terms</Link>
          </div>
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Need help?</h2>
          <p className="mt-3 text-sm leading-6">{STORE.hours}</p>
          <a href={`mailto:${STORE.email}`} className="mt-3 inline-block text-sm font-semibold text-rose-600 hover:text-rose-700">
            {STORE.email}
          </a>
          <a href={`tel:${STORE.phone.replace(/\s/g, '')}`} className="mt-1 block text-sm font-semibold text-rose-600 hover:text-rose-700">
            {STORE.phone}
          </a>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CreditCard className="h-4 w-4" strokeWidth={2} />
            <span>{STORE.paymentsAccepted.join(' · ')}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} {STORE.name}. All rights reserved.</span>
          <span>Made with care in India.</span>
        </div>
      </div>
    </footer>
  )
}