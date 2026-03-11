import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useMemoContext } from '@/context/MemoContext';

export function useTags() {
  const { state, dispatch } = useMemoContext();

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.get('/api/tags');
      dispatch({ type: 'FETCH_TAGS_SUCCESS', payload: data });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useTags] fetchTags error:', error);
      }
      dispatch({ type: 'FETCH_TAGS_ERROR', payload: error.message });
    }
  }, [dispatch]);

  return {
    tags: state.tags,
    fetchTags,
  };
}
