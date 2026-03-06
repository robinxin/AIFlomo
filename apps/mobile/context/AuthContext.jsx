import { createContext, useContext, useReducer, useEffect } from 'react';
import { api } from '@/lib/api-client';

const initialState = {
  user: null,
  isLoading: true, // true 直到 session 检查完成
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { ...state, isLoading: false, user: action.payload, error: null };
    case 'LOGIN_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'REGISTER_START':
      return { ...state, isLoading: true, error: null };
    case 'REGISTER_SUCCESS':
      return { ...state, isLoading: false, user: action.payload, error: null };
    case 'REGISTER_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'LOGOUT':
      return { ...state, user: null, error: null };
    case 'FETCH_USER_SUCCESS':
      return { ...state, user: action.payload, isLoading: false, error: null };
    case 'FETCH_USER_ERROR':
      return { ...state, user: null, isLoading: false, error: null };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 应用启动时检查已有 session，恢复登录状态
  useEffect(() => {
    api.get('/api/auth/me')
      .then((user) => dispatch({ type: 'FETCH_USER_SUCCESS', payload: user }))
      .catch(() => dispatch({ type: 'FETCH_USER_ERROR' }));
  }, []);

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
