import { Link } from 'react-router-dom'

interface CartHeaderProps {
  itemCount: number
}

/**
 * Page-level heading with item count and a "Continue shopping" link.
 */
export default function CartHeader({ itemCount }: CartHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">Ready when you are</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Your cart</h1>
        <p className="mt-2 text-slate-500">
          {itemCount} item{itemCount === 1 ? '' : 's'} saved for checkout.
        </p>
      </div>
      <Link to="/collection" className="text-sm font-bold text-rose-600 hover:text-rose-700">
        Continue shopping →
      </Link>
    </div>
  )
}
