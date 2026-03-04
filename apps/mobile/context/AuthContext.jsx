import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

const initialState = {
  user: null,
  isLoading: true,
  isAuthenticating: false,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'RESTORE_SESSION':
      return { ...state, user: action.payload, isLoading: false };
    case 'LOGIN_START':
      return { ...state, isAuthenticating: true, error: null };
    case 'LOGIN_SUCCESS':
      return { ...state, user: action.payload, isAuthenticating: false, error: null };
    case 'LOGIN_ERROR':
      return { ...state, isAuthenticating: false, error: action.payload };
    case 'LOGOUT_SUCCESS':
      return { ...state, user: null, isAuthenticating: false, error: null };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    api.get('/auth/me')
      .then((data) => dispatch({ type: 'RESTORE_SESSION', payload: data }))
      .catch(() => dispatch({ type: 'RESTORE_SESSION', payload: null }));
  }, []);

  const login = useCallback(async (username, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const data = await api.post('/auth/login', { username, password });
      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
      return { success: true };
    } catch (err) {
      const message = err.message || '登录失败';
      dispatch({ type: 'LOGIN_ERROR', payload: message });
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // ignore
    }
    dispatch({ type: 'LOGOUT_SUCCESS' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
