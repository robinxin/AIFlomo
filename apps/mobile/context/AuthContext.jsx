import { createContext, useContext, useReducer, useEffect } from 'react';
import { api } from '@/lib/api-client';

// 初始状态
const initialState = {
  user: null,
  isLoading: true,
  error: null,
};

// Reducer（纯函数，无副作用）
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
      return { ...state, isLoading: false, user: action.payload, error: null };
    case 'FETCH_USER_ERROR':
      return { ...state, isLoading: false, user: null, error: null };
    default:
      return state;
  }
}

// Context 创建
const AuthContext = createContext(null);

// Provider
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 初始化时尝试获取当前用户信息（检查是否已登录）
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const user = await api.get('/api/auth/me');
        dispatch({ type: 'FETCH_USER_SUCCESS', payload: user });
      } catch {
        dispatch({ type: 'FETCH_USER_ERROR' });
      }
    }
    fetchCurrentUser();
  }, []);

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

// 自定义 Hook（统一访问入口）
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
