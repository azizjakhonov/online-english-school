import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import storage from '../../lib/storage';
import client from '../../api/client';

export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    phone_number?: string;
    avatar?: string;
    profile_picture_url?: string;
    student_profile?: {
        lesson_credits: number;
        available_credits?: number;
        level?: string;
        goals?: string;
    };
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (phone: string, code: string) => Promise<boolean>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    selectRole: (role: 'STUDENT' | 'TEACHER', fullName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = await storage.getItemAsync('access_token');
                if (token) {
                    const response = await client.get('/api/me/');
                    setUser(response.data);
                }
            } catch (error: any) {
                // If 401/403, just clear everything and go to login silently
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.log('Session expired or unauthorized. Logging out.');
                } else {
                    console.error('Check auth failed:', error);
                }
                await storage.deleteItemAsync('access_token');
                await storage.deleteItemAsync('refresh_token');
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    const login = async (phone: string, code: string): Promise<boolean> => {
        const response = await client.post('/api/accounts/verify-otp/', { phone, code });

        const { access, refresh, is_new_user } = response.data;
        await storage.setItemAsync('access_token', access);
        await storage.setItemAsync('refresh_token', refresh);

        if (!is_new_user) {
            const userResponse = await client.get('/api/me/');
            setUser(userResponse.data);
        }

        return is_new_user;
    };

    const selectRole = async (role: 'STUDENT' | 'TEACHER', fullName: string) => {
        await client.post('/api/accounts/select-role/', {
            role: role.toLowerCase(),
            full_name: fullName,
        });
        const userResponse = await client.get('/api/me/');
        setUser(userResponse.data);
    };

    const logout = async () => {
        await storage.deleteItemAsync('access_token');
        await storage.deleteItemAsync('refresh_token');
        setUser(null);
    };

    const refreshUser = async () => {
        try {
            const response = await client.get('/api/me/');
            setUser(response.data);
        } catch (error: any) {
            if (error.response?.status === 401) {
                console.log('Refresh user failed: Unauthorized/Expired');
                setUser(null);
            } else {
                console.error('Refresh user failed:', error);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, selectRole }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
