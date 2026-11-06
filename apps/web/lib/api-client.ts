"use client";

import axios from "axios";
import { getClientToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Axios instance para llamadas client-side a la API Laravel.
 * Inyecta automáticamente el Bearer token desde la cookie.
 */
export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getClientToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("[apiClient] 401 — token inválido o expirado");
    }
    return Promise.reject(error);
  }
);
