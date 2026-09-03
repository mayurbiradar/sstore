import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { getProducts } from '../api/productApi';
import { API_BASE_URL } from '../constants';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, Gem, Star, Check, ShoppingCart } from 'lucide-react';
import { ProductCardSkeleton, Skeleton } from '../components/Skeleton';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  rating: number;
  stock: number;
  category?: string;
  material?: string;
  description?: string;
}

export default function Collection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addedProductId, setAddedProductId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { cart, addToCart, updateQuantity } = useCart();


  useEffect(() => {
    const category = searchParams.get('category');
    if (category) setSelectedCategory(category);
    const query = searchParams.get('q');
    if (query !== null) setSearchQuery(query);
  }, [searchParams]);

  // Keep the URL in sync when the user types in the in-page search box
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (searchQuery === current) return;
    const next = new URLSearchParams(searchParams);
    if (searchQuery) next.set('q', searchQuery);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  }, [searchQuery, searchParams, setSearchParams]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProducts();
        const data = res.data;
        const productList = Array.isArray(data) ? data : data?.products || [];
        setProducts(productList);
        setPriceRange([0, Math.max(10000, ...productList.map((product: Product) => product.price))]);
        setFilteredProducts(productList);
      } catch (error) {
        console.error('Error fetching products:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Price filter
    filtered = filtered.filter(product =>
      product.price >= priceRange[0] && product.price <= priceRange[1]
    );

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'rating':
          return b.rating - a.rating;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory, priceRange, sortBy]);

  const handleAddToCart = (product: Product) => {
    if (product.stock === 0 || getProductQuantity(product.id) >= product.stock) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image
    });
    setAddedProductId(product.id);
    window.setTimeout(() => setAddedProductId(null), 1400);
  };

  const getProductQuantity = (productId: number) => {
    return cart.find(item => item.id === productId)?.quantity || 0;
  };

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        {/* Hero skeleton */}
        <section className="border-b border-slate-200 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-3 h-9 w-72 sm:h-12" />
            <Skeleton className="mt-4 h-4 w-96 max-w-full" />
          </div>
        </section>

        {/* Search + filters skeleton */}
        <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-3 h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product grid skeleton */}
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductCardSkeleton key={index} view="grid" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4 text-center"><div><p className="text-sm font-bold uppercase tracking-wider text-rose-600">Something went wrong</p><h1 className="mt-2 text-3xl font-black text-slate-950">We could not load the catalogue.</h1><p className="mt-3 text-slate-500">Check your connection and try again.</p><button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-rose-600">Try again</button></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">The SStore edit</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Shop all products</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-500">Find something useful, beautiful, or simply right for today.</p>
        </div>
      </section>

      {/* Filters and Search */}
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for jewelry, materials, or styles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-6 py-4 pl-12 text-base shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-100"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="h-5 w-5" strokeWidth={2} />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const category = e.target.value;
                    setSelectedCategory(category);
                    if (category === 'all') setSearchParams({});
                    else setSearchParams({ category });
                  }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus:border-rose-500 focus:outline-none"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Price Range: ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
                </label>
                <div className="px-2">
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="10"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-rose-100"
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus:border-rose-500 focus:outline-none"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="price-low">Price (Low to High)</option>
                  <option value="price-high">Price (High to Low)</option>
                  <option value="rating">Rating</option>
                </select>
              </div>

              {/* View Mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">View</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 transition ${
                      viewMode === 'grid'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-rose-400'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" strokeWidth={2} />
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 transition ${
                      viewMode === 'list'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-rose-400'
                    }`}
                  >
                    <List className="h-4 w-4" strokeWidth={2} />
                    List
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-600">
              Showing {filteredProducts.length} of {products.length} products
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Clear Search
              </button>
            )}
          </div>

          {/* Products Grid/List */}
          {filteredProducts.length > 0 ? (
            <div className={
              viewMode === 'grid'
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-6"
            }>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  viewMode={viewMode}
                  onAddToCart={handleAddToCart}
                  added={addedProductId === product.id}
                  quantity={getProductQuantity(product.id)}
                  onUpdateQuantity={(id, quantity) => {
                    const currentProduct = products.find(item => item.id === id);
                    if (currentProduct && quantity <= currentProduct.stock) updateQuantity(id, quantity);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Gem className="h-10 w-10" strokeWidth={1.75} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No products found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? `No products match "${searchQuery}"`
                  : 'Try adjusting your filters'
                }
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setPriceRange([0, 10000]);
                }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

interface ProductCardProps {
  product: Product;
  viewMode: 'grid' | 'list';
  onAddToCart: (product: Product) => void;
  added: boolean;
  quantity: number;
  onUpdateQuantity: (id: number, quantity: number) => void;
}

function ProductCard({ product, viewMode, onAddToCart, added, quantity, onUpdateQuantity }: ProductCardProps) {
  const imageUrl = product.image.startsWith('/images/')
    ? `${API_BASE_URL}${product.image}`
    : product.image;

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
        <div className="flex">
          <div className="flex h-48 w-48 flex-shrink-0 items-center justify-center bg-slate-100">
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
            />
          </div>
          <div className="flex-1 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
                <div className="flex items-center mb-2">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" strokeWidth={1.5} />
                  <span className="text-gray-700 font-semibold">{product.rating}</span>
                </div>
                <p className="text-2xl font-black text-slate-950">
                  ₹{product.price.toLocaleString('en-IN')}
                </p>
              </div>
              <Link
                to={`/product/${product.id}`}
                className="rounded-lg bg-rose-50 px-4 py-2 text-rose-700 hover:bg-rose-100"
              >
                View Details
              </Link>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {product.stock > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-green-600">
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    In Stock ({product.stock})
                  </span>
                ) : (
                  <span className="text-red-600">Out of Stock</span>
                )}
              </div>
              {quantity > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(product.id, quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white hover:bg-rose-600"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(product.id, quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white hover:bg-rose-600"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onAddToCart(product)}
                  disabled={product.stock === 0 || quantity >= product.stock}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 py-2 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {quantity >= product.stock ? 'Stock limit reached' : added ? <><Check className="h-4 w-4" strokeWidth={3} /> Added to cart</> : <><ShoppingCart className="h-4 w-4" strokeWidth={2.5} /> Add to Cart</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 overflow-hidden border border-gray-100">
      <Link
        to={`/product/${product.id}`}
        className="block"
      >
        <div className="relative flex h-64 items-center justify-center overflow-hidden bg-slate-100">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer"
          />
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                Out of Stock
              </span>
            </div>
          )}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1">
            <div className="flex items-center">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" strokeWidth={1.5} />
              <span className="ml-1 text-gray-800 font-semibold text-sm">{product.rating}</span>
            </div>
          </div>
        </div>
      </Link>

      <div className="p-6">
        <Link to={`/product/${product.id}`}>
          <h3 className="mb-2 line-clamp-2 text-lg font-bold text-slate-800 transition-colors group-hover:text-rose-600">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-black text-slate-950">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          <div className="text-sm text-gray-600">
            {product.stock > 0 ? (
              <span className="text-green-600">In Stock</span>
            ) : (
              <span className="text-red-600">Out of Stock</span>
            )}
          </div>
        </div>

        {quantity > 0 ? (
          <div className="flex items-center justify-center gap-2 mb-3">
            <button
              onClick={() => onUpdateQuantity(product.id, quantity - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 font-bold text-white hover:bg-rose-600"
            >
              −
            </button>
            <span className="w-12 text-center font-bold text-lg">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(product.id, quantity + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 font-bold text-white hover:bg-rose-600"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAddToCart(product)}
            disabled={product.stock === 0 || quantity >= product.stock}
            className="w-full rounded-xl bg-rose-600 py-3 font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quantity >= product.stock ? 'Stock limit reached' : added ? <><Check className="mr-2 inline h-4 w-4" strokeWidth={3} /> Added to cart</> : <><ShoppingCart className="mr-2 inline h-4 w-4" strokeWidth={2.5} /> Add to Cart</>}
          </button>
        )}
      </div>
    </div>
  );
}
