// =============================================================================
// productApi
//
// Backend: services/product-service (Spring Boot, port 8082).
// All endpoints are routed through api-gateway at `${API_BASE_URL}/api/products`.
// =============================================================================

import axios from 'axios';
import { API_BASE_URL } from '../constants';

const PRODUCT_API = axios.create({
  baseURL: `${API_BASE_URL}/api/products`,
  headers: { 'Content-Type': 'application/json' },
});

const bearer = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

// -----------------------------------------------------------------------------
// Types — mirror the JPA entity in
// services/product-service/.../domain/Product.java
// -----------------------------------------------------------------------------

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText?: string | null;
  position: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
}

export interface Product {
  /** UUID — keep as string everywhere on the frontend. */
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string | null;
  brand?: string | null;
  /** Price in the smallest currency unit (paise for INR). Divide by 100 for ₹. */
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  category?: Category | null;
  /** Primary image URL — backward-compat with storefront. */
  image: string;
  images?: ProductImage[];
  /** Denormalized average rating, kept up-to-date by review-service via Kafka. */
  avgRating: number;
  reviewCount: number;
  /** Sum of delivered order line quantities. */
  soldCount: number;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  featured: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
}

// -----------------------------------------------------------------------------
// Catalog (public)
// -----------------------------------------------------------------------------

/** `GET /api/products` — admin/all list. Returns a flat array. */
export const getProducts = () =>
  PRODUCT_API.get<Product[]>('').then(r => r.data);

/** `GET /api/products/{id}` — single product by UUID. */
export const getProduct = (id: string) =>
  PRODUCT_API.get<Product>(`/${encodeURIComponent(id)}`).then(r => r.data);

/** `GET /api/products/count` — admin-only total count. */
export const getProductCount = (token?: string) =>
  PRODUCT_API.get<number>('/count', bearer(token)).then(r => r.data);

// -----------------------------------------------------------------------------
// Admin mutations
// -----------------------------------------------------------------------------

export interface CreateProductPayload {
  name: string;
  description: string;
  price: number; // paise
  stock: number;
  categoryId?: string;
  shortDescription?: string;
  brand?: string;
  compareAtPrice?: number;
  currency?: string;
  image?: File;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  shortDescription?: string;
  brand?: string;
  price?: number;
  compareAtPrice?: number;
  stock?: number;
  active?: boolean;
  featured?: boolean;
  categoryId?: string;
}

/**
 * `POST /api/products/create-with-image` — multipart/form-data.
 *
 * Backend Spring controller expects these parts:
 *   - name (required)
 *   - description (required)
 *   - price (required, paise)
 *   - stock (optional)
 *   - categoryId (optional, UUID)
 *   - file (required, image)
 */
export const createProductWithImage = (payload: CreateProductPayload, token?: string) => {
  const form = new FormData();
  form.append('name', payload.name);
  form.append('description', payload.description);
  form.append('price', String(payload.price));
  if (payload.stock != null) form.append('stock', String(payload.stock));
  if (payload.categoryId) form.append('categoryId', payload.categoryId);
  if (payload.image) form.append('file', payload.image);
  if (payload.brand) form.append('brand', payload.brand);
  if (payload.shortDescription) form.append('shortDescription', payload.shortDescription);
  if (payload.compareAtPrice != null) form.append('compareAtPrice', String(payload.compareAtPrice));
  if (payload.currency) form.append('currency', payload.currency);

  return PRODUCT_API.post<Product>('/create-with-image', form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(r => r.data);
};

/** `PUT /api/products/{id}` — partial JSON update (admin). */
export const updateProduct = (id: string, payload: UpdateProductPayload, token?: string) =>
  PRODUCT_API.put<Product>(`/${encodeURIComponent(id)}`, payload, bearer(token)).then(r => r.data);

/** `DELETE /api/products/{id}` — admin only. */
export const deleteProduct = (id: string, token?: string) =>
  PRODUCT_API.delete<void>(`/${encodeURIComponent(id)}`, bearer(token)).then(r => r.data);
