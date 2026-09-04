import { Link } from 'react-router-dom'
import type { CartItem } from '../../context/CartContext'
import { API_BASE_URL } from '../../constants'

const formatPrice = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

interface CartItemRowProps {
  item: CartItem
  selected: boolean
  onSelect: () => void
  onRemove: () => void
  onQuantity: (quantity: number) => void
}

function resolveImage(image: string): string {
  return image?.startsWith('/images/') ? `${API_BASE_URL}${image}` : image
}

/**
 * Single line-item in the cart — image, name, price, qty stepper, line total.
 */
export default function CartItemRow({
  item,
  selected,
  onSelect,
  onRemove,
  onQuantity,
}: CartItemRowProps) {
  const image = resolveImage(item.image)
  return (
    <article
      className={`flex gap-3 rounded-xl border bg-white p-4 transition sm:gap-5 ${
        selected ? 'border-rose-300' : 'border-slate-200'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="mt-2 h-4 w-4 accent-rose-600"
        aria-label={`Select ${item.name}`}
      />
      <Link
        to={`/product/${item.id}`}
        className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-28 sm:w-28"
      >
        <img src={image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3">
          <div>
            <Link
              to={`/product/${item.id}`}
              className="line-clamp-2 font-bold text-slate-900 hover:text-rose-600"
            >
              {item.name}
            </Link>
            <p className="mt-1 text-sm text-slate-500">
              {formatPrice(item.price)} each
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-semibold text-slate-400 hover:text-rose-600"
          >
            Remove
          </button>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onQuantity(item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="h-8 w-8 text-slate-600 disabled:opacity-30"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
            <button
              type="button"
              onClick={() => onQuantity(item.quantity + 1)}
              className="h-8 w-8 text-slate-600 hover:text-rose-600"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <p className="font-black text-slate-950">
            ₹{(item.price * item.quantity).toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </article>
  )
}
