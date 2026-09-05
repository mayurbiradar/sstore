import { useEffect, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { API_BASE_URL } from '../constants'
import { STORE } from '../constants/store'
import { useCart } from '../context/CartContext'
import { getOrderById, type Order } from '../api/orderApi'

const formatPrice = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function OrderSuccess() {
  const location = useLocation()
  const navigate = useNavigate()
  const { clearCart } = useCart()
  const initialOrder = location.state?.order || null
  const [order, setOrder] = useState<Order | null>(initialOrder as Order | null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) navigate('/login')
    const params = new URLSearchParams(location.search)
    const orderIdFromQuery = params.get('order_id')
    const razorpayPaymentId = params.get('razorpay_payment_id')
    if (orderIdFromQuery && !initialOrder) {
      setPaymentLoading(true)
      getOrderById(orderIdFromQuery, localStorage.getItem('accessToken') || undefined)
        .then(loaded => { setOrder(loaded); clearCart() })
        .catch(() => setOrder(null))
        .finally(() => setPaymentLoading(false))
    }
    void razorpayPaymentId
  }, [navigate, location.search, initialOrder, clearCart])

  const orderId = order?.id || location.state?.orderId || new URLSearchParams(location.search).get('order_id') || 'ORD-UNKNOWN'
  const paidOnline = new URLSearchParams(location.search).has('razorpay_payment_id')

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-4" aria-label="Checkout progress">
          <div className="border-t-2 border-emerald-500 pt-3 text-xs font-bold text-emerald-600 sm:text-sm"><span className="mr-1.5">01</span>Delivery details</div>
          <div className="border-t-2 border-emerald-500 pt-3 text-xs font-bold text-emerald-600 sm:text-sm"><span className="mr-1.5">02</span>Payment</div>
          <div className="border-t-2 border-rose-600 pt-3 text-xs font-bold text-rose-600 sm:text-sm"><span className="mr-1.5">03</span>Confirmation</div>
        </div>
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-8 w-8" strokeWidth={3} />
          </div>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-rose-600">Thank you for shopping with us</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{paymentLoading ? 'Confirming payment...' : order ? 'Order confirmed' : 'Payment could not be confirmed'}</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">{paymentLoading ? 'Please wait while we verify your Razorpay payment.' : order ? 'Your order is safely on its way to our team. We’ll keep you updated as it moves through delivery.' : 'Please contact support before trying to place this order again.'}</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div><p className="text-sm text-slate-500">Order number</p><p className="mt-1 text-xl font-black text-slate-950">{orderId}</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">{order?.status || 'Confirmed'}</span>
          </div>
          <div className="grid gap-4 border-b border-slate-200 py-5 sm:grid-cols-3">
            <Detail label="Placed on" value={order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'Just now'} />
            <Detail label="Payment" value={paidOnline ? 'Paid securely with Razorpay' : 'Cash on delivery'} />
            <Detail label="Delivery" value="3-5 business days" />
          </div>

          {order && order.items && order.items.length > 0 && <div className="border-b border-slate-200 py-5">
            <h2 className="text-lg font-black text-slate-950">Items in your order</h2>
            <div className="mt-4 space-y-4">
              {order.items.map(item => <div key={item.id || item.productId} className="flex items-center gap-3"><div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">{item.image && <img src={item.image.startsWith('/images/') ? `${API_BASE_URL}${item.image}` : item.image} alt={item.productName} className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.productName}</p><p className="mt-1 text-sm text-slate-500">Qty {item.quantity}</p></div><p className="text-sm font-bold text-slate-900">{formatPrice(item.subtotal)}</p></div>)}
            </div>
          </div>}
          <div className="flex items-center justify-between pt-5"><span className="text-lg font-black text-slate-950">{paidOnline ? 'Total paid' : 'Total paid on delivery'}</span><span className="text-2xl font-black text-rose-600">{order ? formatPrice(order.totalAmount) : '₹0'}</span></div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-black text-slate-950">What happens next?</h2>
          <div className="mt-4 grid gap-4 text-sm text-slate-500 sm:grid-cols-3">
            <Detail label="01 · Confirmed" value="Your order has been received." />
            <Detail
              label="02 · Packed"
              value="We’ll pack your items with care."
            />
            <Detail
              label="03 · Delivered"
              value={paidOnline ? 'Your order is on its way to you.' : 'Pay cash when your order arrives.'}
            />
          </div>
        </section>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/orders" className="rounded-xl bg-rose-600 px-6 py-3 text-center text-sm font-black text-white transition hover:bg-rose-700">View my orders</Link><Link to="/collection" className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center text-sm font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600">Continue shopping</Link></div>
        <p className="mt-6 text-center text-xs text-slate-400">Need help? {STORE.email} · {STORE.phone}</p>
      </div>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-700">{value}</p></div>
}
