import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useMemoContext } from '@/context/MemoContext';

const DEBOUNCE_MS = 300;

export function useSearch() {
  const { state, dispatch } = useMemoContext();
  const [query, setQueryState] = useState('');
  const timerRef = useRef(null);

  const setQuery = useCallback((value) => {
    setQueryState(value);
  }, []);

  const clearSearch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setQueryState('');
    dispatch({ type: 'SEARCH_CLEAR' });
  }, [dispatch]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const trimmed = query.trim();

    if (!trimmed) {
      dispatch({ type: 'SEARCH_CLEAR' });
      return;
    }

    if (trimmed.length > 200) {
      dispatch({ type: 'SEARCH_ERROR', payload: '搜索关键词不能超过 200 个字符' });
      return;
    }

    dispatch({ type: 'SEARCH_START', payload: trimmed });

    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.get(`/api/memos?q=${encodeURIComponent(trimmed)}`);
        dispatch({ type: 'SEARCH_SUCCESS', payload: data });
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[useSearch] search error:', error);
        }
        dispatch({ type: 'SEARCH_ERROR', payload: error?.message || '搜索失败，请稍后重试' });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, dispatch]);

  return {
    query,
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    isSearching: state.isSearching,
    setQuery,
    clearSearch,
  };
}
