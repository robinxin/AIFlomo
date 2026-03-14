/**
 * AuthContext — global authentication state management
 *
 * Provides:
 *   - loading: boolean (true while checking session on mount)
 *   - isAuthenticated: boolean
 *   - user: { id, email, nickname, createdAt } | null
 *   - login(email, password): async — throws on failure
 *   - register(email, nickname, password, agreedToPrivacy): async — throws on failure
 *   - logout(): async — throws on failure
 *
 * Usage:
 *   Wrap app in <AuthProvider>.
 *   Access state and actions via useAuth() hook.
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const initialState = {
  loading: true,
  isAuthenticated: false,
  user: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload,
      };
    case 'AUTH_INIT_FAILURE':
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
      };
    case 'AUTH_LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
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

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const json = await response.json();
          dispatch({ type: 'AUTH_INIT_SUCCESS', payload: json.data });
        } else {
          dispatch({ type: 'AUTH_INIT_FAILURE' });
        }
      } catch {
        dispatch({ type: 'AUTH_INIT_FAILURE' });
      }
    }
    checkSession();
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
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || json.message || '登录失败');
    }
    dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: json.data });
    return json.data;
  }

  /**
   * Register a new account.
   * Throws an Error with the server's error message on failure.
   */
  async function register(email, nickname, password, agreedToPrivacy) {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nickname, password, agreedToPrivacy }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || json.message || '注册失败');
    }
    dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: json.data });
    return json.data;
  }

  /**
   * Logout current session.
   * Throws an Error on network or server failure.
   */
  async function logout() {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || json.message || '登出失败');
      }
      dispatch({ type: 'AUTH_LOGOUT' });
    } catch (err) {
      throw err;
    }
  }

  const value = {
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useAuth — access authentication context.
 * Must be called within an AuthProvider.
 * @throws {Error} if called outside AuthProvider
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export default AuthProvider;
