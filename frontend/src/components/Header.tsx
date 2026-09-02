import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useUser } from '../context/UserContext'
import UserMenu from './UserMenu'

const links = [
  { label: 'Home', to: '/' },
  { label: 'Shop all', to: '/collection' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export default function Header() {
  const { cart } = useCart()
  const { user } = useUser()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isLoggedIn = Boolean(user?.email)
  const isAdmin = user?.role === 'ADMIN'

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 text-slate-900 shadow-sm backdrop-blur">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
            S<span className="text-rose-600">Store</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            {links.map(link => <Link key={link.to} to={link.to} className="text-sm font-semibold transition hover:text-rose-600">{link.label}</Link>)}
            {isLoggedIn && <Link to="/orders" className="text-sm font-semibold transition hover:text-rose-600">My orders</Link>}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/cart" className="relative rounded-lg px-2 py-2 text-lg transition hover:bg-rose-50" title="Shopping cart">
              🛒
              {cart.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">{cart.length}</span>}
            </Link>
            {isLoggedIn ? <>
              <Link to="/my-account" className="hidden rounded-lg px-2 py-2 text-lg transition hover:bg-rose-50 sm:block" title="My account">👤</Link>
              {isAdmin && <Link to="/admin" className="hidden items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 sm:flex" title="Open admin workspace"><span aria-hidden="true">◆</span><span>Admin workspace</span></Link>}
              <div className="hidden sm:block"><UserMenu /></div>
            </> : <Link to="/login" className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:border-rose-300 hover:bg-rose-50 sm:block">Sign in</Link>}
            <button type="button" onClick={() => setIsMenuOpen(open => !open)} className="ml-1 rounded-lg px-2 py-1 text-2xl sm:hidden" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen} aria-controls="mobile-navigation">{isMenuOpen ? '×' : '☰'}</button>
          </div>
        </div>
        {isMenuOpen && <div id="mobile-navigation" className="absolute left-0 right-0 top-16 space-y-1 border-b border-slate-200 bg-white p-4 shadow-lg sm:hidden">
          {links.map(link => <Link key={link.to} to={link.to} onClick={() => setIsMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-rose-50">{link.label}</Link>)}
          {isLoggedIn && <>
            <Link to="/orders" onClick={() => setIsMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-rose-50">My orders</Link>
            <Link to="/my-account" onClick={() => setIsMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-rose-50">My account</Link>
            {isAdmin && <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100"><span aria-hidden="true">◆</span>Admin workspace</Link>}
            <div className="border-t border-slate-200 pt-2"><UserMenu /></div>
          </>}
          {!isLoggedIn && <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Sign in or register</Link>}
        </div>}
      </nav>
    </header>
  )
}