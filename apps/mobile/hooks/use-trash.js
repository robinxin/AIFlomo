import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useMemoContext } from '@/context/MemoContext';

export function useTrash() {
  const { state, dispatch } = useMemoContext();

  const fetchTrash = useCallback(async () => {
    try {
      const data = await api.get('/api/memos/trash');
      dispatch({ type: 'FETCH_TRASH_SUCCESS', payload: data });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useTrash] fetchTrash error:', error);
      }
    }
  }, [dispatch]);

  const restoreMemo = useCallback(async (id) => {
    try {
      await api.post(`/api/memos/${id}/restore`);
      dispatch({ type: 'RESTORE_MEMO', payload: id });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useTrash] restoreMemo error:', error);
      }
      throw error;
    }
  }, [dispatch]);

  const permanentDeleteMemo = useCallback(async (id) => {
    try {
      await api.delete(`/api/memos/${id}/permanent`);
      dispatch({ type: 'PERMANENT_DELETE_MEMO', payload: id });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useTrash] permanentDeleteMemo error:', error);
      }
      throw error;
    }
  }, [dispatch]);

  return {
    trashMemos: state.trashMemos,
    trashCount: state.trashCount,
    fetchTrash,
    restoreMemo,
    permanentDeleteMemo,
  };
}
