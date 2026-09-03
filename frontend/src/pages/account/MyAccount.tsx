import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, ShoppingBag, Pencil } from 'lucide-react'
import { useUser } from '../../context/UserContext'
import { getMyOrders } from '../../api/orderApi'
import { updateMyProfile } from '../../api/userApi'
import { API_BASE_URL } from '../../constants'

type Tab = 'profile' | 'edit' | 'addresses' | 'orders'
type Address = { id: string; firstName: string; lastName: string; address: string; city: string; state: string; pincode: string; phone: string; email?: string }

export default function MyAccount() {
  const { user, setUser, logout } = useUser()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('profile')
  const [editData, setEditData] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [addresses, setAddresses] = useState<Address[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user) setEditData({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', phone: user.phone || '' }) }, [user])
  if (!user?.email) return <main className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-black">Sign in to view your account</h1><Link to="/login" className="mt-5 inline-block rounded-xl bg-rose-600 px-5 py-3 font-bold text-white">Sign in</Link></main>

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` || user.email[0].toUpperCase()
  const loadOrders = async () => { setBusy(true); try { const res = await getMyOrders(localStorage.getItem('accessToken') || undefined); setOrders(res.data || []) } finally { setBusy(false) } }
  const loadAddresses = async () => { if (!user.id) return; setBusy(true); try { const res = await fetch(`${API_BASE_URL}/api/orders/users/${user.id}/addresses`, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` } }); setAddresses(await res.json()) } finally { setBusy(false) } }
  const selectTab = (next: Tab) => { setTab(next); if (next === 'orders') void loadOrders(); if (next === 'addresses') void loadAddresses() }
  const saveProfile = async () => {
    setBusy(true)
    try {
      const response = await updateMyProfile(editData, localStorage.getItem('accessToken') || undefined)
      setUser({ ...user, ...response.data })
      setTab('profile')
    } catch {
      alert('Failed to update profile')
    } finally {
      setBusy(false)
    }
  }
  const signOut = async () => { await logout(); navigate('/login') }

  return <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-10 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><div className="mb-8"><p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">Your space</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">My account</h1><p className="mt-2 text-slate-500">Manage your details, addresses, and orders in one place.</p></div><div className="grid gap-6 lg:grid-cols-[240px_1fr]"><aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-200 px-2 pb-5"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 font-black text-rose-700">{initials}</div><div className="min-w-0"><p className="truncate font-bold text-slate-900">{user.firstName || 'Welcome'}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div></div><nav className="mt-4 grid gap-1">{([['profile', 'Overview'], ['edit', 'Personal details'], ['addresses', 'Addresses'], ['orders', 'My orders']] as [Tab, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => selectTab(value)} className={`rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${tab === value ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}<button type="button" onClick={signOut} className="mt-3 border-t border-slate-200 px-3 pt-4 text-left text-sm font-semibold text-slate-500 hover:text-rose-600">Sign out</button></nav></aside><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{tab === 'profile' && <Overview user={user} onEdit={() => selectTab('edit')} />} {tab === 'edit' && <EditProfile data={editData} setData={setEditData} save={saveProfile} busy={busy} cancel={() => selectTab('profile')} />} {tab === 'addresses' && <Addresses addresses={addresses} busy={busy} />} {tab === 'orders' && <Orders orders={orders} busy={busy} />}</section></div></div></main>
}

function Overview({ user, onEdit }: { user: any; onEdit: () => void }) {
  return <div>
    <SectionHeading title={`Hello, ${user.firstName || 'there'}`} description="Manage your account and keep track of your SStore activity." />
    <div className="mb-8 grid gap-3 sm:grid-cols-3">
      <Link to="/orders" className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50">
        <Package className="h-6 w-6 text-rose-600" strokeWidth={2} />
        <span className="mt-2 block font-bold text-slate-900">My orders</span>
        <span className="text-xs text-slate-500">Track purchases</span>
      </Link>
      <Link to="/collection" className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50">
        <ShoppingBag className="h-6 w-6 text-rose-600" strokeWidth={2} />
        <span className="mt-2 block font-bold text-slate-900">Shop products</span>
        <span className="text-xs text-slate-500">Find something new</span>
      </Link>
      <button type="button" onClick={onEdit} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50">
        <Pencil className="h-6 w-6 text-rose-600" strokeWidth={2} />
        <span className="mt-2 block font-bold text-slate-900">Edit details</span>
        <span className="text-xs text-slate-500">Update your profile</span>
      </button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2"><Info label="Name" value={`${user.firstName || ''} ${user.lastName || ''}`} /><Info label="Email" value={user.email} /><Info label="Phone" value={user.phone || 'Not added'} /><Info label="Status" value="Active" /></div>
  </div>
}
function EditProfile({ data, setData, save, busy, cancel }: { data: any; setData: (data: any) => void; save: () => void; busy: boolean; cancel: () => void }) { return <div><SectionHeading title="Personal details" description="Keep your account information up to date." /><div className="grid gap-5 sm:grid-cols-2">{(['firstName', 'lastName', 'email', 'phone'] as const).map(field => <label key={field} className="text-sm font-semibold text-slate-700">{field === 'firstName' ? 'First name' : field === 'lastName' ? 'Last name' : field === 'email' ? 'Email address' : 'Phone number'}<input name={field} type={field === 'email' ? 'email' : 'text'} value={data[field]} onChange={event => setData({ ...data, [field]: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" /></label>)}</div><div className="mt-8 flex gap-3"><button type="button" onClick={save} disabled={busy} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save changes'}</button><button type="button" onClick={cancel} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Cancel</button></div></div> }
function Addresses({ addresses, busy }: { addresses: Address[]; busy: boolean }) { return <div><SectionHeading title="Delivery addresses" description="Addresses saved for faster checkout." />{busy ? <p className="py-12 text-center text-slate-500">Loading addresses...</p> : addresses.length ? <div className="grid gap-4 sm:grid-cols-2">{addresses.map(address => <div key={address.id} className="rounded-xl border border-slate-200 p-5"><p className="font-bold text-slate-900">{address.firstName} {address.lastName}</p><p className="mt-2 text-sm leading-6 text-slate-500">{address.address}<br />{address.city}, {address.state} - {address.pincode}<br />{address.phone}</p></div>)}</div> : <Empty title="No saved addresses" text="Your delivery addresses will appear here after checkout." />}</div> }
function Orders({ orders, busy }: { orders: any[]; busy: boolean }) { return <div><SectionHeading title="My orders" description="Track your purchases and view order details." />{busy ? <p className="py-12 text-center text-slate-500">Loading orders...</p> : orders.length ? <div className="divide-y divide-slate-200">{orders.map(order => <div key={order.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><p className="font-bold text-slate-900">Order #{order.id}</p><p className="mt-1 text-sm text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Date unavailable'} · {order.items?.length || 0} items</p></div><div className="text-right"><p className="font-black text-slate-950">₹{order.totalAmount || 0}</p><span className="mt-1 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-700">{order.status || 'processing'}</span></div></div>)}</div> : <Empty title="No orders yet" text="Find something you love and it will appear here." link="Start shopping" />}</div> }
function SectionHeading({ title, description }: { title: string; description: string }) { return <div className="mb-7"><h2 className="text-2xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 break-words font-semibold text-slate-800">{value || 'Not added'}</p></div> }
function Empty({ title, text, link }: { title: string; text: string; link?: string }) { return <div className="py-12 text-center"><h3 className="text-xl font-black text-slate-900">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p>{link && <Link to="/collection" className="mt-5 inline-block rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white">{link}</Link>}</div> }