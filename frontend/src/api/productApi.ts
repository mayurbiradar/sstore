export const getProductCount = (token?: string) => PRODUCT_API.get("/count", token ? { headers: { Authorization: `Bearer ${token}` } } : {});

import axios from "axios";
import { API_BASE_URL } from "../constants";

const PRODUCT_API = axios.create({
  baseURL: `${API_BASE_URL}/api/products`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getProducts = () => PRODUCT_API.get("");
export const getProduct = (id: string | number) => PRODUCT_API.get(`/${id}`);
export const createProductWithImage = (data: any, token?: string) => {
  // Accept FormData directly from caller
  return PRODUCT_API.post("/create-with-image", data, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};
export const updateProduct = (id: string | number, data: any, token?: string) => PRODUCT_API.put(`/${id}`, data, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const deleteProduct = (id: string | number, token?: string) => PRODUCT_API.delete(`/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
