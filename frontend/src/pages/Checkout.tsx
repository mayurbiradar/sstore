import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import type { CartItem } from '../context/CartContext'
import { API_BASE_URL } from "../constants";
import { useUser } from '../context/UserContext';
import { createStripeSession } from '../api/orderApi';

export default function Checkout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cart, clearCart, addOrder } = useCart()
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'stripe'>('cod');
  const orderCompleted = useRef(false);

  // Get selected items from navigation state, fallback to all cart items
  const selectedItems = location.state?.selectedItems || cart;

  useEffect(() => {
    if ((!cart || cart.length === 0) && !orderCompleted.current) {
      navigate('/collection');
    }
  }, [cart, navigate]);

  useEffect(() => {
    fetchAddresses();
  }, [user?.id]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  })

  interface Address {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  }

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutStep === 1) {
      if (isFormValid) setCheckoutStep(2);
      return;
    }
    setLoading(true);

    try {
      // Build order payload matching backend
      const userId = user?.id || '';
      const subtotal = selectedItems.reduce((total: number, item: CartItem) => total + (item.price * item.quantity), 0);
      const shipping = 0; // Always free shipping
      const tax = Math.round((subtotal + shipping) * 0.03); // GST 3%
      const totalAmount = subtotal + shipping + tax;
      const orderItems = selectedItems.map((item: CartItem) => ({
        productId: item.id,
        sku: `SKU-${Math.random().toString(36).substring(2, 10)}`,
        productName: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        image: item.image && item.image.startsWith('http')
          ? item.image.replace(API_BASE_URL, '')
          : item.image || ''
      }));
      const selectedAddr = selectedAddressId && selectedAddressId !== 'new' ? addresses.find(addr => addr.id === selectedAddressId) : null;
      const addressPayload = selectedAddr ? {
        ...selectedAddr,
        userId,
        isDeleted: false
      } : {
        ...formData,
        userId,
        isDeleted: false
      };
      const orderPayload = {
        userId,
        status: 'CREATED',
        totalAmount,
        currency: 'INR',
        items: orderItems,
        subtotal,
        shipping,
        tax,
        address: addressPayload
      };

      if (paymentMethod === 'stripe') {
        const response = await createStripeSession(orderPayload, localStorage.getItem('accessToken') || undefined);
        if (!response.data?.url) throw new Error('Stripe session was not created');
        window.location.assign(response.data.url);
        return;
      }

      const orderResponse = await addOrder(orderPayload);
      if (!orderResponse) throw new Error('Order was not created');
      orderCompleted.current = true;
      clearCart();
      navigate('/order-success', { state: { order: orderResponse } });
    } catch (error) {
      console.error('Order submission error:', error);
    } finally {
      setLoading(false);
    }
  }

  const fetchAddresses = async () => {
    if (!user?.id) return;

    setLoadingAddresses(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/api/orders/users/${user.id}/addresses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setAddresses(data);
      if (data.length > 0) {
        handleAddressSelect(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleAddressSelect = (addressId: string | null) => {
    setSelectedAddressId(addressId);
    if (addressId === 'new') {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
      });
      return;
    }
    if (addressId) {
      const selectedAddress = addresses.find(addr => addr.id === addressId);
      if (selectedAddress) {
        setFormData({
          firstName: selectedAddress.firstName,
          lastName: selectedAddress.lastName,
          email: selectedAddress.email,
          phone: selectedAddress.phone,
          address: selectedAddress.address,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
        });
      }
    }
  };

  const subtotal = selectedItems.reduce((total: number, item: CartItem) => total + (item.price * item.quantity), 0);
  const shipping = 0; // Always free shipping
  const tax = Math.round((subtotal + shipping) * 0.03); // GST 3%
  const total = subtotal + shipping + tax;

  const isFormValid = (selectedAddressId && selectedAddressId !== 'new') || (formData.firstName && formData.lastName && formData.email &&
                     formData.phone && formData.address && formData.city &&
                     formData.state && formData.pincode);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <section className="mx-auto max-w-6xl border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">Almost yours</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Checkout
              </h1>
              <p className="mt-2 text-slate-500">
                Review your details and place your order securely.
              </p>
            </div>
            <button
              onClick={() => navigate('/cart')}
              className="text-sm font-bold text-rose-600 hover:text-rose-700"
            >
              ← Back to cart
            </button>
          </div>

              <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4">
                {['Delivery details', 'Payment', 'Confirmation'].map((step, index) => (
                  <div key={step} className={`border-t-2 pt-3 text-xs font-bold sm:text-sm ${index + 1 === checkoutStep ? 'border-rose-600 text-rose-600' : index + 1 < checkoutStep ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-400'}`}>
                    <span className="mr-1.5">0{index + 1}</span>{step}
                  </div>
                ))}
              </div>
        </div>
      </section>

      {/* Checkout Content */}
      <section className="mx-auto max-w-6xl py-8">
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_350px]">
            {/* Left: Form (2/3) */}
            <div>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Shipping Information */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="mb-6 text-xl font-black text-slate-950">
                    Delivery details
                  </h2>

                  {/* Address Selection */}
                  {user?.id && (
                    <div className="mb-6">
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Saved addresses</h3>
                      {loadingAddresses ? (
                        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading your addresses...</div>
                      ) : (
                        <div className="space-y-3">
                          {addresses.map((addr) => (
                            <label key={addr.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${selectedAddressId === addr.id ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 hover:border-rose-300'}`}>
                              <input
                                type="radio"
                                name="address"
                                value={addr.id}
                                checked={selectedAddressId === addr.id}
                                onChange={() => handleAddressSelect(addr.id)}
                                className="mr-3"
                              />
                              <span className="text-sm"><strong className="block text-slate-900">{addr.firstName} {addr.lastName}</strong><span className="mt-1 block leading-5 text-slate-500">{addr.address}, {addr.city}, {addr.state} - {addr.pincode}</span><span className="mt-1 block text-slate-500">{addr.phone} · {addr.email}</span></span>
                            </label>
                          ))}
                            <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-rose-300">
                            <input
                              type="radio"
                              name="address"
                              value="new"
                              checked={selectedAddressId === 'new' || selectedAddressId === null}
                              onChange={() => handleAddressSelect('new')}
                              className="mr-3"
                            />
                            <span><strong className="block text-sm text-slate-900">Use a new address</strong><span className="mt-1 block text-sm text-slate-500">Enter delivery details below</span></span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedAddressId === 'new' || selectedAddressId === null ? (
                  <>
                  {/* Personal Details */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Your details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          First Name *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          autoComplete="given-name"
                          placeholder="Enter your first name"
                          value={formData.firstName}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          autoComplete="family-name"
                          placeholder="Enter your last name"
                          value={formData.lastName}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Contact information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          name="email"
                          autoComplete="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          autoComplete="tel"
                          placeholder="+91 98765 43210"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Details */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Address</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          name="address"
                          autoComplete="street-address"
                          placeholder="123 Main Street, Apartment 4B"
                          value={formData.address}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">
                            City *
                          </label>
                          <input
                            type="text"
                            name="city"
                            autoComplete="address-level2"
                            placeholder="Mumbai"
                            value={formData.city}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">
                            State *
                          </label>
                          <input
                            type="text"
                            name="state"
                            autoComplete="address-level1"
                            placeholder="Maharashtra"
                            value={formData.state}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">
                            PIN Code *
                          </label>
                          <input
                            type="text"
                            name="pincode"
                            autoComplete="postal-code"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            placeholder="400001"
                            value={formData.pincode}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  </>
                  ) : null}
                </div>

                {/* Payment Method */}
                {checkoutStep === 2 && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="mb-6 text-xl font-black text-slate-950">
                    Payment method
                  </h2>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={`cursor-pointer rounded-xl border p-5 transition ${paymentMethod === 'cod' ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 hover:border-rose-300'}`}>
                      <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="sr-only" />
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold text-emerald-700"><span>₹</span></div>
                        <div><h3 className="text-lg font-bold text-slate-900">Cash on delivery</h3><p className="text-sm text-slate-600">Pay when you receive your order</p></div>
                      </div>
                      <p className="rounded-lg bg-white/70 p-4 text-sm text-slate-600"><strong className="text-slate-900">Safe & secure:</strong> No online payment required.</p>
                    </label>
                    <label className={`cursor-pointer rounded-xl border p-5 transition ${paymentMethod === 'stripe' ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 hover:border-rose-300'}`}>
                      <input type="radio" name="paymentMethod" value="stripe" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} className="sr-only" />
                      <div className="flex items-center gap-4 mb-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold text-indigo-700">▣</div><div><h3 className="text-lg font-bold text-slate-900">Card / UPI</h3><p className="text-sm text-slate-600">Secure payment powered by Stripe</p></div></div>
                      <p className="rounded-lg bg-white/70 p-4 text-sm text-slate-600">You’ll be redirected to Stripe to complete payment.</p>
                    </label>
                  </div>
                </div>}

                {/* Place Order Button */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  {checkoutStep === 2 && <button type="button" onClick={() => setCheckoutStep(1)} className="mb-4 text-sm font-bold text-slate-500 hover:text-rose-600">← Edit delivery details</button>}
                  <button
                    type="submit"
                    disabled={!isFormValid || loading}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-rose-600 py-4 text-lg font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkoutStep === 1 ? 'Continue to payment →' : loading ? (
                      <>
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing Order...
                      </>
                    ) : (
                      <>
                        {paymentMethod === 'stripe' ? 'Pay securely' : '🛒 Place Order'} - ₹{total.toLocaleString('en-IN')}
                      </>
                    )}
                  </button>

                  {checkoutStep === 1 && !isFormValid && (
                    <p className="text-red-600 text-sm mt-2 text-center">
                      Complete your delivery details to continue
                    </p>
                  )}
                </div>
              </form>
            </div>

            {/* Right: Order Summary (1/3) */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-6 text-xl font-black text-slate-950">
                  Order summary
                </h2>

                {/* Order Items */}
                <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                  {selectedItems.map((item: CartItem) => (
                    <div key={item.id} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <img
                          src={item.image?.startsWith('/images/') ? `${API_BASE_URL}${item.image}` : item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="line-clamp-2 text-sm font-bold text-slate-900">{item.name}</h4>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-slate-500">Qty: {item.quantity}</span>
                          <span className="text-sm font-bold text-slate-900">
                            ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal ({selectedItems.length} items)</span>
                    <span className="font-bold">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Shipping</span>
                    <span className="font-bold text-emerald-600">
                      Free
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">GST (3%)</span>
                    <span className="font-bold">₹{tax.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-black text-slate-950">Total</span>
                    <span className="text-2xl font-black text-rose-600">
                      ₹{total.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="mt-6 rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-rose-600">Delivery</span>
                    <span className="text-sm font-semibold text-slate-900">Estimated delivery</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    3-5 business days after order confirmation
                  </p>
                </div>

                {/* Security Badge */}
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    <span>🔒</span>
                    <span>SSL Secured Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </section>
    </main>
  )
}
