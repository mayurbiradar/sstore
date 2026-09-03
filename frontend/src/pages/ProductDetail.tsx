import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Gem, Star, Check, ShoppingCart, Sparkles, ChevronRight, Home as HomeIcon } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getProduct, getProducts } from '../api/productApi';
import { API_BASE_URL } from '../constants';

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

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= product!.stock) {
      setQuantity(newQuantity);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50/30 flex items-center justify-center">
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
              {/* Main Image */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <img
                  src={productImages[selectedImage]?.startsWith('/images/')
                    ? `${API_BASE_URL}${productImages[selectedImage]}`
                    : productImages[selectedImage] || imageUrl}
                  alt={product.name}
                  className="w-full h-96 lg:h-[500px] object-cover"
                />
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
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
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
                          className="w-10 h-10 flex items-center justify-center bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                        >
                          −
                        </button>
                        <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(quantity + 1)}
                          disabled={quantity >= product.stock}
                          className="w-10 h-10 flex items-center justify-center bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        ₹{(product.price * quantity).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleAddToCart}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transform hover:scale-105 transition-all duration-300"
                  >
                    {addedToCart ? <><Check className="mr-2 inline h-5 w-5" strokeWidth={3} /> Added to Cart</> : <><ShoppingCart className="mr-2 inline h-5 w-5" strokeWidth={2.5} /> Add to Cart</>}
                  </button>
                </div>
              )}

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
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                    {review.user.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{review.user}</p>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                          ⭐
                        </span>
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
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 overflow-hidden"
                >
                  <div className="bg-gradient-to-br from-purple-100 to-pink-100 h-48 flex items-center justify-center overflow-hidden">
                    <img
                      src={relatedProduct.image.startsWith('/images/')
                        ? `${API_BASE_URL}${relatedProduct.image}`
                        : relatedProduct.image}
                      alt={relatedProduct.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-purple-700 transition-colors">
                      {relatedProduct.name}
                    </h3>
                    <p className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
