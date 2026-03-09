import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

export function useAuthActions() {
  const { dispatch } = useAuth();

  const register = useCallback(async (email, nickname, password) => {
    dispatch({ type: 'REGISTER_START' });
    try {
      const user = await api.post('/api/auth/register', {
        email,
        nickname,
        password,
        agreePolicy: true,
      });
      dispatch({ type: 'REGISTER_SUCCESS', payload: user });
      return { success: true, user };
    } catch (err) {
      dispatch({ type: 'REGISTER_ERROR', payload: err.message });
      return { success: false, error: err.message };
    }
  }, [dispatch]);

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const user = await api.post('/api/auth/login', {
        email,
        password,
      });
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return { success: true, user };
    } catch (err) {
      dispatch({ type: 'LOGIN_ERROR', payload: err.message });
      return { success: false, error: err.message };
    }
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
      dispatch({ type: 'LOGOUT' });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [dispatch]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const user = await api.get('/api/auth/me');
      dispatch({ type: 'FETCH_USER_SUCCESS', payload: user });
      return { success: true, user };
    } catch (err) {
      dispatch({ type: 'FETCH_USER_ERROR' });
      return { success: false, error: err.message };
    }
  }, [dispatch]);

  return { register, login, logout, fetchCurrentUser };
}
