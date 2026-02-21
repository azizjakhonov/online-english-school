import axios from 'axios';

// 1. Create the base connection
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
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