// FILE: glinax-chatbot/src/contexts/AuthContext.tsx
// PURPOSE: Connect to REAL backend API for authentication
// HOW: Replace your entire AuthContext.tsx with this code

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  is_verified?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string; errors?: string[] }>;
  loginAsGuest: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Check for existing session on mount
  useEffect(() => {
    const checkSession = () => {
      console.log('🔍 Checking for existing session...');
      
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const isGuestSession = localStorage.getItem('glinax-guest') === 'true';

      // If there's a real token, restore authenticated session
      if (token) {
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('✅ Auth session restored for user:', userData.name || userData.email);
            setUser(userData);
            setIsAuthenticated(true);
            setIsGuest(false);
          } catch (err) {
            console.error('❌ Failed to parse stored user:', err);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('glinax-guest');
          }
        } else {
          // Token exists but no stored user - keep unauthenticated until user data fetched
          console.warn('Token present but no stored user; user must re-login or fetch profile.');
        }

        return;
      }

      // If no token but guest flag is set, restore guest session explicitly
      if (isGuestSession && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('👤 Restoring guest session');
          setUser(userData);
          setIsGuest(true);
          setIsAuthenticated(false);
        } catch (err) {
          console.error('❌ Failed to parse guest user:', err);
          localStorage.removeItem('user');
          localStorage.removeItem('glinax-guest');
        }
        return;
      }

      console.log('ℹ️ No existing session found');
    };

    checkSession();
  }, []);

  // ✅ LOGIN with real backend
  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔓 Logging in with email:', email);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data.message || 'Login failed';
        console.error('❌ Login failed:', message);
        setError(message);
        return { success: false, message };
      }

      // ✅ Save token and user to localStorage
      console.log('✅ Login successful, saving token and user');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // CRITICAL FIX: Clear guest session completely when real login succeeds
      localStorage.removeItem('glinax-guest');
      
      setUser(data.user);
      setIsAuthenticated(true);
      setIsGuest(false);
      
      console.log('🔄 FIXED: Login completed - Guest mode cleared:', {
        isAuthenticated: true,
        isGuest: false,
        hasToken: true
      });

      return { success: true, message: 'Login successful!' };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      console.error('❌ Login error:', message);
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ SIGNUP with real backend
  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; message: string; errors?: string[] }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📝 Signing up with email:', email);

      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data.message || 'Signup failed';
        console.error('❌ Signup failed:', message, data.errors);
        setError(message);
        // Return both message and errors array for frontend error parsing
        return { 
          success: false, 
          message,
          errors: data.errors || [message]
        };
      }

      // IMPORTANT: Do NOT auto-login after signup. Backend returns success message only.
      console.log('✅ Signup successful - account created (no auto-login)');
      return { success: true, message: data.message || 'Account created successfully, please log in.' };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      console.error('❌ Signup error:', message);
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ LOGIN AS GUEST
  const loginAsGuest = () => {
    console.log('👤 Entering guest mode');

    // Call backend to sign/confirm guest session (no token returned)
    fetch(`${API_BASE_URL}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Guest login failed');

        const guestUser = data.user;
        localStorage.setItem('user', JSON.stringify(guestUser));
        localStorage.setItem('glinax-guest', 'true');

        setUser(guestUser);
        setIsGuest(true);
        setIsAuthenticated(false);
        setError(null);
      })
      .catch((err) => {
        console.error('Guest login error:', err);
        setError(err.message || 'Unable to enter guest mode');
      });
  };

  // ✅ LOGOUT
  const logout = () => {
    console.log('🚪 Logging out');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('glinax-guest');
    
    setUser(null);
    setIsAuthenticated(false);
    setIsGuest(false);
    setError(null);
    
    // Redirect to login
    window.location.href = '/login';
  };

  // ✅ UPDATE PROFILE
  const updateProfile = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      console.log('✅ Profile updated');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isGuest,
    isLoading,
    error,
    login,
    logout,
    signup,
    loginAsGuest,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};