import { useCallback } from 'react';
import { useMemoContext } from '@/context/MemoContext';
import { api } from '@/lib/api-client';

export function useMemos() {
  const { state, dispatch } = useMemoContext();

  const fetchMemos = useCallback(
    async (reset = true) => {
      dispatch({ type: 'FETCH_MEMOS_START' });
      try {
        const page = reset ? 1 : state.page + 1;
        const params = new URLSearchParams({ page, limit: 20 });

        if (state.activeFilter === 'no_tag') {
          params.set('type', 'no_tag');
        } else if (state.activeFilter === 'has_image') {
          params.set('type', 'has_image');
        } else if (state.activeFilter === 'has_link') {
          params.set('type', 'has_link');
        } else if (state.activeFilter?.startsWith('tag:')) {
          params.set('tag', state.activeFilter.slice(4));
        }

        const result = await api.get(`/api/memos?${params.toString()}`);
        dispatch({
          type: 'FETCH_MEMOS_SUCCESS',
          payload: { items: result.items, total: result.total, page },
        });
      } catch (err) {
        dispatch({ type: 'FETCH_MEMOS_ERROR', payload: err.message });
      }
    },
    [dispatch, state.activeFilter, state.page],
  );

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.isLoading) return;
    await fetchMemos(false);
  }, [fetchMemos, state.hasMore, state.isLoading]);

  const createMemo = useCallback(
    async (content) => {
      dispatch({ type: 'CREATE_MEMO_START' });
      try {
        const memo = await api.post('/api/memos', { content });
        dispatch({ type: 'CREATE_MEMO_SUCCESS', payload: memo });
      } catch (err) {
        dispatch({ type: 'CREATE_MEMO_ERROR', payload: err.message });
        throw err;
      }
    },
    [dispatch],
  );

  const deleteMemo = useCallback(
    async (id) => {
      await api.delete(`/api/memos/${id}`);
      dispatch({ type: 'DELETE_MEMO_SUCCESS', payload: id });
    },
    [dispatch],
  );

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.get('/api/tags');
      dispatch({ type: 'FETCH_TAGS_SUCCESS', payload: data });
    } catch (_) {
      // 静默失败，不影响主流程
    }
  }, [dispatch]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get('/api/memos/stats');
      dispatch({ type: 'FETCH_STATS_SUCCESS', payload: data });
    } catch (_) {
      // 静默失败
    }
  }, [dispatch]);

  const fetchHeatmap = useCallback(async () => {
    try {
      const data = await api.get('/api/memos/heatmap');
      dispatch({ type: 'FETCH_HEATMAP_SUCCESS', payload: data });
    } catch (_) {
      // 静默失败
    }
  }, [dispatch]);

  const setFilter = useCallback(
    (filter) => {
      dispatch({ type: 'SET_FILTER', payload: filter });
    },
    [dispatch],
  );

  const setKeyword = useCallback(
    (keyword) => {
      dispatch({ type: 'SET_KEYWORD', payload: keyword });
    },
    [dispatch],
  );

  return {
    memos: state.memos,
    tags: state.tags,
    stats: state.stats,
    heatmap: state.heatmap,
    activeFilter: state.activeFilter,
    keyword: state.keyword,
    isLoading: state.isLoading,
    isSubmitting: state.isSubmitting,
    error: state.error,
    hasMore: state.hasMore,
    fetchMemos,
    loadMore,
    createMemo,
    deleteMemo,
    setFilter,
    setKeyword,
    fetchTags,
    fetchStats,
    fetchHeatmap,
  };
}
