import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ArrowUp, WifiOff } from 'lucide-react'
import { CartProvider } from './context/CartContext'
import { UserProvider } from './context/UserContext'
import { WishlistProvider } from './context/WishlistContext'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Collection from './pages/Collection'
import About from './pages/info/About';
import Contact from './pages/info/Contact';
import Login from './pages/account/Login'
import Cart from './pages/Cart'
import Wishlist from './pages/Wishlist'
import Checkout from './pages/Checkout'
import OrderSuccess from './pages/OrderSuccess'
import MyAccount from './pages/account/MyAccount'
import Orders from './pages/account/Orders'
import AdminDashboard from './pages/admin/AdminDashboard'
import ProductDetail from './pages/ProductDetail'
import FAQ from './pages/info/FAQ';
import PrivacyPolicy from './pages/info/PrivacyPolicy';
import TermsConditions from './pages/info/TermsConditions';
import ShippingPolicy from './pages/info/ShippingPolicy';
import NotFound from './pages/info/NotFound';
import ProtectedRoute from './components/auth/ProtectedRoute';
import './App.css'

/** Resets window scroll on every route change. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

/** Floating back-to-top button. */
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 600)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
      className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-900/20 transition-all duration-300 hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-200 ${
        visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
    </button>
  )
}

/** Top-of-page banner shown when the browser is offline. */
function OfflineIndicator() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800"
    >
      <WifiOff className="h-4 w-4" strokeWidth={2.25} />
      You are offline. Some actions may not work until your connection is back.
    </div>
  )
}

function App() {
  return (
    <>
      <Router>
        <CartProvider>
          <UserProvider>
            <WishlistProvider>
              <ScrollToTop />
              <OfflineIndicator />
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[70] focus:rounded-lg focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
              >
                Skip to main content
              </a>
              <div className="flex flex-col min-h-screen">
                <Header />
                <main id="main-content" className="flex-grow">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/collection" element={<Collection />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                  <Route path="/order-success" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
                    <Route path="/my-account" element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/product/:productId" element={<ProtectedRoute requiredRole="ADMIN"><ProductDetail /></ProtectedRoute>} />
                    <Route path="/product/:productId" element={<ProductDetail />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                    <Route path="/termsconditions" element={<TermsConditions />} />
                    <Route path="/shippingpolicy" element={<ShippingPolicy />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
                </main>
                <Footer />
              </div>
              <ScrollToTopButton />
            </WishlistProvider>
          </UserProvider>
        </CartProvider>
      </Router>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: 'border border-slate-200 shadow-lg',
            title: 'font-bold text-slate-950',
            description: 'text-slate-500',
            actionButton: 'bg-rose-600 text-white',
          },
        }}
      />
    </>
  )
}

export default App
