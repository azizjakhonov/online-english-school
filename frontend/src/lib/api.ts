import axios from 'axios';

const _rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = (_rawApiBaseUrl !== undefined
  ? _rawApiBaseUrl.trim()
  : 'https://api.allright.uz').replace(/\/+$/, '');

export function resolveApiUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return API_BASE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

// 1. Create the base connection
// withCredentials is intentionally omitted — auth uses JWT Bearer header, not cookies.
// Setting it to true would require non-wildcard CORS origins on every request, which
// breaks Google Identity Services and other third-party integrations.
const api = axios.create({
  baseURL: API_BASE_URL,
});

// 2. Add the Token to every request (Interceptor)
api.interceptors.request.use((config) => {
  // Check if we have a token saved in the browser
  const token = localStorage.getItem('access_token');

  if (token) {
    // If yes, attach it to the header: "Authorization: Bearer <token>"
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
