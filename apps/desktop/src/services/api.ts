/**
 * API Client for B-One Maestro Backend
 *
 * Provides centralized HTTP communication with the backend API.
 * All business logic stays in backend - this is just communication.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base URL from Vite env. When running Vite in a container, compose sets VITE_API_BASE_URL
// to http://backend:5000 so the frontend container can reach the backend service by name.
// However the browser (developer's host) cannot resolve the container hostname `backend`.
// To make the same build work for both containerized Vite and local browser access,
// rewrite the hostname to `localhost` when executing in the browser and the host is `backend`.
const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://localhost:5001';
let API_BASE_URL = RAW_API_BASE;

try {
  // Only adjust when running in a browser environment
  if (typeof window !== 'undefined' && RAW_API_BASE) {
    try {
      const parsed = new URL(RAW_API_BASE, window.location.origin);
      if (parsed.hostname === 'backend') {
        parsed.hostname = 'localhost';
        // If compose mapped port 5000, keep it
        API_BASE_URL = parsed.toString().replace(/\/?$/, '');
        if (import.meta.env.DEV) console.log('[API] Rewrote API base from backend to localhost:', API_BASE_URL);
      }
    } catch (e) {
      // If URL parsing fails, fall back to raw value
      API_BASE_URL = RAW_API_BASE;
    }
  }
} catch (e) {
  API_BASE_URL = RAW_API_BASE;
}

/**
 * Error response structure from backend
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Axios instance with configured defaults
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - add auth tokens, logging, etc.
 */
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - handle errors, logging, etc.
 */
axiosInstance.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(
        `[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`,
        response.status
      );
    }
    return response;
  },
  (error: AxiosError<ApiError>) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      console.error(`[API Error ${status}]`, message);

      // Handle specific status codes
      if (status === 401) {
        // Unauthorized - clear auth and redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      } else if (status === 403) {
        // Forbidden
        console.error('Access forbidden');
      } else if (status === 404) {
        // Not found
        console.error('Resource not found');
      } else if (status >= 500) {
        // Server error
        console.error('Server error occurred');
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('[API Network Error] No response received', error.request);
    } else {
      // Something else happened
      console.error('[API Error]', error.message);
    }

    return Promise.reject(error);
  }
);

/**
 * Generic API client with typed methods
 */
export const apiClient = {
  /**
   * GET request
   */
  async get<T>(url: string, config = {}): Promise<T> {
    const response = await axiosInstance.get<T>(url, config);
    return response.data;
  },

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, config = {}): Promise<T> {
    const response = await axiosInstance.post<T>(url, data, config);
    return response.data;
  },

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, config = {}): Promise<T> {
    const response = await axiosInstance.put<T>(url, data, config);
    return response.data;
  },

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, config = {}): Promise<T> {
    const response = await axiosInstance.patch<T>(url, data, config);
    return response.data;
  },

  /**
   * DELETE request
   */
  async delete<T>(url: string, config = {}): Promise<T> {
    const response = await axiosInstance.delete<T>(url, config);
    return response.data;
  },
};

export default apiClient;
