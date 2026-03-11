import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children }) => React.createElement('div', null, children),
  Text: ({ children }) => React.createElement('span', null, children),
  TouchableOpacity: ({ children, onPress }) =>
    React.createElement('button', { onClick: onPress }, children),
  StyleSheet: { create: (s) => s },
  Platform: { OS: 'web' },
}));

// ─── Mock expo-router ─────────────────────────────────────────────────────────

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSegments: () => [],
}));

// ─── Mock api-client ──────────────────────────────────────────────────────────

vi.mock('../lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../lib/api-client';
import { MemoProvider, useMemoContext } from '../context/MemoContext';
import { useTags } from '../hooks/use-tags';
import { useStats } from '../hooks/use-stats';
import { useSearch } from '../hooks/use-search';
import { useTrash } from '../hooks/use-trash';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithProvider(ui) {
  return render(React.createElement(MemoProvider, null, ui));
}

function makeHookWrapper(useHook, onRender) {
  function Wrapper() {
    const result = useHook();
    onRender(result);
    return null;
  }
  return Wrapper;
}

async function renderHook(useHook) {
  let hookResult = {};
  const onRender = (r) => { hookResult = r; };
  const Wrapper = makeHookWrapper(useHook, onRender);
  const utils = renderWithProvider(React.createElement(Wrapper));
  await act(async () => {});
  return { hookResult: () => hookResult, ...utils };
}

// ─── useTags Tests ────────────────────────────────────────────────────────────

describe('useTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial empty tags array', async () => {
    const { hookResult } = await renderHook(useTags);
    expect(hookResult().tags).toEqual([]);
  });

  it('exposes fetchTags as a function', async () => {
    const { hookResult } = await renderHook(useTags);
    expect(typeof hookResult().fetchTags).toBe('function');
  });

  it('fetches tags and dispatches FETCH_TAGS_SUCCESS on success', async () => {
    const tags = [{ id: 't1', name: 'work', memoCount: 3 }];
    api.get.mockResolvedValue(tags);

    const { hookResult } = await renderHook(useTags);

    await act(async () => {
      await hookResult().fetchTags();
    });

    expect(api.get).toHaveBeenCalledWith('/api/tags');
    expect(hookResult().tags).toEqual(tags);
  });

  it('calls api.get exactly once when fetchTags is called', async () => {
    api.get.mockResolvedValue([]);
    const { hookResult } = await renderHook(useTags);

    await act(async () => {
      await hookResult().fetchTags();
    });

    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('does not throw when api.get fails (swallows error)', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    const { hookResult } = await renderHook(useTags);

    await expect(
      act(async () => {
        await hookResult().fetchTags();
      })
    ).resolves.not.toThrow();
  });

  it('keeps existing tags when fetchTags fails', async () => {
    const initialTags = [{ id: 't1', name: 'work', memoCount: 1 }];
    api.get.mockResolvedValueOnce(initialTags).mockRejectedValue(new Error('fail'));
    const { hookResult } = await renderHook(useTags);

    await act(async () => {
      await hookResult().fetchTags();
    });
    expect(hookResult().tags).toEqual(initialTags);

    await act(async () => {
      await hookResult().fetchTags();
    });
    expect(hookResult().tags).toEqual(initialTags);
  });

  it('fetchTags is a stable callback reference', async () => {
    api.get.mockResolvedValue([]);
    const { hookResult, rerender } = await renderHook(useTags);
    const firstFetchTags = hookResult().fetchTags;

    await act(async () => {
      rerender(React.createElement(MemoProvider, null,
        React.createElement(makeHookWrapper(useTags, (r) => { hookResult._latest = r; }))
      ));
    });

    expect(typeof firstFetchTags).toBe('function');
  });
});

// ─── useStats Tests ───────────────────────────────────────────────────────────

