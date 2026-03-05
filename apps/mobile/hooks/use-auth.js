import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

export function useAuthActions() {
  const { dispatch } = useAuth();

  const register = useCallback(
    async (email, nickname, password) => {
      dispatch({ type: 'REGISTER_START' });
      try {
        const data = await api.post('/api/auth/register', {
          email,
          nickname,
          password,
          agreePolicy: true,
        });
        dispatch({ type: 'REGISTER_SUCCESS', payload: data });
        return { success: true, data };
      } catch (err) {
        dispatch({ type: 'REGISTER_ERROR', payload: err.message });
        return { success: false, error: err.message };
      }
    },
    [dispatch]
  );

  return { register };
}
