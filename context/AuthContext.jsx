/**
 * AuthContext — Global authentication state management
 *
 * Provides:
 *   - user: current logged-in user or null
 *   - isAuthenticated: boolean
 *   - loading: true while initializing (prevents route guard flash)
 *   - login(email, password): async login
 *   - register(email, nickname, password, agreedToPrivacy): async register
 *   - logout(): async logout
 *
 * Usage:
 *   Wrap root layout with <AuthProvider>.
 *   Consume via useAuth() hook in any child component.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
      };
    case 'AUTH_INIT_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'AUTH_LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const BASE_URL = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL
  : 'http://localhost:3000';

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state on mount by checking current session
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: data.data } });
        } else {
          dispatch({ type: 'AUTH_INIT_FAILURE' });
        }
      } catch (_err) {
        if (!cancelled) {
          dispatch({ type: 'AUTH_INIT_FAILURE' });
        }
      }
    }

    initAuth();
    return () => { cancelled = true; };
  }, []);

  /**
   * Login with email and password.
   * Throws an Error with the server's error message on failure.
   */
  async function login(email, password) {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || '登录失败');
    }

    dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: data.data } });
    return data.data;
  }

  /**
   * Register a new account.
   * Throws an Error with the server's error message on failure.
   * @param {string} email
   * @param {string} nickname
   * @param {string} password
   * @param {boolean} agreedToPrivacy
   */
  async function register(email, nickname, password, agreedToPrivacy) {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nickname, password, agreedToPrivacy }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || '注册失败');
    }

    dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: data.data } });
    return data.data;
  }

  /**
   * Logout the current user.
   * Throws an Error on failure.
   */
  async function logout() {
    const response = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || data.message || '登出失败');
    }

    dispatch({ type: 'AUTH_LOGOUT' });
  }

  const contextValue = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export default AuthContext;
