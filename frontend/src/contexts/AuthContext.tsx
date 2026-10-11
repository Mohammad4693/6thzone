import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import client from '../api/client';

interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'MEMBER' | 'MENTOR' | 'ADMIN';
  phoneVerified: string;
  profile?: any;
  mentorProfile?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('seraj_token');
    const savedUser = localStorage.getItem('seraj_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Verify token still valid
      client.get('/auth/me').then(res => {
        setUser(res.data);
        localStorage.setItem('seraj_user', JSON.stringify(res.data));
      }).catch(() => {
        localStorage.removeItem('seraj_token');
        localStorage.removeItem('seraj_user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('seraj_token', token);
    localStorage.setItem('seraj_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('seraj_token');
    localStorage.removeItem('seraj_user');
    setUser(null);
  };

  const refresh = async () => {
    try {
      const res = await client.get('/auth/me');
      setUser(res.data);
      localStorage.setItem('seraj_user', JSON.stringify(res.data));
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
