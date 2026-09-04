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

export interface Product {
  /** UUID — keep as string everywhere on the frontend. */
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  /** Price in the smallest currency unit (paise for INR). Divide by 100 for ₹. */
  price: number;
  currency: string;
  /** Primary image URL — relative ("/images/xxx.jpg") when served via the gateway/static dir. */
  image: string;
  /** Denormalized average rating, kept up-to-date by review-service via Kafka. */
  avgRating: number;
  reviewCount: number;
  /** Sum of delivered order line quantities. */
  soldCount: number;
  stock: number;
  /** Whether the product line incurs tax. */
  taxable: boolean;
  /** First time the product moved to ACTIVE. */
  publishedAt?: string | null;
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
}

// -----------------------------------------------------------------------------
// Catalog (public)
// -----------------------------------------------------------------------------

/**
 * `GET /api/products/visible` — storefront-only flat list. Always returns
 * only rows where `active = true AND deletedAt IS NULL`, regardless of the
 * caller's JWT roles. Use for Home, Collection, ProductDetail and any other
 * public surface.
 *
 * Pass `{ featured: true }` to restrict to featured products (Home page tile).
 */
export const getVisibleProducts = (params: { featured?: boolean } = {}) =>
  PRODUCT_API.get<Product[]>('/visible', { params }).then(r => r.data);

/**
 * `GET /api/products/all` — admin-only flat list of every product (including
 * inactive drafts and soft-deleted rows). Use from admin dashboards only;
 * the storefront should call {@link getVisibleProducts} above.
 *
 * Note: `GET /api/products` returns a Spring `Page<Product>` envelope
 * ({ content: Product[], totalElements, ... }), intended for the rich admin
 * search endpoint.
 */
export const getProductsForAdmin = (token?: string) =>
  PRODUCT_API.get<Product[]>('/all', bearer(token)).then(r => r.data);

/** @deprecated Use {@link getVisibleProducts} for the storefront or
 *  {@link getProductsForAdmin} from the admin dashboard. Kept as an alias
 *  for legacy callers; defaults to the visible-only endpoint to keep the
 *  storefront airtight. */
export const getProducts = getVisibleProducts;

/** `GET /api/products/{id}` — single product by UUID.
 *  Pass the JWT when called from the admin context (edit page, etc.) so the
 *  server returns inactive drafts; otherwise anonymous calls will get 404
 *  for drafts and soft-deleted rows. */
export const getProduct = (id: string, token?: string) =>
  PRODUCT_API.get<Product>(`/${encodeURIComponent(id)}`, bearer(token)).then(r => r.data);

/** `GET /api/products/count` — admin-only total count. */
export const getProductCount = (token?: string) =>
  PRODUCT_API.get<number>('/count', bearer(token)).then(r => r.data);

/**
 * `GET /api/products` — paginated admin search. Returns a Spring `Page`
 * envelope with `content: Product[]`, `totalElements`, `number`, etc.
 *
 * Used by the admin catalog UI when it needs filtering/pagination; the
 * storefront keeps using `getProducts()` above.
 */
export interface ProductPage {
  content: Product[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface SearchProductsParams {
  q?: string;
  active?: boolean;
  featured?: boolean;
  stock?: 'ANY' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  size?: number;
  sort?: string;
}

export const searchProducts = (params: SearchProductsParams = {}, token?: string) => {
  const search: Record<string, string | number | boolean | string[]> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      search[k] = Array.isArray(v) ? v.join(',') : v;
    }
  });
  return PRODUCT_API.get<ProductPage>('', { params: search, ...bearer(token) }).then(r => r.data);
};

// -----------------------------------------------------------------------------
// Admin mutations
// -----------------------------------------------------------------------------

/**
 * Payload for `createProductWithImage`. Only `name` is required; supply
 * either a single `image` or an `images` array (one of them must be set,
 * backend requires at least one).
 */
export interface CreateProductPayload {
  name: string;
  /** Single primary image (first picked becomes products.image). */
  image?: File;
  /** Additional images, all written to /images; first one is primary. */
  images?: File[];
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  taxable?: boolean;
  active?: boolean;
  featured?: boolean;
}

/**
 * `POST /api/products/create-with-image` — minimal "add product" flow.
 *
 * Backend Spring controller expects:
 *   - name (required)
 *   - file OR files (at least one image required)
 *
 * Product is created as DRAFT, stock=0, price=0. Admin fills everything else
 * in on the edit page (`updateProduct` below).
 */
export const createProductWithImage = (payload: CreateProductPayload, token?: string) => {
  const form = new FormData();
  form.append('name', payload.name);
  if (payload.image) form.append('file', payload.image);
  if (payload.images && payload.images.length > 0) {
    payload.images.forEach(f => form.append('files', f));
  }

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