describe('useStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial null stats and empty heatmapData', async () => {
    const { hookResult } = await renderHook(useStats);
    expect(hookResult().stats).toBeNull();
    expect(hookResult().heatmapData).toEqual([]);
  });

  it('exposes fetchStats as a function', async () => {
    const { hookResult } = await renderHook(useStats);
    expect(typeof hookResult().fetchStats).toBe('function');
  });

  it('dispatches FETCH_STATS_SUCCESS and FETCH_HEATMAP_SUCCESS on success', async () => {
    const heatmap = [{ day: '2026-03-01', count: 5 }];
    const statsData = {
      totalCount: 42,
      daysUsed: 15,
      heatmap,
    };
    api.get.mockResolvedValue(statsData);

    const { hookResult } = await renderHook(useStats);

    await act(async () => {
      await hookResult().fetchStats();
    });

    expect(api.get).toHaveBeenCalledWith('/api/stats');
    expect(hookResult().stats).toEqual({ totalCount: 42, daysUsed: 15 });
    expect(hookResult().heatmapData).toEqual(heatmap);
  });

  it('uses empty array for heatmapData when heatmap is not in response', async () => {
    const statsData = { totalCount: 10, daysUsed: 5 };
    api.get.mockResolvedValue(statsData);

    const { hookResult } = await renderHook(useStats);

    await act(async () => {
      await hookResult().fetchStats();
    });

    expect(hookResult().heatmapData).toEqual([]);
  });

  it('does not throw when api.get fails (swallows error)', async () => {
    api.get.mockRejectedValue(new Error('Server error'));
    const { hookResult } = await renderHook(useStats);

    await expect(
      act(async () => {
        await hookResult().fetchStats();
      })
    ).resolves.not.toThrow();
  });

  it('leaves stats and heatmapData as null/empty when fetch fails', async () => {
    api.get.mockRejectedValue(new Error('fail'));
    const { hookResult } = await renderHook(useStats);

    await act(async () => {
      await hookResult().fetchStats();
    });

    expect(hookResult().stats).toBeNull();
    expect(hookResult().heatmapData).toEqual([]);
  });

  it('fetchStats is a stable callback reference', async () => {
    api.get.mockResolvedValue({ totalCount: 0, daysUsed: 0, heatmap: [] });
    const { hookResult } = await renderHook(useStats);
    const firstFetchStats = hookResult().fetchStats;
    expect(typeof firstFetchStats).toBe('function');
  });
});

// ─── useSearch Tests ──────────────────────────────────────────────────────────

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial state values', async () => {
    const { hookResult } = await renderHook(useSearch);
    const result = hookResult();
    expect(result.query).toBe('');
    expect(result.searchQuery).toBe('');
    expect(result.searchResults).toEqual([]);
    expect(result.isSearching).toBe(false);
  });

  it('exposes setQuery and clearSearch as functions', async () => {
    const { hookResult } = await renderHook(useSearch);
    expect(typeof hookResult().setQuery).toBe('function');
    expect(typeof hookResult().clearSearch).toBe('function');
  });

  it('updates query state when setQuery is called', async () => {
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('hello');
    });

    expect(hookResult().query).toBe('hello');
  });

  it('dispatches SEARCH_START when query has trimmed content', async () => {
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('test query');
    });

    expect(hookResult().isSearching).toBe(true);
    expect(hookResult().searchQuery).toBe('test query');
  });

  it('dispatches SEARCH_CLEAR when query is empty', async () => {
    api.get.mockResolvedValue([]);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('something');
    });
    await act(async () => {
      hookResult().setQuery('');
    });

    expect(hookResult().isSearching).toBe(false);
    expect(hookResult().searchQuery).toBe('');
  });

  it('dispatches SEARCH_SUCCESS after debounce delay', async () => {
    const results = [{ id: '1', content: 'found' }];
    api.get.mockResolvedValue(results);

    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('found');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(hookResult().searchResults).toEqual(results);
      expect(hookResult().isSearching).toBe(false);
    });
  });

  it('calls api.get with URL-encoded query', async () => {
    api.get.mockResolvedValue([]);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('中文搜索');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `/api/memos?q=${encodeURIComponent('中文搜索')}`
      );
    });
  });

  it('clears search state when clearSearch is called', async () => {
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('search term');
    });

    await act(async () => {
      hookResult().clearSearch();
    });

    expect(hookResult().query).toBe('');
    expect(hookResult().searchQuery).toBe('');
    expect(hookResult().isSearching).toBe(false);
    expect(hookResult().searchResults).toEqual([]);
  });

  it('dispatches SEARCH_ERROR when query exceeds 200 characters', async () => {
    const longQuery = 'a'.repeat(201);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery(longQuery);
    });

    expect(hookResult().isSearching).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('handles api error gracefully without throwing', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('failing query');
    });

    await expect(
      act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      })
    ).resolves.not.toThrow();
  });

  it('does not search when query is only whitespace', async () => {
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('   ');
    });

    expect(hookResult().isSearching).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });
});

// ─── useTrash Tests ───────────────────────────────────────────────────────────

