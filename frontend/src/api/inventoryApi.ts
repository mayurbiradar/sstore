// =============================================================================
// inventoryApi
//
// Backend: services/inventory-service (Spring Boot, port 8085).
// Routed through api-gateway at `${API_BASE_URL}/api/inventory`.
// =============================================================================

import axios from 'axios';
import { API_BASE_URL } from '../constants';

const INVENTORY_API = axios.create({
  baseURL: `${API_BASE_URL}/api/inventory`,
  headers: { 'Content-Type': 'application/json' },
});

const bearer = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

// -----------------------------------------------------------------------------
// Types — mirror services/inventory-service/.../domain/*
// -----------------------------------------------------------------------------

export interface InventoryItem {
  /** productId is the PK. */
  productId: string;
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
}

export interface ReservationLine {
  sku: string;
  productId?: string | null;
  quantity: number;
}

export type ReservationStatus = 'ACTIVE' | 'COMMITTED' | 'RELEASED';

export interface Reservation {
  id: string;
  orderId: string;
  userId: string;
  status: ReservationStatus;
  expiresAt: string;
  committedAt?: string | null;
  releasedAt?: string | null;
  releaseReason?: string | null;
  lines: ReservationLine[];
}

// -----------------------------------------------------------------------------
// Public reads (used by storefront to show live availability)
// -----------------------------------------------------------------------------

/** `GET /api/inventory/items/{sku}` — public availability check. */
export const getInventoryBySku = (sku: string) =>
  INVENTORY_API.get<{ sku: string; productId: string; onHand: number; reserved: number; available: number }>(
    `/items/${encodeURIComponent(sku)}`,
  ).then(r => r.data);

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------

/** `POST /api/inventory/admin/items` — upsert an inventory item. */
export const upsertInventoryItem = (
  payload: { productId: string; sku: string; name: string; onHand: number },
  token?: string,
) =>
  INVENTORY_API.post<InventoryItem>('/admin/items', payload, bearer(token)).then(r => r.data);

/** `GET /api/inventory/admin/items` — full inventory listing. */
export const listInventoryItems = (token?: string) =>
  INVENTORY_API.get<InventoryItem[]>('/admin/items', bearer(token)).then(r => r.data);

/** `GET /api/inventory/admin/summary` — total on-hand across all SKUs. */
export const inventorySummary = (token?: string) =>
  INVENTORY_API.get<{ totalOnHand: number }>('/admin/summary', bearer(token)).then(r => r.data);
