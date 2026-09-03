import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import EmptyCart from './cart/EmptyCart'
import CartHeader from './cart/CartHeader'
import CartToolbar from './cart/CartToolbar'
import CartItemRow from './cart/CartItemRow'
import OrderSummary from './cart/OrderSummary'

/** Returns the discount rate for a given promo code, or 0 if invalid. */
function promoRate(code: string): number {
  const normalized = code.toLowerCase()
  if (normalized === 'welcome10') return 0.1
  if (normalized === 'jewelry20') return 0.2
  return 0
}

export default function Cart() {
  const { cart, removeFromCart, updateQuantity } = useCart()
  const navigate = useNavigate()
  const [selectedItems, setSelectedItems] = useState<Set<number>>(
    () => new Set(cart.map(item => item.id))
  )
  const [promoCode, setPromoCode] = useState('')
  const [discount, setDiscount] = useState(0)

  const subtotal = cart
    .filter(item => selectedItems.has(item.id))
    .reduce((total, item) => total + item.price * item.quantity, 0)
  const tax = Math.max(0, Math.round((subtotal - discount) * 0.03))
  const total = subtotal + tax - discount

  if (!cart.length) {
    return <EmptyCart />
  }

  const toggleItem = (id: number) =>
    setSelectedItems(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () => {
    setSelectedItems(
      selectedItems.size === cart.length ? new Set() : new Set(cart.map(item => item.id))
    )
  }

  const removeSelected = () => {
    selectedItems.forEach(id => removeFromCart(id))
  }

  const applyPromo = () => {
    const rate = promoRate(promoCode)
    setDiscount(rate ? Math.round(subtotal * rate) : 0)
  }

  const checkout = () => {
    if (!selectedItems.size) return
    navigate('/checkout', {
      state: { selectedItems: cart.filter(item => selectedItems.has(item.id)) },
    })
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <CartHeader itemCount={cart.length} />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <CartToolbar
              totalCount={cart.length}
              selectedCount={selectedItems.size}
              onToggleAll={toggleAll}
              onRemoveSelected={removeSelected}
            />
            <div className="space-y-3">
              {cart.map(item => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  selected={selectedItems.has(item.id)}
                  onSelect={() => toggleItem(item.id)}
                  onRemove={() => removeFromCart(item.id)}
                  onQuantity={quantity => updateQuantity(item.id, quantity)}
                />
              ))}
            </div>
          </section>

          <OrderSummary
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            total={total}
            canCheckout={selectedItems.size > 0}
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            onApplyPromo={applyPromo}
            onCheckout={checkout}
          />
        </div>
      </div>
    </main>
  )
}
