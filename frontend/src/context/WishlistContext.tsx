import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

export interface WishlistItem {
  id: number
  name: string
  price: number
  image: string
}

interface WishlistContextType {
  items: WishlistItem[]
  isInWishlist: (id: number) => boolean
  toggleWishlist: (product: WishlistItem) => void
  addToWishlist: (product: WishlistItem) => void
  removeFromWishlist: (id: number) => void
  clearWishlist: () => void
  count: number
}

const STORAGE_KEY = 'sstore_wishlist_v1'

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

function readStorage(): WishlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item: unknown): item is WishlistItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as WishlistItem).id === 'number' &&
        typeof (item as WishlistItem).name === 'string' &&
        typeof (item as WishlistItem).price === 'number' &&
        typeof (item as WishlistItem).image === 'string',
    )
  } catch {
    return []
  }
}

function writeStorage(items: WishlistItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignore quota / privacy-mode errors — wishlist is best-effort.
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>(() => readStorage())

  // Persist on every change
  useEffect(() => {
    writeStorage(items)
  }, [items])

  // Sync across tabs
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      setItems(readStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const isInWishlist = (id: number) => items.some(item => item.id === id)

  const addToWishlist = (product: WishlistItem) => {
    let added = false
    setItems(prev => {
      if (prev.some(item => item.id === product.id)) return prev
      added = true
      return [...prev, product]
    })
    if (added) {
      toast.success(`${product.name} saved to wishlist`, {
        description: 'View or manage it any time from your wishlist page.',
      })
    }
  }

  const removeFromWishlist = (id: number) => {
    let removedName: string | undefined
    setItems(prev => {
      const target = prev.find(item => item.id === id)
      removedName = target?.name
      return prev.filter(item => item.id !== id)
    })
    if (removedName) {
      toast(`${removedName} removed from wishlist`, {
        description: 'You can re-save it from the product page.',
      })
    }
  }

  const toggleWishlist = (product: WishlistItem) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id)
    } else {
      addToWishlist(product)
    }
  }

  const clearWishlist = () => setItems([])

  return (
    <WishlistContext.Provider
      value={{
        items,
        isInWishlist,
        toggleWishlist,
        addToWishlist,
        removeFromWishlist,
        clearWishlist,
        count: items.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider')
  }
  return context
}