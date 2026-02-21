// SPLIT the imports into "Values" and "Types"
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';  // <--- Added "type" here

import api from '../../lib/api';
import type { User, AuthResponse } from './types'; // <--- Added "type" here

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-fetches /api/me/ and updates the in-memory user object. Call after avatar upload. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Check if user is already logged in when the app starts
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          // Verify token by fetching user data
          const response = await api.get('/api/me/');
          setUser(response.data);
        } catch (error) {
          // If token is invalid (expired), clear it
          console.error("Token invalid:", error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  // 2. Login Function
  const login = async (username: string, password: string) => {
    // A. Get Tokens
    const response = await api.post<AuthResponse>('/api/token/', {
      username,
      password,
    });

    const { access, refresh } = response.data;
    
    // B. Save Tokens to Browser
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);

    // C. Get User Details immediately
    const userResponse = await api.get('/api/me/');
    setUser(userResponse.data);
  };

  // 3. Logout Function
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  // 4. Refresh user — re-fetch /api/me/ and update context.
  // Call this after any operation that changes the user object (e.g. avatar upload).
  const refreshUser = async () => {
    try {
      const response = await api.get('/api/me/');
      setUser(response.data);
    } catch (error) {
      console.error('refreshUser failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom Hook to use auth easily
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}