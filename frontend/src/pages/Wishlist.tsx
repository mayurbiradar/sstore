import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Trash2, ArrowRight, Sparkles } from 'lucide-react'
import { useWishlist, type WishlistItem } from '../context/WishlistContext'
import { useCart } from '../context/CartContext'
import { API_BASE_URL } from '../constants'

const formatPrice = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function resolveImage(image: string): string {
  return image?.startsWith('/images/') ? `${API_BASE_URL}${image}` : image
}

function EmptyWishlist() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <Heart className="h-12 w-12" strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Your wishlist is empty</h1>
      <p className="mt-3 max-w-md text-slate-500">
        Save products you love by tapping the heart icon. They'll be ready for you right here, on every device.
      </p>
      <Link
        to="/collection"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white transition hover:bg-rose-600"
      >
        Browse the collection
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </Link>
    </div>
  )
}

interface WishlistItemRowProps {
  item: WishlistItem
  onRemove: () => void
  onMoveToCart: () => void
}

function WishlistItemRow({ item, onRemove, onMoveToCart }: WishlistItemRowProps) {
  const image = resolveImage(item.image)
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <Link
        to={`/product/${item.id}`}
        className="flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-32"
      >
        <img src={image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div>
            <Link
              to={`/product/${item.id}`}
              className="line-clamp-2 text-lg font-bold text-slate-900 transition hover:text-rose-600"
            >
              {item.name}
            </Link>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatPrice(item.price)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 sm:self-auto"
            aria-label={`Remove ${item.name} from wishlist`}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            Remove
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Saved on this device
          </p>
          <button
            type="button"
            onClick={onMoveToCart}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"
          >
            <ShoppingCart className="h-4 w-4" strokeWidth={2.5} />
            Move to cart
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Wishlist() {
  const { items, removeFromWishlist, clearWishlist } = useWishlist()
  const { addToCart } = useCart()

  if (items.length === 0) {
    return <EmptyWishlist />
  }

  const handleMoveToCart = (item: WishlistItem) => {
    if (!item.sku) return
    addToCart({
      id: item.id,
      sku: item.sku,
      name: item.name,
      price: item.price,
      image: item.image,
    })
    removeFromWishlist(item.id)
  }

  const totalValue = items.reduce((total, item) => total + item.price, 0)

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-rose-600">
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
              Saved for later
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              My wishlist
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {items.length} {items.length === 1 ? 'item' : 'items'} ·
              {' '}
              <span className="font-semibold text-slate-700">
                {formatPrice(totalValue)}
              </span>
              {' '}
              total value
            </p>
          </div>
          <button
            type="button"
            onClick={clearWishlist}
            className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 sm:self-auto"
          >
            Clear all
          </button>
        </header>

        {/* List */}
        <div className="space-y-3">
          {items.map(item => (
            <WishlistItemRow
              key={item.id}
              item={item}
              onRemove={() => removeFromWishlist(item.id)}
              onMoveToCart={() => handleMoveToCart(item)}
            />
          ))}
        </div>

        {/* Footer tip */}
        <div className="mt-10 rounded-2xl border border-rose-100 bg-rose-50/60 p-5 text-sm text-slate-600">
          <p className="flex items-start gap-2">
            <Heart className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" strokeWidth={2.25} />
            <span>
              Your wishlist is stored locally on this device. It will stay with you across visits —
              no account required.
            </span>
          </p>
        </div>
      </div>
    </main>
  )
}