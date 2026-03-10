import { useCallback } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

export function useAuth() {
  const { state, dispatch } = useAuthContext();

  const checkSession = useCallback(async () => {
    dispatch({ type: 'AUTH_INIT' });
    try {
      const user = await api.get('/api/auth/me');
      dispatch({ type: 'AUTH_INIT_DONE', payload: user });
    } catch {
      dispatch({ type: 'AUTH_INIT_DONE', payload: null });
    }
  }, [dispatch]);

  const login = useCallback(async (email, password) => {
    const user = await api.post('/api/auth/login', { email, password });
    dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    return user;
  }, [dispatch]);

  const register = useCallback(async (email, password, nickname) => {
    const user = await api.post('/api/auth/register', { email, password, nickname });
    dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    return user;
  }, [dispatch]);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout', {});
    dispatch({ type: 'LOGOUT' });
  }, [dispatch]);

  return {
    user: state.user,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    checkSession,
    login,
    register,
    logout,
  };
}
