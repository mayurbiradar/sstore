// =============================================================================
// userApi
//
// Backend: services/api-gateway (port 9090).
// - /api/users/**   → proxied by gateway to Keycloak Admin REST API
//                     (admin-only: findAll, count, update, delete).
// - /api/account/** → proxied to Keycloak but bound to the JWT subject.
//                     (authenticated: getMyProfile, updateMyProfile).
// =============================================================================

import axios from 'axios';
import { API_BASE_URL } from '../constants';

const USER_API = axios.create({
  baseURL: `${API_BASE_URL}/api/users`,
  headers: { 'Content-Type': 'application/json' },
});

const ACCOUNT_API = axios.create({
  baseURL: `${API_BASE_URL}/api/account`,
  headers: { 'Content-Type': 'application/json' },
});

const bearer = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

// -----------------------------------------------------------------------------
// Types — the Keycloak Admin REST user representation with role flattened.
// `KeycloakUserService.findAll()` augments each user with `role` (ADMIN|USER)
// and a flattened `phone` (Keycloak stores it as `attributes.phone[0]`).
// -----------------------------------------------------------------------------

export interface KeycloakUser {
  /** Keycloak user id (UUID string). */
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  /** Flattened from Keycloak role-mapping + attribute list. */
  role: 'ADMIN' | 'USER';
  phone?: string;
  attributes?: Record<string, string[]>;
  createdTimestamp?: number;
}

/** Update payload accepted by `PUT /api/users/{id}` (and `/api/account/profile`). */
export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  /** Server ignores this on the self-update endpoint. */
  role?: 'ADMIN' | 'USER';
}

// -----------------------------------------------------------------------------
// Admin: /api/users/**
// -----------------------------------------------------------------------------

export const getUsers = (token?: string) =>
  USER_API.get<KeycloakUser[]>('', bearer(token)).then(r => r.data);

export const getUserCount = (token?: string) =>
  USER_API.get<number>('/count', bearer(token)).then(r => r.data);

export const updateUser = (id: string, payload: UpdateUserPayload, token?: string) =>
  USER_API.put<KeycloakUser>(`/${encodeURIComponent(id)}`, payload, bearer(token)).then(r => r.data);

export const deleteUser = (id: string, token?: string) =>
  USER_API.delete<void>(`/${encodeURIComponent(id)}`, bearer(token)).then(r => r.data);

// -----------------------------------------------------------------------------
// Self: /api/account/**
// -----------------------------------------------------------------------------

export const getMyProfile = (token?: string) =>
  ACCOUNT_API.get<KeycloakUser>('/profile', bearer(token)).then(r => r.data);

export const updateMyProfile = (payload: UpdateUserPayload, token?: string) =>
  ACCOUNT_API.put<KeycloakUser>('/profile', payload, bearer(token)).then(r => r.data);
