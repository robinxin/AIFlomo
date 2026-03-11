import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useMemoContext } from '@/context/MemoContext';

export function useMemos() {
  const { state, dispatch } = useMemoContext();

  const fetchMemos = useCallback(async (filterOverride) => {
    const filter = filterOverride ?? state.filter;
    dispatch({ type: 'FETCH_MEMOS_START' });
    try {
      const params = new URLSearchParams();
      if (filter.type && filter.type !== 'all') {
        params.set('type', filter.type);
      }
      if (filter.tagId) {
        params.set('tagId', filter.tagId);
      }
      const query = params.toString();
      const path = query ? `/api/memos?${query}` : '/api/memos';
      const data = await api.get(path);
      dispatch({ type: 'FETCH_MEMOS_SUCCESS', payload: data });
    } catch (err) {
      dispatch({ type: 'FETCH_MEMOS_ERROR', payload: err.message });
    }
  }, [state.filter, dispatch]);

  const MAX_CONTENT_LENGTH = 10000;

  const createMemo = useCallback(async (content, attachments = []) => {
    if (!content || content.length > MAX_CONTENT_LENGTH) {
      const msg = `内容长度必须在 1 到 ${MAX_CONTENT_LENGTH} 字符之间`;
      dispatch({ type: 'FETCH_MEMOS_ERROR', payload: msg });
      throw new Error(msg);
    }
    try {
      const data = await api.post('/api/memos', { content, attachments });
      dispatch({ type: 'ADD_MEMO', payload: data });
      return data;
    } catch (err) {
      dispatch({ type: 'FETCH_MEMOS_ERROR', payload: err.message });
      throw err;
    }
  }, [dispatch]);

  const updateMemo = useCallback(async (id, content, attachments) => {
    if (!content || content.length > MAX_CONTENT_LENGTH) {
      const msg = `内容长度必须在 1 到 ${MAX_CONTENT_LENGTH} 字符之间`;
      dispatch({ type: 'FETCH_MEMOS_ERROR', payload: msg });
      throw new Error(msg);
    }
    try {
      const body = { content };
      if (attachments !== undefined) {
        body.attachments = attachments;
      }
      const data = await api.put(`/api/memos/${id}`, body);
      dispatch({ type: 'UPDATE_MEMO', payload: data });
      return data;
    } catch (err) {
      dispatch({ type: 'FETCH_MEMOS_ERROR', payload: err.message });
      throw err;
    }
  }, [dispatch]);

  const deleteMemo = useCallback(async (id) => {
    try {
      await api.delete(`/api/memos/${id}`);
      dispatch({ type: 'DELETE_MEMO', payload: id });
    } catch (err) {
      dispatch({ type: 'FETCH_MEMOS_ERROR', payload: err.message });
      throw err;
    }
  }, [dispatch]);

  const setFilter = useCallback((filter) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, [dispatch]);

  const applyFilter = useCallback(async (filter) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
    await fetchMemos(filter);
  }, [dispatch, fetchMemos]);

  return {
    memos: state.memos,
    isLoading: state.isLoading,
    error: state.error,
    filter: state.filter,
    fetchMemos,
    createMemo,
    updateMemo,
    deleteMemo,
    setFilter,
    applyFilter,
  };
}
