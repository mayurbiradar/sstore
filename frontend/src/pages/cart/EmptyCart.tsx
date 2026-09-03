import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'

/**
 * Empty state shown when the cart has no items.
 * Encourages the user back to the collection with a clear CTA.
 */
export default function EmptyCart() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-20 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <ShoppingCart className="h-10 w-10" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 text-3xl font-black text-slate-950">Your cart is empty</h1>
        <p className="mt-3 text-slate-500">
          Good finds are waiting. Browse the collection and add something you love.
        </p>
        <Link
          to="/collection"
          className="mt-7 inline-block rounded-xl bg-rose-600 px-6 py-3 font-bold text-white hover:bg-rose-700"
        >
          Start shopping
        </Link>
      </div>
    </main>
  )
}
