// =============================================================================
// orderApi
//
// Backend: services/order-service (Spring Boot, port 8083).
// Routed through api-gateway at `${API_BASE_URL}/api/orders`.
// Payment-service is called from order-service for the Razorpay session.
// =============================================================================

import axios from 'axios';
import { API_BASE_URL } from '../constants';

const ORDER_API = axios.create({
  baseURL: `${API_BASE_URL}/api/orders`,
  headers: { 'Content-Type': 'application/json' },
});

const PAYMENT_API = axios.create({
  baseURL: `${API_BASE_URL}/api/payments`,
  headers: { 'Content-Type': 'application/json' },
});

const bearer = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

// -----------------------------------------------------------------------------
// Types — mirror JPA entities in services/order-service/.../domain/
// -----------------------------------------------------------------------------

export interface Address {
  id?: string;
  userId?: string;
  label?: string | null;
  firstName: string;
  lastName: string;
  /** Optional — Keycloak users signed up via Google may not have a phone yet. */
  email?: string;
  phone?: string;
  /** Street address (line 1). */
  address: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  /** ISO-3166-1 alpha-2 country code. */
  country?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id?: string;
  productId: string;
  sku: string;
  productName: string;
  /** Price in smallest currency unit at the time of purchase. */
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

export interface Order {
  id: string;
  userId: string;
  address: Address;
  /** PLACED -> CONFIRMED -> PACKED -> SHIPPED -> DELIVERED | CANCELLED | RETURNED. */
  status: string;
  /** PENDING | PAID | FAILED | REFUNDED — denormalized from payment-service. */
  paymentStatus: string;
  paymentMethod?: 'COD' | 'ONLINE' | null;
  paymentId?: string | null;
  /** Total amount in paise (smallest currency unit). */
  totalAmount: number;
  currency: string;
  notes?: string | null;
  placedAt?: string;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items: OrderItem[];
}

// -----------------------------------------------------------------------------
// Order lifecycle
// -----------------------------------------------------------------------------

/** `GET /api/orders` — admin only (lists every order). */
export const listOrders = (token?: string) =>
  ORDER_API.get<Order[]>('', bearer(token)).then(r => r.data);

/** `GET /api/orders/{id}` — admin or owner. */
export const getOrderById = (orderId: string, token?: string) =>
  ORDER_API.get<Order>(`/${encodeURIComponent(orderId)}`, bearer(token)).then(r => r.data);

/** `GET /api/orders/my` — current user's orders. */
export const getMyOrders = (token?: string) =>
  ORDER_API.get<Order[]>('/my', bearer(token)).then(r => r.data);

/** `GET /api/orders/count` — admin. */
export const getOrderCount = (token?: string) =>
  ORDER_API.get<number>('/count', bearer(token)).then(r => r.data);

/** `GET /api/orders/revenue` — admin. */
export const getTotalRevenue = (token?: string) =>
  ORDER_API.get<number>('/revenue', bearer(token)).then(r => r.data);

// -----------------------------------------------------------------------------
// Order creation
// -----------------------------------------------------------------------------

export interface CreateOrderPayload {
  address: Address;
  items: Array<Pick<OrderItem, 'productId' | 'sku' | 'productName' | 'price' | 'quantity' | 'image'>>;
  /** `COD` (cash on delivery) or `ONLINE` (Razorpay). */
  paymentMethod: 'COD' | 'ONLINE';
  currency?: string;
  notes?: string;
}

/**
 * `POST /api/orders` — create an order.
 * The controller pulls userId from the JWT, so we don't send it.
 * totalAmount is computed server-side from items + tax; do not send it.
 */
export const createOrder = (payload: CreateOrderPayload, token?: string) =>
  ORDER_API.post<Order>('', payload, bearer(token)).then(r => r.data);

/**
 * `POST /api/orders/{id}/payment-session` — start a Razorpay session.
 * Returns the data needed to open the Razorpay widget.
 */
export interface RazorpaySession {
  paymentId: string;
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  customer?: { name?: string; email?: string; contact?: string };
}

export const startOnlinePaymentSession = (orderId: string, token?: string) =>
  ORDER_API.post<RazorpaySession>(
    `/${encodeURIComponent(orderId)}/payment-session`,
    {},
    bearer(token),
  ).then(r => r.data);

// -----------------------------------------------------------------------------
// Admin status transitions
// -----------------------------------------------------------------------------

/**
 * `PATCH /api/orders/{id}/status?to=<STATUS>` — admin-only.
 * Valid: PLACED|CONFIRMED|PACKED|SHIPPED|DELIVERED|CANCELLED|RETURNED
 */
export const transitionOrderStatus = (
  id: string,
  to: string,
  token?: string,
) =>
  ORDER_API.patch<Order>(
    `/${encodeURIComponent(id)}/status`,
    null,
    { ...bearer(token), params: { to } },
  ).then(r => r.data);

// -----------------------------------------------------------------------------
// Address management
// -----------------------------------------------------------------------------

export const getMyAddresses = (token?: string) =>
  ORDER_API.get<Address[]>(`/users/me/addresses`, bearer(token)).then(r => r.data);

export const createAddress = (address: Address, token?: string) =>
  ORDER_API.post<Address>('/users/me/addresses', address, bearer(token)).then(r => r.data);

export const updateAddress = (addressId: string, address: Address, token?: string) =>
  ORDER_API.put<Address>(
    `/users/me/addresses/${encodeURIComponent(addressId)}`,
    address,
    bearer(token),
  ).then(r => r.data);

export const deleteAddress = (addressId: string, token?: string) =>
  ORDER_API.delete<void>(`/users/me/addresses/${encodeURIComponent(addressId)}`, bearer(token)).then(r => r.data);

// -----------------------------------------------------------------------------
// Payments — routed through api-gateway to payment-service (port 8084)
// -----------------------------------------------------------------------------

/**
 * `POST /api/payments/razorpay/verify` — confirm the signature after a
 * successful Razorpay widget payment. Returns `{ paymentId, status }`.
 */
export const verifyRazorpayPayment = (
  data: { paymentId: string; razorpayPaymentId: string; razorpaySignature: string },
  token?: string,
) =>
  PAYMENT_API.post<{ paymentId: string; status: string }>('/razorpay/verify', data, bearer(token)).then(r => r.data);

/** `POST /api/payments/{id}/refund?amount=...` — admin only. */
export const refundPayment = (id: string, amount?: number, token?: string) =>
  PAYMENT_API.post(`/razorpay/${encodeURIComponent(id)}/refund`,
    null,
    { ...bearer(token), params: amount != null ? { amount } : {} },
  );
