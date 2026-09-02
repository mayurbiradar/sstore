export const getMyOrders = (token?: string) => ORDER_API.get("/my", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const getTotalRevenue = (token?: string) =>
  ORDER_API.get("/revenue", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const getOrderCount = (token?: string) =>
  ORDER_API.get("/count", token ? { headers: { Authorization: `Bearer ${token}` } } : {});

import axios from "axios";
import { API_BASE_URL } from "../constants";

const ORDER_API = axios.create({
  baseURL: `${API_BASE_URL}/api/orders`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getOrders = (token?: string) => ORDER_API.get("", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const createOrder = (data: any, token?: string) => ORDER_API.post("", data, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const createStripeSession = (data: any, token?: string) => ORDER_API.post("/stripe/session", data, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const confirmStripePayment = (orderId: string, sessionId: string, token?: string) => ORDER_API.get(`/stripe/confirm?order_id=${encodeURIComponent(orderId)}&session_id=${encodeURIComponent(sessionId)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
