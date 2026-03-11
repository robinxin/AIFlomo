import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useMemoContext } from '@/context/MemoContext';

export function useStats() {
  const { state, dispatch } = useMemoContext();

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get('/api/stats');
      const { heatmap, ...stats } = data;
      dispatch({ type: 'FETCH_STATS_SUCCESS', payload: stats });
      dispatch({ type: 'FETCH_HEATMAP_SUCCESS', payload: heatmap ?? [] });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useStats] fetchStats error:', error);
      }
    }
  }, [dispatch]);

  return {
    stats: state.stats,
    heatmapData: state.heatmapData,
    fetchStats,
  };
}
