import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyOrders } from '../api/orderApi'
import { API_BASE_URL } from '../constants'

type OrderItem = {
  id?: string
  productId?: string
  productName: string
  image?: string
  quantity: number
  subtotal: number
}

type Order = {
  id: string
  status: string
  totalAmount: number
  items: OrderItem[]
  createdAt?: string
}

function imageUrl(image?: string) {
  if (!image) return null
  if (image.startsWith('http')) return image
  return image.startsWith('/') ? `${API_BASE_URL}${image}` : `${API_BASE_URL}/${image}`
}

function statusStyle(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('cancel')) return 'bg-red-50 text-red-700'
  if (normalized.includes('deliver')) return 'bg-emerald-50 text-emerald-700'
  if (normalized.includes('ship')) return 'bg-blue-50 text-blue-700'
  return 'bg-amber-50 text-amber-700'
}

function statusStep(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('cancel')) return -1
  if (normalized.includes('deliver')) return 3
  if (normalized.includes('ship')) return 2
  if (normalized.includes('pack')) return 1
  return 0
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [orderPage, setOrderPage] = useState(1)
  const ordersPerPage = 10

  const loadOrders = () => {
    setOrderPage(1)
    setLoading(true)
    setError(false)
    getMyOrders(localStorage.getItem('accessToken') || undefined)
      .then(response => setOrders(response.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadOrders() }, [])

  const statuses = ['All', ...Array.from(new Set(orders.map(order => order.status || 'Processing')))]
  const sortedOrders = [...orders].sort((first, second) => {
    if (!first.createdAt) return 1
    if (!second.createdAt) return -1
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  })
  const filteredOrders = sortedOrders.filter(order => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || order.id.toLowerCase().includes(query) || order.items?.some(item => item.productName.toLowerCase().includes(query))
    const matchesStatus = statusFilter === 'All' || (order.status || 'Processing') === statusFilter
    return matchesSearch && matchesStatus
  })
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage))
  const visibleOrders = filteredOrders.slice((orderPage - 1) * ordersPerPage, orderPage * ordersPerPage)
  const activeOrders = orders.filter(order => !['delivered', 'cancelled'].includes((order.status || '').toLowerCase())).length
  const totalSpend = orders.reduce((total, order) => total + (order.totalAmount || 0), 0)

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">Your purchases</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">My orders</h1><p className="mt-2 text-slate-500">Track your purchases and revisit the details of every order.</p></div>
          <Link to="/collection" className="text-sm font-bold text-rose-600 hover:text-rose-700">Continue shopping →</Link>
        </header>

        {!loading && !error && orders.length > 0 && <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Summary label="Total orders" value={orders.length.toString()} />
            <Summary label="In progress" value={activeOrders.toString()} />
            <Summary label="Total spent" value={`₹${totalSpend.toLocaleString('en-IN')}`} />
          </div>
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative min-w-0 flex-1"><span className="sr-only">Search orders</span><input value={search} onChange={event => { setSearch(event.target.value); setOrderPage(1) }} placeholder="Search by order number or product" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100" /></label>
              <label><span className="sr-only">Filter orders by status</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setOrderPage(1) }} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 sm:w-44">{statuses.map(status => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select></label>
            </div>
          </div>
        </>}

        {loading && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm" role="status">Loading your orders...</div>}
        {!loading && error && <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center shadow-sm"><p className="font-bold text-red-800">We couldn’t load your orders.</p><p className="mt-2 text-sm text-red-700">Check your connection and try again.</p><button type="button" onClick={loadOrders} className="mt-5 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800">Try again</button></div>}
        {!loading && !error && orders.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-2xl">♡</div><h2 className="mt-5 text-xl font-black text-slate-950">No orders yet</h2><p className="mt-2 text-sm text-slate-500">Your next great find is waiting in the collection.</p><Link to="/collection" className="mt-5 inline-block rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-700">Start shopping</Link></div>}
        {!loading && !error && orders.length > 0 && filteredOrders.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><h2 className="font-black text-slate-950">No matching orders</h2><p className="mt-2 text-sm text-slate-500">Try another order number, product name, or status.</p><button type="button" onClick={() => { setSearch(''); setStatusFilter('All') }} className="mt-4 text-sm font-bold text-rose-600 hover:text-rose-700">Clear filters</button></div>}
        {!loading && !error && filteredOrders.length > 0 && <>
          <div className="space-y-4">{visibleOrders.map(order => <OrderCard key={order.id} order={order} />)}</div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-slate-500">Showing {Math.min((orderPage - 1) * ordersPerPage + 1, filteredOrders.length)}-{Math.min(orderPage * ordersPerPage, filteredOrders.length)} of {filteredOrders.length} orders</p>
            <div className="flex items-center gap-2"><button type="button" disabled={orderPage === 1} onClick={() => setOrderPage(page => page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="px-2 font-bold text-slate-700">Page {orderPage} of {totalOrderPages}</span><button type="button" disabled={orderPage === totalOrderPages} onClick={() => setOrderPage(page => page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div>
          </div>
        </>}
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div>
}

function OrderCard({ order }: { order: Order }) {
  const itemCount = order.items?.reduce((total, item) => total + (item.quantity || 0), 0) || 0
  const currentStep = statusStep(order.status || 'processing')
  const steps = ['Order placed', 'Packed', 'Shipped', 'Delivered']
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
      <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Order placed</p><p className="mt-1 text-sm font-black text-slate-950">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Date unavailable'}</p></div>
      <div className="flex items-center gap-5 text-sm"><div><p className="text-xs text-slate-400">Order ID</p><p className="mt-1 max-w-36 truncate font-bold text-slate-700">#{order.id}</p></div><div><p className="text-xs text-slate-400">Total</p><p className="mt-1 font-black text-slate-950">₹{(order.totalAmount || 0).toLocaleString('en-IN')}</p></div></div>
    </div>
    <div className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${currentStep === -1 ? 'bg-red-500' : 'bg-emerald-500'}`} /><p className="font-black capitalize text-slate-950">{(order.status || 'processing').toLowerCase()}</p><span className="text-sm text-slate-500">· {itemCount} item{itemCount === 1 ? '' : 's'}</span></div><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyle(order.status || 'processing')}`}>{(order.status || 'processing').toLowerCase()}</span></div>
      {currentStep >= 0 && <div className="mt-6 grid grid-cols-4 gap-1">{steps.map((step, index) => <div key={step} className="relative text-center"><div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${index <= currentStep ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{index < currentStep ? '✓' : index + 1}</div><p className={`mt-2 text-[11px] font-semibold sm:text-xs ${index <= currentStep ? 'text-slate-700' : 'text-slate-400'}`}>{step}</p>{index < steps.length - 1 && <span className={`absolute left-1/2 top-3.5 -z-0 h-0.5 w-full ${index < currentStep ? 'bg-rose-600' : 'bg-slate-200'}`} />}</div>)}</div>}
      {currentStep === -1 && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">This order has been cancelled.</p>}
      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {order.items?.map(item => <div key={item.id || item.productId} className="flex items-center gap-4 py-4 last:pb-0"><div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">{imageUrl(item.image) ? <img src={imageUrl(item.image) || undefined} alt={item.productName} className="h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none' }} /> : <span className="text-center text-[11px] font-bold text-slate-400">No image</span>}</div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold text-slate-900 sm:text-base">{item.productName}</p><p className="mt-1 text-sm text-slate-500">Quantity: {item.quantity}</p></div><p className="text-sm font-black text-slate-950">₹{(item.subtotal || 0).toLocaleString('en-IN')}</p></div>)}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-400">Cash on delivery · Free shipping</p><Link to="/collection" className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600">Buy again</Link></div>
    </div>
  </article>
}
