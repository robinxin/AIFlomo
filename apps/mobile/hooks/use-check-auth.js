import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

export function useCheckAuth() {
  const { dispatch } = useAuth();

  useEffect(() => {
    (async () => {
      dispatch({ type: 'CHECK_AUTH_START' });
      try {
        const user = await api.get('/api/auth/me');
        dispatch({ type: 'CHECK_AUTH_SUCCESS', payload: user });
      } catch {
        dispatch({ type: 'CHECK_AUTH_FAILURE' });
      }
    })();
  }, [dispatch]);
}
