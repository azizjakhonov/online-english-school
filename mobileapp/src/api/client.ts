import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// CHANGE THIS to your actual backend local IP adress when running on physical device
// Android Emulator uses 10.0.2.2. Currently using detected local IP: 192.168.1.30
const LOCAL_IP = '192.168.1.30';
export const BRIDGE_BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : `http://${LOCAL_IP}:8000`;

const client = axios.create({
  baseURL: BRIDGE_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
client.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 Unauthorized
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Token is likely expired or invalid
      console.warn('Axios 401 detected. Clearing tokens.');
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      // The app will react to the missing token in AuthContext or RootNavigator
    }
    return Promise.reject(error);
  }
);

export default client;
