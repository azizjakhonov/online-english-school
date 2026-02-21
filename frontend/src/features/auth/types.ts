// frontend/src/features/auth/types.ts

export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: 'student' | 'teacher' | 'admin';
  profile_picture_url?: string | null;
  timezone?: string | null;
}

export interface AuthResponse {
  access: string;
  refresh: string;
}