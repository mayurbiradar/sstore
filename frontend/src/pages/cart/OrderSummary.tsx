import { Sparkles } from 'lucide-react'

interface OrderSummaryProps {
  subtotal: number
  tax: number
  discount: number
  total: number
  canCheckout: boolean
  promoCode: string
  onPromoCodeChange: (value: string) => void
  onApplyPromo: () => void
  onCheckout: () => void
}

const PROMO_HINTS = 'Try WELCOME10 or JEWELRY20'

/**
 * Right-rail panel: promo code, price breakdown, checkout CTA.
 */
export default function OrderSummary({
  subtotal,
  tax,
  discount,
  total,
  canCheckout,
  promoCode,
  onPromoCodeChange,
  onApplyPromo,
  onCheckout,
}: OrderSummaryProps) {
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
      <h2 className="text-xl font-black text-slate-950">Order summary</h2>

      {/* Free-shipping progress */}
      <FreeShippingProgress subtotal={subtotal} />

      <div className="mt-5 flex gap-2">
        <input
          value={promoCode}
          onChange={event => onPromoCodeChange(event.target.value)}
          placeholder="Promo code"
          aria-label="Promo code"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-500"
        />
        <button
          type="button"
          onClick={onApplyPromo}
          className="rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-bold text-white hover:bg-rose-600"
        >
          Apply
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">{PROMO_HINTS}</p>

      <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm">
        <SummaryRow label="Subtotal" value={`₹${subtotal.toLocaleString('en-IN')}`} />
        <SummaryRow label="Shipping" value="Free" valueClassName="font-semibold text-emerald-600" />
        <SummaryRow label="GST (3%)" value={`₹${tax.toLocaleString('en-IN')}`} />
        {discount > 0 && (
          <SummaryRow
            label="Discount"
            value={`-₹${discount.toLocaleString('en-IN')}`}
            valueClassName="text-emerald-600"
          />
        )}
      </div>

      <div className="mt-5 flex justify-between border-t border-slate-200 pt-5 text-lg font-black text-slate-950">
        <span>Total</span>
        <span>₹{total.toLocaleString('en-IN')}</span>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={!canCheckout}
        className="mt-5 w-full rounded-xl bg-rose-600 py-3.5 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Proceed to checkout
      </button>
      <p className="mt-4 text-center text-xs text-slate-400">Secure checkout · Easy returns</p>
    </aside>
  )
}

function SummaryRow({
  label,
  value,
  valueClassName = '',
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex justify-between text-slate-500">
      <span>{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  )
}

const FREE_SHIPPING_THRESHOLD = 999

function FreeShippingProgress({ subtotal }: { subtotal: number }) {
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <Sparkles className="h-4 w-4 flex-shrink-0" strokeWidth={2.25} />
        <span className="font-semibold">You unlocked free shipping.</span>
      </div>
    )
  }
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between text-slate-600">
        <span className="font-semibold">Add ₹{remaining.toLocaleString('en-IN')} more</span>
        <span className="text-xs text-slate-500">for free shipping</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-rose-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>
    </div>
  )
}