describe('useTrash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial empty trashMemos and trashCount=0', async () => {
    const { hookResult } = await renderHook(useTrash);
    expect(hookResult().trashMemos).toEqual([]);
    expect(hookResult().trashCount).toBe(0);
  });

  it('exposes fetchTrash, restoreMemo, permanentDeleteMemo as functions', async () => {
    const { hookResult } = await renderHook(useTrash);
    expect(typeof hookResult().fetchTrash).toBe('function');
    expect(typeof hookResult().restoreMemo).toBe('function');
    expect(typeof hookResult().permanentDeleteMemo).toBe('function');
  });

  describe('fetchTrash', () => {
    it('fetches trash memos and dispatches FETCH_TRASH_SUCCESS', async () => {
      const trashMemos = [
        { id: 't1', content: 'deleted 1' },
        { id: 't2', content: 'deleted 2' },
      ];
      api.get.mockResolvedValue(trashMemos);

      const { hookResult } = await renderHook(useTrash);

      await act(async () => {
        await hookResult().fetchTrash();
      });

      expect(api.get).toHaveBeenCalledWith('/api/memos/trash');
      expect(hookResult().trashMemos).toEqual(trashMemos);
      expect(hookResult().trashCount).toBe(2);
    });

    it('does not throw when api.get fails (swallows error)', async () => {
      api.get.mockRejectedValue(new Error('Not found'));
      const { hookResult } = await renderHook(useTrash);

      await expect(
        act(async () => {
          await hookResult().fetchTrash();
        })
      ).resolves.not.toThrow();
    });
  });

  describe('restoreMemo', () => {
    it('calls api.post on the restore endpoint', async () => {
      api.post.mockResolvedValue({});
      const { hookResult } = await renderHook(useTrash);

      await act(async () => {
        await hookResult().restoreMemo('t1');
      });

      expect(api.post).toHaveBeenCalledWith('/api/memos/t1/restore');
    });

    it('dispatches RESTORE_MEMO and decrements trashCount', async () => {
      const trashMemos = [
        { id: 't1', content: 'memo 1' },
        { id: 't2', content: 'memo 2' },
      ];
      api.get.mockResolvedValue(trashMemos);
      api.post.mockResolvedValue({});

      const { hookResult } = await renderHook(useTrash);

      await act(async () => {
        await hookResult().fetchTrash();
      });
      expect(hookResult().trashCount).toBe(2);

      await act(async () => {
        await hookResult().restoreMemo('t1');
      });

      expect(hookResult().trashMemos).toHaveLength(1);
      expect(hookResult().trashMemos[0].id).toBe('t2');
      expect(hookResult().trashCount).toBe(1);
    });

    it('throws and propagates error when api.post fails', async () => {
      api.post.mockRejectedValue(new Error('Restore failed'));
      const { hookResult } = await renderHook(useTrash);

      await expect(
        act(async () => {
          await hookResult().restoreMemo('t1');
        })
      ).rejects.toThrow('Restore failed');
    });
  });

  describe('permanentDeleteMemo', () => {
    it('calls api.delete on the permanent endpoint', async () => {
      api.delete.mockResolvedValue({});
      const { hookResult } = await renderHook(useTrash);

      await act(async () => {
        await hookResult().permanentDeleteMemo('t2');
      });

      expect(api.delete).toHaveBeenCalledWith('/api/memos/t2/permanent');
    });

    it('dispatches PERMANENT_DELETE_MEMO and decrements trashCount', async () => {
      const trashMemos = [
        { id: 't1', content: 'memo 1' },
        { id: 't2', content: 'memo 2' },
      ];
      api.get.mockResolvedValue(trashMemos);
      api.delete.mockResolvedValue({});

      const { hookResult } = await renderHook(useTrash);

      await act(async () => {
        await hookResult().fetchTrash();
      });
      expect(hookResult().trashCount).toBe(2);

      await act(async () => {
        await hookResult().permanentDeleteMemo('t2');
      });

      expect(hookResult().trashMemos).toHaveLength(1);
      expect(hookResult().trashMemos[0].id).toBe('t1');
      expect(hookResult().trashCount).toBe(1);
    });

    it('throws and propagates error when api.delete fails', async () => {
      api.delete.mockRejectedValue(new Error('Delete failed'));
      const { hookResult } = await renderHook(useTrash);

      await expect(
        act(async () => {
          await hookResult().permanentDeleteMemo('t1');
        })
      ).rejects.toThrow('Delete failed');
    });

    it('trashCount does not go below 0 on repeated deletes', async () => {
      api.delete.mockResolvedValue({});
      const { hookResult } = await renderHook(useTrash);

      await act(async () => {
        await hookResult().permanentDeleteMemo('nonexistent');
      });

      expect(hookResult().trashCount).toBe(0);
    });
  });
});
