import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Gem, Star, Check, ShoppingCart, Sparkles, ChevronRight, Home as HomeIcon, Heart, ZoomIn, Loader2, Truck, ShieldCheck, RefreshCw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { getProduct, getProducts } from '../api/productApi';
import { API_BASE_URL } from '../constants';
import ImageZoom from '../components/ImageZoom';

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
  weight?: string;
  dimensions?: string;
  careInstructions?: string;
  images?: string[];
}

interface Review {
  id: number;
  user: string;
  rating: number;
  comment: string;
  date: string;
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews] = useState<Review[]>([
    { id: 1, user: 'Sarah M.', rating: 5, comment: 'Absolutely stunning piece! The craftsmanship is exceptional.', date: '2024-01-15' },
    { id: 2, user: 'John D.', rating: 4, comment: 'Beautiful design and great quality. Highly recommend!', date: '2024-01-10' },
    { id: 3, user: 'Emma L.', rating: 5, comment: 'Perfect for special occasions. Love the attention to detail.', date: '2024-01-08' }
  ]);
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await getProduct(productId!);
        const productData = res.data;
        setProduct(productData);

        // Fetch related products
        const allProductsRes = await getProducts();
        const allProducts = Array.isArray(allProductsRes.data) ? allProductsRes.data : allProductsRes.data?.products || [];
        const related = allProducts
          .filter((p: any) => p.id !== productData.id && p.category === productData.category)
          .slice(0, 4);
        setRelatedProducts(related);
      } catch (error) {
        console.error('Error fetching product:', error);
        navigate('/collection');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId, navigate]);

  const handleAddToCart = () => {
    if (!product) return;

    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image
      });
    }
    setAddedToCart(true);
    window.setTimeout(() => setAddedToCart(false), 1400);

  };

  const handleToggleWishlist = () => {
    if (!product) return;
    toggleWishlist({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    });
  };

  const savedForLater = product ? isInWishlist(product.id) : false;

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= product!.stock) {
      setQuantity(newQuantity);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#f7f8fa]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-rose-600" strokeWidth={2} />
          <p className="text-base font-semibold text-slate-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#f7f8fa]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Gem className="h-12 w-12" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
          <Link
            to="/collection"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition"
          >
            Browse Collection
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = product.image.startsWith('/images/')
    ? `${API_BASE_URL}${product.image}`
    : product.image;

  const productImages = product.images || [product.image];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50/30">
      {/* Breadcrumb */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-purple-600 transition">
              <HomeIcon className="h-3.5 w-3.5" strokeWidth={2} /> Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
            <Link to="/collection" className="hover:text-purple-600 transition">Collection</Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
            <span className="text-gray-800 font-medium">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Details */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Product Images */}
            <div className="space-y-4">
              {/* Main Image with hover zoom */}
              <div className="relative rounded-2xl bg-white shadow-lg overflow-hidden">
                <ImageZoom
                  src={
                    productImages[selectedImage]?.startsWith('/images/')
                      ? `${API_BASE_URL}${productImages[selectedImage]}`
                      : productImages[selectedImage] || imageUrl
                  }
                  alt={product.name}
                  zoomScale={2.25}
                  className="h-96 lg:h-[500px]"
                />
                <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur">
                  <ZoomIn className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Hover to zoom
                </div>
              </div>

              {/* Thumbnail Images */}
              {productImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {productImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                        selectedImage === index
                          ? 'border-purple-600 shadow-lg'
                          : 'border-gray-200 hover:border-purple-400'
                      }`}
                    >
                      <img
                        src={img.startsWith('/images/') ? `${API_BASE_URL}${img}` : img}
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
                  {product.name}
                </h1>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" strokeWidth={1.5} />
                    <span className="text-xl font-bold text-gray-800">{product.rating}</span>
                    <span className="text-gray-600">({reviews.length} reviews)</span>
                  </div>
                  {product.category && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      {product.category}
                    </span>
                  )}
                </div>
                <p className="text-4xl font-black text-slate-950 mb-6">
                  ₹{product.price.toLocaleString('en-IN')}
                </p>
              </div>

              {/* Description */}
              {product.description && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Description</h3>
                  <p className="text-gray-600 leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Specifications */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Specifications</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {product.material && (
                    <div>
                      <span className="text-gray-600 text-sm">Material:</span>
                      <p className="font-semibold text-gray-800">{product.material}</p>
                    </div>
                  )}
                  {product.weight && (
                    <div>
                      <span className="text-gray-600 text-sm">Weight:</span>
                      <p className="font-semibold text-gray-800">{product.weight}</p>
                    </div>
                  )}
                  {product.dimensions && (
                    <div>
                      <span className="text-gray-600 text-sm">Dimensions:</span>
                      <p className="font-semibold text-gray-800">{product.dimensions}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600 text-sm">Stock:</span>
                    <p className={`font-semibold ${product.stock > 5 ? 'text-green-600' : 'text-red-600'}`}>
                      {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quantity and Add to Cart */}
              {product.stock > 0 && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-700 font-semibold">Quantity:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(quantity - 1)}
                          disabled={quantity <= 1}
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          −
                        </button>
                        <span className="w-12 text-center text-lg font-bold">{quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(quantity + 1)}
                          disabled={quantity >= product.stock}
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total</p>
                      <p className="text-2xl font-black text-slate-950">
                        ₹{(product.price * quantity).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-4 text-lg font-bold text-white transition hover:bg-rose-700"
                    >
                      {addedToCart ? <><Check className="h-5 w-5" strokeWidth={3} /> Added to Cart</> : <><ShoppingCart className="h-5 w-5" strokeWidth={2.5} /> Add to Cart</>}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleWishlist}
                      aria-pressed={savedForLater}
                      aria-label={savedForLater ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                      title={savedForLater ? 'Remove from wishlist' : 'Save to wishlist'}
                      className={`flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-300 ${
                        savedForLater
                          ? 'border-rose-500 bg-rose-50 text-rose-600 hover:bg-rose-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500'
                      }`}
                    >
                      <Heart
                        className={`h-6 w-6 transition-transform ${savedForLater ? 'scale-110 fill-rose-500 text-rose-500' : ''}`}
                        strokeWidth={2.25}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Wishlist button when out of stock */}
              {product.stock === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <button
                    type="button"
                    onClick={handleToggleWishlist}
                    aria-pressed={savedForLater}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition ${
                      savedForLater
                        ? 'border-rose-500 bg-rose-50 text-rose-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600'
                    }`}
                  >
                    <Heart
                      className={`h-5 w-5 ${savedForLater ? 'fill-rose-500 text-rose-500' : ''}`}
                      strokeWidth={2.25}
                    />
                    {savedForLater ? 'Saved to wishlist' : 'Save to wishlist for later'}
                  </button>
                </div>
              )}

              {/* Trust strip */}
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 sm:h-10 sm:w-10">
                    <Truck className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">Free shipping</p>
                    <p className="truncate text-xs text-slate-500">On orders over ₹999</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 sm:h-10 sm:w-10">
                    <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">Secure checkout</p>
                    <p className="truncate text-xs text-slate-500">Protected every step</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 sm:h-10 sm:w-10">
                    <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">Easy returns</p>
                    <p className="truncate text-xs text-slate-500">7-day return policy</p>
                  </div>
                </div>
              </div>

              {/* Care Instructions */}
              {product.careInstructions && (
                <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
                  <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2">
                    <Sparkles className="mr-2 inline h-5 w-5 text-purple-600" strokeWidth={2} /> Care Instructions
                  </h3>
                  <p className="text-amber-700">{product.careInstructions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-12 px-4 bg-white/40">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Customer Reviews</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700">
                    {review.user.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{review.user}</p>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 mb-2">{review.comment}</p>
                <p className="text-sm text-gray-500">{new Date(review.date).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">You Might Also Like</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct.id}
                  to={`/product/${relatedProduct.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex h-48 items-center justify-center overflow-hidden bg-slate-100">
                    <img
                      src={relatedProduct.image.startsWith('/images/')
                        ? `${API_BASE_URL}${relatedProduct.image}`
                        : relatedProduct.image}
                      alt={relatedProduct.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="mb-2 line-clamp-2 font-bold text-slate-800 transition-colors group-hover:text-rose-600">
                      {relatedProduct.name}
                    </h3>
                    <p className="text-lg font-black text-slate-950">
                      ₹{relatedProduct.price.toLocaleString('en-IN')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
