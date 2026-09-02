import axios from "axios";
import { API_BASE_URL } from "../constants";

const USER_API = axios.create({
  baseURL: `${API_BASE_URL}/api/users`,
  headers: {
    "Content-Type": "application/json",
  },
});

const ACCOUNT_API = axios.create({
  baseURL: `${API_BASE_URL}/api/account`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getUsers = async (token?: string) => {
  return USER_API.get("", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
};

export const updateUser = (id: string, data: any, token?: string) => {
  return USER_API.put(`/${id}`, data, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
};

export const deleteUser = (id: string, token?: string) => {
  return USER_API.delete(`/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
};

export const changeUserRole = (id: string, role: string, token?: string) => {
  return updateUser(id, { role }, token);
};

export const getUserCount = (token?: string) => {
  return USER_API.get("/count", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
};

export const updateMyProfile = (data: any, token?: string) => {
  return ACCOUNT_API.put("/profile", data, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
};

export const getMyProfile = (token?: string) => {
  return ACCOUNT_API.get("/profile", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
};
