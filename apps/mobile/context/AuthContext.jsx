/**
 * AuthContext.jsx
 *
 * Global authentication state management for AIFlomo.
 *
 * Provides:
 *  - authReducer: pure function handling AUTH_INIT_SUCCESS, AUTH_INIT_FAILURE,
 *    AUTH_LOGIN_SUCCESS, AUTH_LOGOUT actions
 *  - AuthProvider: React context provider that initialises auth state on mount
 *    by calling GET /api/auth/me, and exposes login / register / logout methods
 *  - useAuth: custom hook to consume the auth context (throws outside Provider)
 *
 * State shape:
 *  {
 *    user: null | { id, email, nickname, createdAt },
 *    isAuthenticated: boolean,
 *    loading: boolean,  // true during initial GET /api/auth/me
 *  }
 *
 * Usage:
 *   // Wrap the app root with AuthProvider:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 *
 *   // Consume in any descendant:
 *   const { user, isAuthenticated, loading, login, register, logout } = useAuth();
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { apiClient } from '../lib/api-client.js';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
};

// ---------------------------------------------------------------------------
// Action type constants
// ---------------------------------------------------------------------------

const AUTH_INIT_SUCCESS = 'AUTH_INIT_SUCCESS';
const AUTH_INIT_FAILURE = 'AUTH_INIT_FAILURE';
const AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS';
const AUTH_LOGOUT = 'AUTH_LOGOUT';

// ---------------------------------------------------------------------------
// Reducer (exported for unit-testing)
// ---------------------------------------------------------------------------

/**
 * Pure reducer function for authentication state.
 *
 * @param {object} state  - Current auth state.
 * @param {object} action - Dispatched action ({ type, payload? }).
 * @returns {object} New state (never mutates the input state).
 */
function authReducer(state, action) {
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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * AuthProvider wraps child routes/components and manages global auth state.
 *
 * On mount it calls GET /api/auth/me to restore session state:
 *  - Success → dispatch AUTH_INIT_SUCCESS (loading=false, user set)
 *  - Failure → dispatch AUTH_INIT_FAILURE (loading=false, user=null)
 *
 * It also injects the reducer dispatch into apiClient so the client can
 * dispatch AUTH_INIT_FAILURE automatically on any 401 response.
 *
 * @param {{ children: React.ReactNode }} props
 */
function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Inject dispatch into apiClient for global 401 handling.
  // Must happen before the initAuth effect so the client is ready.
  useEffect(() => {
    apiClient.setDispatch(dispatch);
  }, [dispatch]);

  // Initialise auth state by checking the session on the server.
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        const response = await apiClient.get('/api/auth/me');
        if (!cancelled) {
          dispatch({ type: AUTH_INIT_SUCCESS, payload: { user: response.data } });
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: AUTH_INIT_FAILURE });
        }
      }
    }

    initAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Async auth methods
  // ---------------------------------------------------------------------------

  /**
   * Log in with email and password.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} The authenticated user object.
   * @throws {Error} When credentials are invalid or a network error occurs.
   */
  async function login(email, password) {
    const response = await apiClient.post('/api/auth/login', { email, password });
    dispatch({ type: AUTH_LOGIN_SUCCESS, payload: { user: response.data } });
    return response.data;
  }

  /**
   * Register a new account and immediately authenticate.
   *
   * @param {string} email
   * @param {string} nickname
   * @param {string} password
   * @returns {Promise<object>} The created and authenticated user object.
   * @throws {Error} When registration fails (e.g. email already exists).
   */
  async function register(email, nickname, password) {
    const response = await apiClient.post('/api/auth/register', {
      email,
      nickname,
      password,
      agreedToPrivacy: true,
    });
    dispatch({ type: AUTH_LOGIN_SUCCESS, payload: { user: response.data } });
    return response.data;
  }

  /**
   * Log out the current user.
   *
   * @returns {Promise<void>}
   * @throws {Error} When the logout request fails.
   */
  async function logout() {
    await apiClient.post('/api/auth/logout');
    dispatch({ type: AUTH_LOGOUT });
  }

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

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
// useAuth hook
// ---------------------------------------------------------------------------

/**
 * Consume the AuthContext.
 *
 * Must be called inside a component that is a descendant of AuthProvider.
 *
 * @returns {{ user: object|null, isAuthenticated: boolean, loading: boolean,
 *   login: Function, register: Function, logout: Function }}
 * @throws {Error} When called outside an AuthProvider tree.
 */
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { authReducer, AuthProvider, useAuth };
