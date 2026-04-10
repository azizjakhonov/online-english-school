import axios from 'axios';
import storage from '../lib/storage';

import { Platform } from 'react-native';

// On web, the browser runs on localhost so reach Django directly.
// On native, use the .env URL (LAN IP) or fall back to production.
export const BRIDGE_BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.allright.uz');

const client = axios.create({
  baseURL: BRIDGE_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT access token to every request
client.interceptors.request.use(
  async (config) => {
    const token = await storage.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track whether a token refresh is already in progress to avoid concurrent refreshes
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

const processQueue = (error: any, token: string | null = null) => {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
};

// Response interceptor: on 401, attempt silent token refresh before giving up
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request until the refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(client(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await storage.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(
          `${BRIDGE_BASE_URL}/api/token/refresh/`,
          { refresh: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const newAccessToken: string = res.data.access;
        await storage.setItemAsync('access_token', newAccessToken);

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear tokens and force logout
        console.warn('Token refresh failed. Clearing session.');
        processQueue(refreshError, null);
        await storage.deleteItemAsync('access_token');
        await storage.deleteItemAsync('refresh_token');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
