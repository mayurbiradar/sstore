import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, RotateCcw, Headphones, Star, Check, ShoppingCart } from 'lucide-react'
import { getProducts } from '../api/productApi'
import { API_BASE_URL } from '../constants'
import { useCart } from '../context/CartContext'

interface Product {
  id: number
  name: string
  price: number
  image: string
  rating?: number
  stock: number
  category?: string
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [addedProductId, setAddedProductId] = useState<number | null>(null)
  const { addToCart } = useCart()

  useEffect(() => {
    getProducts().then(({ data }) => {
      const list = Array.isArray(data) ? data : data?.products || []
      setProducts(list.slice(0, 4))
    }).catch(() => setProducts([])).finally(() => setLoading(false))
  }, [])

  const addProduct = (product: Product) => {
    addToCart({ id: product.id, name: product.name, price: product.price, image: product.image })
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(null), 1400)
  }

  return (
    <main className="bg-[#f7f8fa] text-slate-900">
      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-center md:pb-16 md:pt-16 lg:px-8">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-rose-600">Everyday finds, better chosen</p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-6xl">Good things should be easy to find.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">Shop useful, beautiful products from one trusted place. Simple browsing, secure checkout, and delivery you can count on.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/collection" className="rounded-xl bg-rose-600 px-6 py-3.5 font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700">Start shopping</Link>
            <Link to="/about" className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600">Why SStore?</Link>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-slate-500"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-rose-600" strokeWidth={2} /> Secure payments</span><span className="inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4 text-rose-600" strokeWidth={2} /> Easy returns</span><span className="inline-flex items-center gap-1.5"><Headphones className="h-4 w-4 text-rose-600" strokeWidth={2} /> Helpful support</span></div>
        </div>
        <div className="relative min-h-72 overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-xl sm:min-h-96 sm:p-10">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-rose-500/80 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-amber-300/40 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between">
            <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80">New season edit</span>
            <div><p className="text-2xl font-bold sm:text-4xl">Small upgrades.</p><p className="mt-1 text-2xl font-bold text-amber-300 sm:text-4xl">Big difference.</p><Link to="/collection" className="mt-6 inline-block text-sm font-bold underline decoration-rose-400 underline-offset-4">Explore the collection →</Link></div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-6 text-sm sm:grid-cols-4 sm:px-6 lg:px-8"><div><b className="block text-slate-900">Curated for you</b><span className="text-slate-500">Quality picks, less scrolling</span></div><div><b className="block text-slate-900">Fast dispatch</b><span className="text-slate-500">Packed with care</span></div><div><b className="block text-slate-900">Secure checkout</b><span className="text-slate-500">Protected every step</span></div><div><b className="block text-slate-900">Real support</b><span className="text-slate-500">We are here to help</span></div></div></section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-600">Fresh picks</p><h2 className="mt-1 text-3xl font-black tracking-tight">Trending now</h2></div><Link to="/collection" className="text-sm font-bold text-rose-600 hover:text-rose-700">View all products →</Link></div>
        {loading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-80 animate-pulse rounded-2xl bg-slate-200" />)}</div> : products.length > 0 ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{products.map(product => <ProductCard key={product.id} product={product} added={addedProductId === product.id} onAdd={() => addProduct(product)} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">New products are arriving soon. Browse the collection to see what is available.</div>}
      </section>
    </main>
  )
}

function ProductCard({ product, added, onAdd }: { product: Product; added: boolean; onAdd: () => void }) {
  const imageUrl = product.image?.startsWith('/images/') ? `${API_BASE_URL}${product.image}` : product.image
  return <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"><Link to={`/product/${product.id}`} className="block"><div className="relative aspect-square overflow-hidden bg-slate-100"><img src={imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{product.category && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{product.category}</span>}</div></Link><div className="p-4"><Link to={`/product/${product.id}`}><h3 className="line-clamp-2 min-h-12 font-bold text-slate-800 transition group-hover:text-rose-600">{product.name}</h3></Link><div className="mt-3 flex items-center justify-between gap-2"><span className="font-black text-slate-950">₹{product.price.toLocaleString('en-IN')}</span><span className="inline-flex items-center gap-1 text-xs text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" strokeWidth={1.5} /> {product.rating || 'New'}</span></div><button type="button" onClick={onAdd} disabled={product.stock === 0} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${added ? 'bg-emerald-600' : 'bg-slate-950 hover:bg-rose-600'}`}>{product.stock === 0 ? 'Out of stock' : added ? <><Check className="h-4 w-4" strokeWidth={3} /> Added to cart</> : <><ShoppingCart className="h-4 w-4" strokeWidth={2.5} /> Add to cart</>}</button></div></article>
}