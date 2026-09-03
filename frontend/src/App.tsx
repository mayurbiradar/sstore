import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { CartProvider } from './context/CartContext'
import { UserProvider } from './context/UserContext'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Collection from './pages/Collection'
import About from './pages/info/About';
import Contact from './pages/info/Contact';
import Login from './pages/account/Login'
import Cart from './pages/Cart'
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

function App() {
  return (
    <>
      <CartProvider>
        <UserProvider>
          <Router>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-grow">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/collection" element={<Collection />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/cart" element={<Cart />} />
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
          </Router>
        </UserProvider>
      </CartProvider>
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
