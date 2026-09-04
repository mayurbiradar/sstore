// TypeScript interfaces for dashboard data
import type { Product, CreateProductPayload } from '../api/productApi';
import type { KeycloakUser, UpdateUserPayload } from '../api/userApi';
import type { Order, OrderItem } from '../api/orderApi';

interface Address {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string;
}

const formatPrice = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import * as productApi from '../api/productApi';
import * as userApi from '../api/userApi';
import * as orderApi from '../api/orderApi';
import { API_BASE_URL } from '../constants';
import { checkAdminAndProceed } from '../utils/authUtils';
import { ProductCardSkeleton, StatTileSkeleton, Skeleton, OrderCardSkeleton } from '../components/Skeleton';

export default function AdminDashboard() {
      const [totalRevenue, setTotalRevenue] = useState<number>(0);
      const [editingUserId, setEditingUserId] = useState<string | null>(null);
      const [editUserData, setEditUserData] = useState<UpdateUserPayload>({});
      const [savingUserId, setSavingUserId] = useState<string | null>(null);
      const [userCount, setUserCount] = useState<number>(0);
      const [productCount, setProductCount] = useState<number>(0);
      const [orderCount, setOrderCount] = useState<number>(0);
      const navigate = useNavigate();
      const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'users' | 'orders'>('dashboard');
      const [showAddProductForm, setShowAddProductForm] = useState<boolean>(false);
      const [newProduct, setNewProduct] = useState<{ name: string; description: string; price: string; image: string; stock: number }>({ name: '', description: '', price: '', image: '', stock: 10 });
      const [uploading, setUploading] = useState<boolean>(false);
      const fileInputRef = useRef<HTMLInputElement>(null);
      const [users, setUsers] = useState<KeycloakUser[]>([]);
      const [products, setProducts] = useState<Product[]>([]);
      const [orders, setOrders] = useState<Order[]>([]);
      const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
      const [orderPage, setOrderPage] = useState(1);
      const ordersPerPage = 10;
      const [orderSearch, setOrderSearch] = useState('');
      const [orderStatus, setOrderStatus] = useState('All');
      const [tabLoading, setTabLoading] = useState(true);
  useEffect(() => {
    checkAdminAndProceed(
      () => {
        const token = localStorage.getItem('accessToken') || '';
        if (activeTab === 'users') {
          userApi.getUsers(token)
            .then(setUsers)
            .catch(() => setUsers([]))
            .finally(() => setTabLoading(false));
        } else if (activeTab === 'products') {
          productApi.getProducts()
            .then(setProducts)
            .catch(() => setProducts([]))
            .finally(() => setTabLoading(false));
        } else if (activeTab === 'orders') {
          orderApi.listOrders(token)
            .then(setOrders)
            .catch(() => setOrders([]))
            .finally(() => setTabLoading(false));
        } else if (activeTab === 'dashboard') {
          Promise.allSettled([
            userApi.getUserCount(token).then(setUserCount),
            productApi.getProductCount(token).then(setProductCount),
            orderApi.getOrderCount(token).then(setOrderCount),
            orderApi.getTotalRevenue(token).then(setTotalRevenue),
          ]).catch(() => {}).finally(() => setTabLoading(false));
        }
      },
      (path: string) => navigate(path)
    );
  }, [activeTab]);

  useEffect(() => {
    setOrderPage(1);
  }, [orders.length, activeTab, orderSearch, orderStatus]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    const token = localStorage.getItem('accessToken') || '';
    try {
      // Backend expects price in the smallest currency unit (paise for INR).
      // The form input is rupees, so we multiply by 100 here.
      const priceInRupees = parseFloat(newProduct.price as string);
      const priceInPaise = Number.isFinite(priceInRupees) ? Math.round(priceInRupees * 100) : 0;
      const payload: CreateProductPayload = {
        name: newProduct.name,
        description: newProduct.description,
        price: priceInPaise,
        stock: newProduct.stock,
        image: fileInputRef.current?.files?.[0],
      };
      await productApi.createProductWithImage(payload, token);
      setNewProduct({ name: '', description: '', price: '', image: '', stock: 10 });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowAddProductForm(false);
      // Refresh products if on products tab
      if (activeTab === 'products') {
        productApi.getProducts()
          .then(setProducts)
          .catch(() => setProducts([]));
      }
    } catch {
      alert('Product creation failed');
    }
    setUploading(false);
  };

  const orderStatuses = ['All', ...Array.from(new Set(orders.map(order => order.status || 'Processing')))];
  const filteredOrders = orders.filter(order => {
    const query = orderSearch.trim().toLowerCase();
    const matchesSearch = !query || order.id.toLowerCase().includes(query) || order.address?.email?.toLowerCase().includes(query) || `${order.address?.firstName} ${order.address?.lastName}`.toLowerCase().includes(query);
    const matchesStatus = orderStatus === 'All' || (order.status || 'Processing') === orderStatus;
    return matchesSearch && matchesStatus;
  });
  const sortedOrders = [...filteredOrders].sort((first, second) => {
    if (!first.createdAt) return 1;
    if (!second.createdAt) return -1;
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
  const totalOrderPages = Math.max(1, Math.ceil(sortedOrders.length / ordersPerPage));
  const visibleOrders = sortedOrders.slice((orderPage - 1) * ordersPerPage, orderPage * ordersPerPage);

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-800">
      {/* Admin Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600">SStore</p>
            <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Admin dashboard</h1>
          </div>
          <Link to="/" className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-400 hover:text-rose-600">
            Back to store
          </Link>
        </div>
      </div>

      {/* Admin Navigation */}
      <div className="sticky top-0 z-10 overflow-x-auto border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-max gap-1 sm:min-w-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`border-b-2 px-3 py-3 text-sm font-semibold transition sm:px-5 sm:py-4 ${
                activeTab === 'dashboard'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`border-b-2 px-3 py-3 text-sm font-semibold transition sm:px-5 sm:py-4 ${
                activeTab === 'products'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`border-b-2 px-3 py-3 text-sm font-semibold transition sm:px-5 sm:py-4 ${
                activeTab === 'users'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`border-b-2 px-3 py-3 text-sm font-semibold transition sm:px-5 sm:py-4 ${
                activeTab === 'orders'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Orders
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Overview</h2>
                <p className="mt-1 text-sm text-slate-500">Your store performance at a glance.</p>
              </div>
              <span className="hidden text-xs font-medium text-slate-500 sm:block">Updated just now</span>
            </div>
            {tabLoading ? (
              <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <StatTileSkeleton key={index} />
                ))}
              </div>
            ) : (
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div 
              onClick={() => setActiveTab('users')}
              className="cursor-pointer rounded border border-slate-200 border-l-4 border-l-sky-500 bg-white p-4 transition hover:border-sky-300 sm:p-5"
            >
              <p className="mb-1 text-xs text-slate-500 sm:mb-2 sm:text-sm">Total Users</p>
              <p className="text-2xl font-bold text-sky-600 sm:text-4xl">{userCount}</p>
            </div>
            <div 
              onClick={() => setActiveTab('products')}
              className="cursor-pointer rounded border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 transition hover:border-emerald-300 sm:p-5"
            >
              <p className="mb-1 text-xs text-slate-500 sm:mb-2 sm:text-sm">Total Products</p>
              <p className="text-2xl font-bold text-emerald-600 sm:text-4xl">{productCount}</p>
            </div>
            <div 
              onClick={() => setActiveTab('orders')}
              className="cursor-pointer rounded border border-slate-200 border-l-4 border-l-rose-500 bg-white p-4 transition hover:border-rose-300 sm:p-5"
            >
              <p className="mb-1 text-xs text-slate-500 sm:mb-2 sm:text-sm">Total Orders</p>
              <p className="text-2xl font-bold text-rose-600 sm:text-4xl">{orderCount}</p>
            </div>
            <div
              className="cursor-pointer rounded border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 transition hover:border-amber-300 sm:p-5"
            >
              <p className="mb-1 text-xs text-slate-500 sm:mb-2 sm:text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-amber-600 sm:text-4xl">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Catalog</p><h2 className="mt-1 text-2xl font-black text-slate-950">Products</h2><p className="mt-1 text-sm text-slate-500">Manage your storefront inventory and availability.</p></div>
              <button
                onClick={() => setShowAddProductForm(!showAddProductForm)}
                className="rounded bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"
              >
                {showAddProductForm ? <><X className="h-4 w-4" strokeWidth={2.5} /> Cancel</> : <><Plus className="h-4 w-4" strokeWidth={2.5} /> Add Product</>}
              </button>
            </div>

            {/* Add Product Form */}
            {showAddProductForm && (
              <div className="mb-6 rounded border border-slate-200 bg-white p-5">
                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Product Name"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      className="rounded-lg border-2 border-slate-200 px-4 py-3 focus:border-rose-500 focus:outline-none"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Price (₹)"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      className="rounded-lg border-2 border-slate-200 px-4 py-3 focus:border-rose-500 focus:outline-none"
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 focus:border-rose-500 focus:outline-none"
                    rows={3}
                    required
                  />
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                      className="rounded-lg border-2 border-slate-200 px-4 py-3 focus:border-rose-500 focus:outline-none"
                      required
                    />
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      className="rounded-lg border-2 border-slate-200 px-4 py-3 focus:border-rose-500 focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-950 py-3 font-bold text-white transition hover:bg-rose-600 hover:shadow-lg"
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Add Product'}
                  </button>
                </form>
              </div>
            )}

            {/* Products List */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tabLoading ? (
                Array.from({ length: 6 }).map((_, index) => <ProductCardSkeleton key={index} view="grid" />)
              ) : products.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                  No products yet. Use “Add Product” to create your first listing.
                </div>
              ) : products.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => navigate(`/admin/product/${product.id}`)}
                  className="flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-center">
                    {product.image ? (
                      <img src={product.image.startsWith('/images/') ? `${API_BASE_URL}${product.image}` : product.image} alt={product.name} className="h-44 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-400">No image</div>
                    )}
                  </div>
                  <div className="mt-4 flex-1">
                    <h3 className="line-clamp-2 text-lg font-black text-slate-900">{product.name}</h3>
                    <p className="mt-1 text-lg font-black text-rose-600">{formatPrice(product.price)}</p>
                    <div className="mt-3 flex gap-4 text-sm text-slate-500">
                      <span>Qty: {product.stock ?? 0}</span>
                      <span>{product.active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/admin/product/${product.id}`)
                      }}
                      className="flex-1 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const token = localStorage.getItem('accessToken') || '';
                        await productApi.deleteProduct(product.id, token);
                        productApi.getProducts()
                          .then(res => setProducts(res.data))
                          .catch(() => setProducts([]));
                      }}
                      className="flex-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Customer directory</p><h2 className="mt-1 text-2xl font-black text-slate-950">Users</h2><p className="mt-1 text-sm text-slate-500">Review accounts, roles, and access status.</p></div>
            <div className="overflow-hidden rounded border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">First Name</th>
                      <th className="px-4 py-3 text-left font-bold">Last Name</th>
                      <th className="px-4 py-3 text-left font-bold">Email</th>
                      <th className="px-4 py-3 text-left font-bold">Mobile</th>
                      <th className="px-4 py-3 text-left font-bold">Role</th>
                      <th className="px-4 py-3 text-left font-bold">Status</th>
                      <th className="px-4 py-3 text-left font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabLoading ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <tr key={`skel-${index}`} className="border-t border-slate-100">
                          {Array.from({ length: 7 }).map((_, col) => (
                            <td key={col} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : users.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No users yet.</td></tr>
                    ) : users.map(user => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <tr key={user.id} className="border-t border-slate-100 transition hover:bg-rose-50">
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserData.firstName ?? user.firstName}
                                onChange={e => setEditUserData({ ...editUserData, firstName: e.target.value })}
                                className="border rounded px-2 py-1 w-full"
                              />
                            ) : (
                              user.firstName
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserData.lastName ?? user.lastName}
                                onChange={e => setEditUserData({ ...editUserData, lastName: e.target.value })}
                                className="border rounded px-2 py-1 w-full"
                              />
                            ) : (
                              user.lastName
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <input
                                type="email"
                                value={editUserData.email ?? user.email}
                                onChange={e => setEditUserData({ ...editUserData, email: e.target.value })}
                                className="border rounded px-2 py-1 w-full"
                              />
                            ) : (
                              user.email
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserData.phone ?? user.phone}
                                onChange={e => setEditUserData({ ...editUserData, phone: e.target.value })}
                                className="border rounded px-2 py-1 w-full"
                              />
                            ) : (
                              user.phone
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <select
                                value={editUserData.role ?? user.role}
                                onChange={e => setEditUserData({ ...editUserData, role: e.target.value })}
                                className="border rounded px-2 py-1 w-full"
                              >
                                <option value="ADMIN">Admin</option>
                                <option value="USER">User</option>
                              </select>
                            ) : (
                              <span className={`inline-block px-3 py-1 rounded-lg font-semibold text-white text-sm ${
                                user.role === 'ADMIN' ? 'bg-rose-600' : 'bg-sky-600'
                              }`}>
                                {user.role === 'ADMIN' ? 'Admin' : user.role === 'USER' ? 'User' : 'User'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <select
                                value={'active'}
                                onChange={() => {}}
                                className="border rounded px-2 py-1 w-full"
                                disabled
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            ) : (
                              <span className={`inline-block px-3 py-1 rounded-lg font-semibold text-white text-sm bg-green-500`}>Active</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    className="rounded bg-emerald-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-emerald-700"
                                    disabled={savingUserId === user.id}
                                    onClick={async e => {
                                      e.stopPropagation();
                                      setSavingUserId(user.id);
                                      const token = localStorage.getItem('accessToken') || '';
                                      try {
                                        await userApi.updateUser(user.id, editUserData, token);
                                        userApi.getUsers(token)
                                          .then(setUsers)
                                          .catch(() => setUsers([]));
                                        setEditingUserId(null);
                                        setEditUserData({});
                                      } catch {
                                        alert('Failed to update user');
                                      }
                                      setSavingUserId(null);
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="rounded border border-slate-300 px-3 py-1 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setEditingUserId(null);
                                      setEditUserData({});
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="rounded bg-slate-900 px-3 py-1 text-sm font-bold text-white transition hover:bg-rose-600"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setEditingUserId(user.id);
                                      setEditUserData({
                                        firstName: user.firstName,
                                        lastName: user.lastName,
                                        email: user.email,
                                        phone: user.phone,
                                        role: user.role,
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="rounded border border-red-200 px-3 py-1 text-sm font-bold text-red-600 transition hover:bg-red-50"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const token = localStorage.getItem('accessToken') || '';
                                      userApi.deleteUser(user.id, token)
                                        .then(() => userApi.getUsers(token))
                                        .then(setUsers)
                                        .catch(() => alert('Failed to delete user'));
                                    }}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Fulfillment</p><h2 className="mt-1 text-2xl font-black text-slate-950">Orders</h2><p className="mt-1 text-sm text-slate-500">Review recent purchases and manage customer deliveries.</p></div>
            {orders.length > 0 && <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row"><label className="flex-1"><span className="sr-only">Search orders</span><input value={orderSearch} onChange={event => setOrderSearch(event.target.value)} placeholder="Search by order ID, customer name, or email" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100" /></label><label><span className="sr-only">Filter orders by status</span><select value={orderStatus} onChange={event => setOrderStatus(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 sm:w-48">{orderStatuses.map(status => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select></label></div></div>}
            {tabLoading ? (
              <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
                {Array.from({ length: 4 }).map((_, index) => (
                  <OrderCardSkeleton key={index} />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-xl text-gray-600">No orders yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {visibleOrders.map(order => (
                    <div 
                      key={order.id} 
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-rose-300 hover:shadow-md sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-base font-black text-slate-900">Order #{order.id}</span>
                          <span className="ml-3 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-700">{order.status || 'Processing'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Date unavailable'}</span>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold text-rose-600">{order.items?.length || 0}</span>
                        <span>{order.items?.length === 1 ? order.items[0].productName : `${order.items?.length || 0} products in this order`}</span>
                        {order.address && <span className="ml-auto hidden text-xs text-slate-400 sm:block">Customer: {order.address.firstName} {order.address.lastName}</span>}
                      </div>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                        <div className="text-sm text-slate-500">Order total <span className="ml-2 text-lg font-black text-slate-950">₹{order.totalAmount?.toLocaleString('en-IN')}</span></div>
                        <button
                          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white transition duration-200 hover:bg-rose-600 hover:shadow-lg"
                          onClick={e => { e.stopPropagation(); setSelectedOrder(order); }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {sortedOrders.length > 0 ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                  <p className="text-slate-500">Showing {Math.min((orderPage - 1) * ordersPerPage + 1, sortedOrders.length)}-{Math.min(orderPage * ordersPerPage, sortedOrders.length)} of {sortedOrders.length} orders</p>
                  <div className="flex items-center gap-2"><button type="button" disabled={orderPage === 1} onClick={() => setOrderPage(page => page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="px-2 font-bold text-slate-700">Page {orderPage} of {totalOrderPages}</span><button type="button" disabled={orderPage === totalOrderPages} onClick={() => setOrderPage(page => page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div>
                </div> : <div className="mt-5 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No orders match these filters.</div>}
                {/* Order Details Modal Popup */}
                {selectedOrder && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
                    onClick={e => {
                      if (e.target === e.currentTarget) setSelectedOrder(null);
                    }}
                  >
                    <div role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-8">
                      <div className="mb-6 flex items-start justify-between border-b border-slate-200 pb-5"><div><p className="text-xs font-bold uppercase tracking-wide text-rose-600">Order details</p><h2 id="order-details-title" className="mt-1 text-2xl font-black text-slate-900">#{selectedOrder.id}</h2><p className="mt-1 text-sm text-slate-500">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('en-IN') : 'Date unavailable'}</p></div><button aria-label="Close order details" className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800" onClick={() => setSelectedOrder(null)}>&times;</button></div>
                      <div className="mb-6 grid gap-6 border-b border-slate-200 pb-6 md:grid-cols-2">
                        {/* Order Summary Left */}
                        <div className="w-full">
                          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Order summary</div>
                          <div className="mb-2 text-sm text-slate-600">Status: <span className="font-bold capitalize text-slate-900">{selectedOrder.status}</span></div>
                          <div className="mb-2 text-sm text-slate-600">Order date: <span className="font-semibold text-slate-900">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : 'N/A'}</span></div>
                          <div className="mb-2 text-sm text-slate-600">Total: <span className="text-lg font-black text-rose-600">{selectedOrder ? formatPrice(selectedOrder.totalAmount) : ''}</span></div>
                          <div className="text-sm text-slate-600">Payment: <span className="font-bold text-slate-900">{selectedOrder.paymentMethod || 'Cash on delivery'}</span></div>
                          <div className="mt-3">
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Update status</label>
                            <div className="flex gap-2">
                              <select
                                value={selectedOrder?.status || 'PLACED'}
                                onChange={e => {
                                  if (!selectedOrder) return;
                                  const next = e.target.value;
                                  const token = localStorage.getItem('accessToken') || '';
                                  orderApi.transitionOrderStatus(selectedOrder.id, next, token)
                                    .then(updated => {
                                      setSelectedOrder(updated);
                                      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                                      toast.success(`Order ${updated.id} → ${updated.status}`);
                                    })
                                    .catch(() => toast.error('Status transition failed'));
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-rose-500"
                              >
                                {['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        {/* Order Item Images and Info Right */}
                        <div className="flex w-full flex-col gap-3">
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Order items</div>
                          {selectedOrder.items && selectedOrder.items.map(item => (
                            <div key={item.productId} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                              {item.image && (
                                <img
                                  src={item.image.startsWith('/images/') ? `${API_BASE_URL}${item.image}` : item.image}
                                  alt={item.productName}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="line-clamp-2 text-sm font-bold text-slate-800">{item.productName}</div>
                                <div className="text-xs text-slate-500">Qty {item.quantity} · ₹{item.subtotal}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Shipping Address Left */}
                        {selectedOrder.address && (
                          <div className="w-full">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Shipping address</div>
                            <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                              <div className="font-bold text-slate-900">{selectedOrder.address.firstName} {selectedOrder.address.lastName}</div>
                              <div>{selectedOrder.address.address}</div>
                              <div>{selectedOrder.address.city}, {selectedOrder.address.state} - {selectedOrder.address.pincode}</div>
                              <div className="mt-2">{selectedOrder.address.phone}</div>
                              <div>{selectedOrder.address.email}</div>
                            </div>
                          </div>
                        )}
                        {/* Order Items Right */}
                        {/* Removed: Order Items from bottom section */}
                      </div>
                      <div className="mt-6 border-t border-slate-200 pt-4 text-right"><button type="button" onClick={() => setSelectedOrder(null)} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-600">Close details</button></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
