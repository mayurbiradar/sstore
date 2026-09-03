import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, User as UserIcon, Menu, X, LayoutDashboard, Search, Heart } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import { useUser } from '../../context/UserContext'
import UserMenu from '../auth/UserMenu'

const links = [
  { label: 'Home', to: '/' },
  { label: 'Shop all', to: '/collection' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export default function Header() {
  const { cart } = useCart()
  const { count: wishlistCount } = useWishlist()
  const { user } = useUser()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isLoggedIn = Boolean(user?.email)
  const isAdmin = user?.role === 'ADMIN'

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = searchQuery.trim()
    navigate(trimmed ? `/collection?q=${encodeURIComponent(trimmed)}` : '/collection')
    setIsMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 text-slate-900 shadow-sm backdrop-blur">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
            S<span className="text-rose-600">Store</span>
          </Link>
          <form role="search" onSubmit={submitSearch} className="hidden flex-1 max-w-md md:block">
            <label htmlFor="header-search" className="sr-only">Search products</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <input
                id="header-search"
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search products, materials, categories…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100"
              />
            </div>
          </form>
          <div className="hidden items-center gap-6 md:flex">
            {links.map(link => <Link key={link.to} to={link.to} className="text-sm font-semibold transition hover:text-rose-600">{link.label}</Link>)}
            {isLoggedIn && <Link to="/orders" className="text-sm font-semibold transition hover:text-rose-600">My orders</Link>}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/wishlist" className="relative rounded-lg p-2 text-slate-700 transition hover:bg-rose-50 hover:text-rose-600" title="Wishlist">
              <Heart className="h-5 w-5" strokeWidth={2} />
              {wishlistCount > 0 && <span key={wishlistCount} className="absolute -right-1 -top-1 flex h-4 min-w-4 animate-[badgePop_220ms_ease-out] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm">{wishlistCount}</span>}
            </Link>
            <Link to="/cart" className="relative rounded-lg p-2 text-slate-700 transition hover:bg-rose-50 hover:text-rose-600" title="Shopping cart">
              <ShoppingCart className="h-5 w-5" strokeWidth={2} />
              {cart.length > 0 && <span key={cart.length} className="absolute -right-1 -top-1 flex h-4 min-w-4 animate-[badgePop_220ms_ease-out] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm">{cart.length}</span>}
            </Link>
            {isLoggedIn ? <>
              <Link to="/my-account" className="hidden rounded-lg p-2 text-slate-700 transition hover:bg-rose-50 hover:text-rose-600 sm:block" title="My account">
                <UserIcon className="h-5 w-5" strokeWidth={2} />
              </Link>
              {isAdmin && <Link to="/admin" className="hidden items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 sm:flex" title="Open admin workspace">
                <LayoutDashboard className="h-4 w-4" strokeWidth={2.5} />
                <span>Admin workspace</span>
              </Link>}
              <div className="hidden sm:block"><UserMenu /></div>
            </> : <Link to="/login" className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:border-rose-300 hover:bg-rose-50 sm:block">Sign in</Link>}
            <button type="button" onClick={() => setIsMenuOpen(open => !open)} className="ml-1 rounded-lg p-2 text-slate-700 transition hover:bg-rose-50 hover:text-rose-600 sm:hidden" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen} aria-controls="mobile-navigation">
              {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.5} /> : <Menu className="h-5 w-5" strokeWidth={2.5} />}
            </button>
          </div>
        </div>
        {isMenuOpen && <div id="mobile-navigation" className="absolute left-0 right-0 top-16 space-y-1 border-b border-slate-200 bg-white p-4 shadow-lg sm:hidden">
          <form role="search" onSubmit={submitSearch} className="mb-2">
            <label htmlFor="header-search-mobile" className="sr-only">Search products</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <input
                id="header-search-mobile"
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search products…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100"
              />
            </div>
          </form>
          {links.map(link => <Link key={link.to} to={link.to} onClick={() => setIsMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-rose-50">{link.label}</Link>)}
          {isLoggedIn && <>
            <Link to="/wishlist" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold hover:bg-rose-50">
              <span>Wishlist</span>
              {wishlistCount > 0 && <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">{wishlistCount}</span>}
            </Link>
            <Link to="/orders" onClick={() => setIsMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-rose-50">My orders</Link>
            <Link to="/my-account" onClick={() => setIsMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-rose-50">My account</Link>
            {isAdmin && <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100">
              <LayoutDashboard className="h-4 w-4" strokeWidth={2.5} />
              <span>Admin workspace</span>
            </Link>}
            <div className="border-t border-slate-200 pt-2"><UserMenu /></div>
          </>}
          {!isLoggedIn && <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Sign in or register</Link>}
        </div>}
      </nav>
    </header>
  )
}