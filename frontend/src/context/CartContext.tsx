import { createContext, useContext, useState, type ReactNode } from 'react'
import * as orderApi from '../api/orderApi'

export interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  image: string
}

// Backend order response type
export interface Order {
  id: string;
  items: any[];
  totalAmount: number;
  createdAt: string;
  status: string;
  [key: string]: any;
}

// Order payload type for creation
export interface OrderPayload {
  userId: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: any[];
  subtotal: number;
  tax: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  orders: Order[];
  addOrder: (order: OrderPayload) => Promise<Order | null>;
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  // Removed orders API call on homepage load

  const addToCart = (product: Omit<CartItem, 'quantity'>) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
    } else {
      setCart(prev =>
        prev.map(item =>
          item.id === id ? { ...item, quantity } : item
        )
      )
    }
  }

  const clearCart = () => {
    setCart([])
  }

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const addOrder = async (order: OrderPayload) => {
    const token = localStorage.getItem('accessToken') || '';
    const res = await orderApi.createOrder(order, token);
    setOrders(prev => [res.data, ...prev]);
    return res.data as Order;
  }

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, orders, addOrder }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
