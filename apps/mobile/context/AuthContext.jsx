import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { apiClient } from '../lib/api-client.js';

// ── Initial state ──────────────────────────────────────────────────────────────
const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true, // Start true to prevent route guard flash
};

// ── Action types ───────────────────────────────────────────────────────────────
const AUTH_INIT_SUCCESS = 'AUTH_INIT_SUCCESS';
const AUTH_INIT_FAILURE = 'AUTH_INIT_FAILURE';
const AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS';
const AUTH_LOGOUT = 'AUTH_LOGOUT';

// ── Reducer ────────────────────────────────────────────────────────────────────
export function authReducer(state, action) {
  switch (action.type) {
    case AUTH_INIT_SUCCESS:
      return {
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
      };

    case AUTH_INIT_FAILURE:
      return {
        user: null,
        isAuthenticated: false,
        loading: false,
      };

    case AUTH_LOGIN_SUCCESS:
      return {
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
      };

    case AUTH_LOGOUT:
      return {
        user: null,
        isAuthenticated: false,
        loading: false,
      };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Provider ───────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize: check if user is already logged in
  useEffect(() => {
    apiClient
      .get('/api/auth/me')
      .then((response) => {
        dispatch({ type: AUTH_INIT_SUCCESS, payload: { user: response.data } });
      })
      .catch(() => {
        dispatch({ type: AUTH_INIT_FAILURE });
      });
  }, []);

  /**
   * Log in with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} User object
   * @throws {Error} On authentication failure
   */
  async function login(email, password) {
    const response = await apiClient.post('/api/auth/login', { email, password });
    dispatch({ type: AUTH_LOGIN_SUCCESS, payload: { user: response.data } });
    return response.data;
  }

  /**
   * Register a new account.
   * @param {string} email
   * @param {string} nickname
   * @param {string} password
   * @param {boolean} agreedToPrivacy
   * @returns {Promise<object>} User object
   * @throws {Error} On registration failure
   */
  async function register(email, nickname, password, agreedToPrivacy) {
    const response = await apiClient.post('/api/auth/register', {
      email,
      nickname,
      password,
      agreedToPrivacy,
    });
    dispatch({ type: AUTH_LOGIN_SUCCESS, payload: { user: response.data } });
    return response.data;
  }

  /**
   * Log out the current user.
   * @returns {Promise<void>}
   */
  async function logout() {
    await apiClient.post('/api/auth/logout');
    dispatch({ type: AUTH_LOGOUT });
  }

  const value = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    login,
    register,
    logout,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ── Hook ───────────────────────────────────────────────────────────────────────
/**
 * useAuth - Access authentication context.
 * @returns {{ user, isAuthenticated, loading, login, register, logout }}
 * @throws {Error} When used outside AuthProvider
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
