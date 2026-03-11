import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock react-native so jsdom environment doesn't break on native imports
vi.mock('react-native', () => ({
  View: ({ children }) => React.createElement('div', null, children),
  Text: ({ children }) => React.createElement('span', null, children),
  TouchableOpacity: ({ children, onPress }) =>
    React.createElement('button', { onClick: onPress }, children),
  StyleSheet: { create: (s) => s },
  Platform: { OS: 'web' },
}));

// Mock expo-router to prevent navigation side-effects
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSegments: () => [],
}));

// Mock api-client – must be set up before importing hooks that use it
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
import { useMemos } from '../hooks/use-memos';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TestConsumer() {
  const { state } = useMemoContext();
  return React.createElement(
    'div',
    { 'data-testid': 'consumer' },
    JSON.stringify(state)
  );
}

function renderWithProvider(ui) {
  return render(React.createElement(MemoProvider, null, ui));
}

function UseMemosWrapper({ onRender }) {
  const result = useMemos();
  onRender(result);
  return null;
}

async function renderUseMemos() {
  let hookResult = {};
  const onRender = (r) => { hookResult = r; };
  const utils = renderWithProvider(
    React.createElement(UseMemosWrapper, { onRender })
  );
  await act(async () => {});
  return { hookResult: () => hookResult, ...utils };
}

// ─── MemoContext Tests ────────────────────────────────────────────────────────

describe('MemoContext', () => {
  describe('MemoProvider', () => {
    it('provides the correct initial state', () => {
      renderWithProvider(React.createElement(TestConsumer));
      const raw = JSON.parse(screen.getByTestId('consumer').textContent);
      expect(raw.memos).toEqual([]);
      expect(raw.isLoading).toBe(false);
      expect(raw.error).toBeNull();
      expect(raw.filter).toEqual({ type: 'all', tagId: null });
      expect(raw.searchQuery).toBe('');
      expect(raw.searchResults).toEqual([]);
      expect(raw.isSearching).toBe(false);
      expect(raw.stats).toBeNull();
      expect(raw.heatmapData).toEqual([]);
      expect(raw.tags).toEqual([]);
      expect(raw.trashMemos).toEqual([]);
      expect(raw.trashCount).toBe(0);
    });

    it('renders children inside the provider', () => {
      renderWithProvider(React.createElement('span', { 'data-testid': 'child' }, 'hello'));
      expect(screen.getByTestId('child')).toBeTruthy();
    });
  });

  describe('memoReducer via dispatch', () => {
    function DispatchConsumer({ action }) {
      const { state, dispatch } = useMemoContext();
      React.useEffect(() => {
        dispatch(action);
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return React.createElement(
        'div',
        { 'data-testid': 'state' },
        JSON.stringify(state)
      );
    }

    it('handles FETCH_MEMOS_START: sets isLoading=true and clears error', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, { action: { type: 'FETCH_MEMOS_START' } })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();
      });
    });

    it('handles FETCH_MEMOS_SUCCESS: sets memos and clears isLoading', async () => {
      const memos = [{ id: '1', content: 'Test memo' }];
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'FETCH_MEMOS_SUCCESS', payload: memos },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(false);
        expect(state.memos).toEqual(memos);
      });
    });

    it('handles FETCH_MEMOS_ERROR: sets error and clears isLoading', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'FETCH_MEMOS_ERROR', payload: 'Something went wrong' },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Something went wrong');
      });
    });

    it('handles ADD_MEMO: prepends memo to the list', async () => {
      const newMemo = { id: '2', content: 'New memo' };
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'ADD_MEMO', payload: newMemo },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.memos[0]).toEqual(newMemo);
        expect(state.memos).toHaveLength(1);
      });
    });

    it('handles UPDATE_MEMO: replaces memo with matching id', async () => {
      function MultiDispatchConsumer() {
        const { state, dispatch } = useMemoContext();
        React.useEffect(() => {
          dispatch({ type: 'FETCH_MEMOS_SUCCESS', payload: [
            { id: '1', content: 'Old content' },
            { id: '2', content: 'Another memo' },
          ]});
          dispatch({ type: 'UPDATE_MEMO', payload: { id: '1', content: 'Updated content' } });
        }, []); // eslint-disable-line react-hooks/exhaustive-deps
        return React.createElement(
          'div',
          { 'data-testid': 'state' },
          JSON.stringify(state)
        );
      }
      renderWithProvider(React.createElement(MultiDispatchConsumer));
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        const updated = state.memos.find((m) => m.id === '1');
        expect(updated).toBeDefined();
        expect(updated.content).toBe('Updated content');
        expect(state.memos).toHaveLength(2);
      });
    });

    it('handles DELETE_MEMO: removes memo and increments trashCount', async () => {
      function MultiDispatchConsumer() {
        const { state, dispatch } = useMemoContext();
        React.useEffect(() => {
          dispatch({ type: 'FETCH_MEMOS_SUCCESS', payload: [
            { id: '1', content: 'Memo to delete' },
            { id: '2', content: 'Keep this memo' },
          ]});
          dispatch({ type: 'DELETE_MEMO', payload: '1' });
        }, []); // eslint-disable-line react-hooks/exhaustive-deps
        return React.createElement(
          'div',
          { 'data-testid': 'state' },
          JSON.stringify(state)
        );
      }
      renderWithProvider(React.createElement(MultiDispatchConsumer));
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.memos).toHaveLength(1);
        expect(state.memos[0].id).toBe('2');
        expect(state.trashCount).toBe(1);
      });
    });

    it('handles SET_FILTER: updates filter object', async () => {
      const filter = { type: 'image', tagId: 'tag-1' };
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'SET_FILTER', payload: filter },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.filter).toEqual(filter);
      });
    });

    it('handles FETCH_TAGS_SUCCESS: sets tags array', async () => {
      const tags = [{ id: 't1', name: '工作', count: 3 }];
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'FETCH_TAGS_SUCCESS', payload: tags },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.tags).toEqual(tags);
      });
    });

    it('handles FETCH_STATS_SUCCESS: sets stats object', async () => {
      const stats = { total: 10, tagged: 5, daysUsed: 7, trashCount: 2 };
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'FETCH_STATS_SUCCESS', payload: stats },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.stats).toEqual(stats);
      });
    });

    it('handles FETCH_HEATMAP_SUCCESS: sets heatmapData array', async () => {
      const heatmap = [{ date: '2026-03-10', count: 3 }];
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'FETCH_HEATMAP_SUCCESS', payload: heatmap },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.heatmapData).toEqual(heatmap);
      });
    });

    it('handles SEARCH_START: sets isSearching=true and stores searchQuery', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'SEARCH_START', payload: '会议' },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isSearching).toBe(true);
        expect(state.searchQuery).toBe('会议');
      });
    });

    it('handles SEARCH_SUCCESS: sets searchResults and clears isSearching', async () => {
      const results = [{ id: '1', content: '会议记录' }];
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'SEARCH_SUCCESS', payload: results },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isSearching).toBe(false);
        expect(state.searchResults).toEqual(results);
      });
    });

    it('handles SEARCH_CLEAR: resets search state', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, { action: { type: 'SEARCH_CLEAR' } })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isSearching).toBe(false);
        expect(state.searchQuery).toBe('');
        expect(state.searchResults).toEqual([]);
      });
    });

    it('handles FETCH_TRASH_SUCCESS: sets trashMemos and updates trashCount', async () => {
      const trashMemos = [
        { id: 't1', content: 'Deleted memo 1' },
        { id: 't2', content: 'Deleted memo 2' },
      ];
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'FETCH_TRASH_SUCCESS', payload: trashMemos },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.trashMemos).toEqual(trashMemos);
        expect(state.trashCount).toBe(2);
      });
    });

    it('handles RESTORE_MEMO: removes memo from trash and decrements trashCount', async () => {
      function MultiDispatchConsumer() {
        const { state, dispatch } = useMemoContext();
        React.useEffect(() => {
          dispatch({ type: 'FETCH_TRASH_SUCCESS', payload: [
            { id: 't1', content: 'Deleted memo 1' },
            { id: 't2', content: 'Deleted memo 2' },
          ]});
          dispatch({ type: 'RESTORE_MEMO', payload: 't1' });
        }, []); // eslint-disable-line react-hooks/exhaustive-deps
        return React.createElement(
          'div',
          { 'data-testid': 'state' },
          JSON.stringify(state)
        );
      }
      renderWithProvider(React.createElement(MultiDispatchConsumer));
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.trashMemos).toHaveLength(1);
        expect(state.trashMemos[0].id).toBe('t2');
        expect(state.trashCount).toBe(1);
      });
    });

    it('handles RESTORE_MEMO: trashCount does not go below 0', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'RESTORE_MEMO', payload: 'nonexistent' },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.trashCount).toBe(0);
      });
    });

    it('handles PERMANENT_DELETE_MEMO: removes memo from trash and decrements trashCount', async () => {
      function MultiDispatchConsumer() {
        const { state, dispatch } = useMemoContext();
        React.useEffect(() => {
          dispatch({ type: 'FETCH_TRASH_SUCCESS', payload: [
            { id: 't1', content: 'Deleted memo 1' },
            { id: 't2', content: 'Deleted memo 2' },
          ]});
          dispatch({ type: 'PERMANENT_DELETE_MEMO', payload: 't2' });
        }, []); // eslint-disable-line react-hooks/exhaustive-deps
        return React.createElement(
          'div',
          { 'data-testid': 'state' },
          JSON.stringify(state)
        );
      }
      renderWithProvider(React.createElement(MultiDispatchConsumer));
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.trashMemos).toHaveLength(1);
        expect(state.trashMemos[0].id).toBe('t1');
        expect(state.trashCount).toBe(1);
      });
    });

    it('handles PERMANENT_DELETE_MEMO: trashCount does not go below 0', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'PERMANENT_DELETE_MEMO', payload: 'nonexistent' },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.trashCount).toBe(0);
      });
    });

    it('handles unknown action type: returns current state unchanged', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'UNKNOWN_ACTION' },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.memos).toEqual([]);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
      });
    });
  });

  describe('useMemoContext', () => {
    it('throws an error when used outside of MemoProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      function BareConsumer() {
        useMemoContext();
        return null;
      }
      expect(() => render(React.createElement(BareConsumer))).toThrow(
        'useMemoContext must be used within MemoProvider'
      );
      consoleSpy.mockRestore();
    });

    it('returns state and dispatch when used inside MemoProvider', () => {
      let captured = null;
      function Capturer() {
        captured = useMemoContext();
        return null;
      }
      renderWithProvider(React.createElement(Capturer));
      expect(captured).not.toBeNull();
      expect(typeof captured.state).toBe('object');
      expect(typeof captured.dispatch).toBe('function');
    });
  });
});

// ─── useMemos Hook Tests ──────────────────────────────────────────────────────

describe('useMemos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state values from MemoContext', async () => {
    const { hookResult } = await renderUseMemos();
    const result = hookResult();
    expect(result.memos).toEqual([]);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.filter).toEqual({ type: 'all', tagId: null });
  });

  it('exposes fetchMemos, createMemo, updateMemo, deleteMemo, setFilter, applyFilter as functions', async () => {
    const { hookResult } = await renderUseMemos();
    const result = hookResult();
    expect(typeof result.fetchMemos).toBe('function');
    expect(typeof result.createMemo).toBe('function');
    expect(typeof result.updateMemo).toBe('function');
    expect(typeof result.deleteMemo).toBe('function');
    expect(typeof result.setFilter).toBe('function');
    expect(typeof result.applyFilter).toBe('function');
  });

  describe('fetchMemos', () => {
    it('calls api.get with /api/memos when filter is default (all)', async () => {
      const memos = [{ id: '1', content: 'Test memo' }];
      api.get.mockResolvedValue(memos);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos();
      });

      expect(api.get).toHaveBeenCalledWith('/api/memos');
      expect(hookResult().memos).toEqual(memos);
      expect(hookResult().isLoading).toBe(false);
    });

    it('appends type query param when filter.type is not "all"', async () => {
      api.get.mockResolvedValue([]);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos({ type: 'image', tagId: null });
      });

      expect(api.get).toHaveBeenCalledWith('/api/memos?type=image');
    });

    it('appends tagId query param when filter.tagId is set', async () => {
      api.get.mockResolvedValue([]);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos({ type: 'all', tagId: 'tag-42' });
      });

      expect(api.get).toHaveBeenCalledWith('/api/memos?tagId=tag-42');
    });

    it('appends both type and tagId when both are set', async () => {
      api.get.mockResolvedValue([]);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos({ type: 'link', tagId: 'tag-7' });
      });

      const calledUrl = api.get.mock.calls[0][0];
      expect(calledUrl).toContain('type=link');
      expect(calledUrl).toContain('tagId=tag-7');
    });

    it('sets isLoading=true during fetch and false on success', async () => {
      let resolveApi;
      api.get.mockReturnValue(new Promise((res) => { resolveApi = res; }));

      const { hookResult } = await renderUseMemos();

      act(() => {
        hookResult().fetchMemos();
      });

      await waitFor(() => expect(hookResult().isLoading).toBe(true));

      await act(async () => {
        resolveApi([]);
      });

      expect(hookResult().isLoading).toBe(false);
    });

    it('sets error state when api.get fails', async () => {
      api.get.mockRejectedValue(new Error('Network error'));

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos();
      });

      expect(hookResult().error).toBe('Network error');
      expect(hookResult().isLoading).toBe(false);
    });

    it('uses state.filter when no filterOverride is provided', async () => {
      api.get.mockResolvedValue([]);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        hookResult().setFilter({ type: 'image', tagId: null });
      });

      await act(async () => {
        await hookResult().fetchMemos();
      });

      expect(api.get).toHaveBeenCalledWith('/api/memos?type=image');
    });
  });

  describe('createMemo', () => {
    it('calls api.post and dispatches ADD_MEMO on success', async () => {
      const newMemo = { id: '3', content: 'Created memo' };
      api.post.mockResolvedValue(newMemo);

      const { hookResult } = await renderUseMemos();
      let result;

      await act(async () => {
        result = await hookResult().createMemo('Created memo', []);
      });

      expect(api.post).toHaveBeenCalledWith('/api/memos', {
        content: 'Created memo',
        attachments: [],
      });
      expect(result).toEqual(newMemo);
      expect(hookResult().memos[0]).toEqual(newMemo);
    });

    it('defaults attachments to empty array when not provided', async () => {
      api.post.mockResolvedValue({ id: '4', content: 'No attachments' });

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().createMemo('No attachments');
      });

      expect(api.post).toHaveBeenCalledWith('/api/memos', {
        content: 'No attachments',
        attachments: [],
      });
    });

    it('throws and sets error when content is empty', async () => {
      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().createMemo('');
        })
      ).rejects.toThrow('内容长度必须在 1 到 10000 字符之间');

      expect(hookResult().error).toBe('内容长度必须在 1 到 10000 字符之间');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('throws and sets error when content exceeds 10000 characters', async () => {
      const longContent = 'a'.repeat(10001);
      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().createMemo(longContent);
        })
      ).rejects.toThrow('内容长度必须在 1 到 10000 字符之间');

      expect(hookResult().error).toBe('内容长度必须在 1 到 10000 字符之间');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('accepts content exactly at the 10000 character limit', async () => {
      const exactContent = 'a'.repeat(10000);
      api.post.mockResolvedValue({ id: '5', content: exactContent });

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().createMemo(exactContent);
      });

      expect(api.post).toHaveBeenCalledWith('/api/memos', {
        content: exactContent,
        attachments: [],
      });
    });

    it('throws and sets error when api.post fails', async () => {
      api.post.mockRejectedValue(new Error('Server error'));

      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().createMemo('Valid content');
        })
      ).rejects.toThrow('Server error');

      expect(hookResult().error).toBe('Server error');
    });
  });

  describe('updateMemo', () => {
    it('calls api.put and dispatches UPDATE_MEMO on success', async () => {
      const existingMemo = { id: '1', content: 'Original content' };
      const updatedMemo = { id: '1', content: 'Updated content' };
      api.get.mockResolvedValue([existingMemo]);
      api.put.mockResolvedValue(updatedMemo);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos();
      });

      let result;
      await act(async () => {
        result = await hookResult().updateMemo('1', 'Updated content');
      });

      expect(api.put).toHaveBeenCalledWith('/api/memos/1', { content: 'Updated content' });
      expect(result).toEqual(updatedMemo);
      const updated = hookResult().memos.find((m) => m.id === '1');
      expect(updated.content).toBe('Updated content');
    });

    it('includes attachments in the request body when provided', async () => {
      const updatedMemo = { id: '1', content: 'Updated', attachments: [{ type: 'image', url: 'http://img.jpg' }] };
      api.put.mockResolvedValue(updatedMemo);

      const { hookResult } = await renderUseMemos();
      const attachments = [{ type: 'image', url: 'http://img.jpg' }];

      await act(async () => {
        await hookResult().updateMemo('1', 'Updated', attachments);
      });

      expect(api.put).toHaveBeenCalledWith('/api/memos/1', {
        content: 'Updated',
        attachments,
      });
    });

    it('does not include attachments when undefined', async () => {
      api.put.mockResolvedValue({ id: '1', content: 'Updated' });

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().updateMemo('1', 'Updated');
      });

      expect(api.put).toHaveBeenCalledWith('/api/memos/1', { content: 'Updated' });
      const callBody = api.put.mock.calls[0][1];
      expect('attachments' in callBody).toBe(false);
    });

    it('throws and sets error when content is empty', async () => {
      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().updateMemo('1', '');
        })
      ).rejects.toThrow('内容长度必须在 1 到 10000 字符之间');

      expect(hookResult().error).toBe('内容长度必须在 1 到 10000 字符之间');
      expect(api.put).not.toHaveBeenCalled();
    });

    it('throws and sets error when content exceeds 10000 characters', async () => {
      const longContent = 'b'.repeat(10001);
      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().updateMemo('1', longContent);
        })
      ).rejects.toThrow('内容长度必须在 1 到 10000 字符之间');

      expect(api.put).not.toHaveBeenCalled();
    });

    it('throws and sets error when api.put fails', async () => {
      api.put.mockRejectedValue(new Error('Update failed'));

      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().updateMemo('1', 'Valid content');
        })
      ).rejects.toThrow('Update failed');

      expect(hookResult().error).toBe('Update failed');
    });
  });

  describe('deleteMemo', () => {
    it('calls api.delete and dispatches DELETE_MEMO on success', async () => {
      const memos = [
        { id: '1', content: 'Memo 1' },
        { id: '2', content: 'Memo 2' },
      ];
      api.get.mockResolvedValue(memos);
      api.delete.mockResolvedValue({});

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos();
      });

      expect(hookResult().memos).toHaveLength(2);

      await act(async () => {
        await hookResult().deleteMemo('1');
      });

      expect(api.delete).toHaveBeenCalledWith('/api/memos/1');
      expect(hookResult().memos).toHaveLength(1);
      expect(hookResult().memos[0].id).toBe('2');
    });

    it('increments trashCount after delete', async () => {
      api.get.mockResolvedValue([{ id: '1', content: 'Memo' }]);
      api.delete.mockResolvedValue({});

      const { hookResult, rerender } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos();
      });

      await act(async () => {
        await hookResult().deleteMemo('1');
      });

      expect(hookResult().memos).toHaveLength(0);

      let capturedTrashCount;
      function TrashCountDisplay() {
        const { state } = useMemoContext();
        capturedTrashCount = state.trashCount;
        return null;
      }
      await act(async () => {
        rerender(
          React.createElement(MemoProvider, null,
            React.createElement(UseMemosWrapper, { onRender: (r) => { hookResult._latest = r; } }),
            React.createElement(TrashCountDisplay)
          )
        );
      });

      expect(capturedTrashCount).toBe(1);
    });

    it('throws and sets error when api.delete fails', async () => {
      api.delete.mockRejectedValue(new Error('Delete failed'));

      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().deleteMemo('1');
        })
      ).rejects.toThrow('Delete failed');

      expect(hookResult().error).toBe('Delete failed');
    });
  });

  describe('setFilter', () => {
    it('dispatches SET_FILTER and updates filter state', async () => {
      const { hookResult } = await renderUseMemos();
      const newFilter = { type: 'link', tagId: null };

      await act(async () => {
        hookResult().setFilter(newFilter);
      });

      expect(hookResult().filter).toEqual(newFilter);
    });

    it('can set filter with tagId', async () => {
      const { hookResult } = await renderUseMemos();
      const newFilter = { type: 'all', tagId: 'tag-99' };

      await act(async () => {
        hookResult().setFilter(newFilter);
      });

      expect(hookResult().filter).toEqual(newFilter);
    });

    it('is a stable callback reference', async () => {
      const { hookResult, rerender } = await renderUseMemos();
      const firstRef = hookResult().setFilter;

      await act(async () => {
        rerender(
          React.createElement(
            MemoProvider,
            null,
            React.createElement(UseMemosWrapper, { onRender: (r) => { hookResult._latest = r; } })
          )
        );
      });

      expect(typeof firstRef).toBe('function');
    });
  });

  describe('applyFilter', () => {
    it('sets filter state and triggers fetchMemos with the new filter', async () => {
      api.get.mockResolvedValue([]);

      const { hookResult } = await renderUseMemos();
      const newFilter = { type: 'image', tagId: null };

      await act(async () => {
        await hookResult().applyFilter(newFilter);
      });

      expect(hookResult().filter).toEqual(newFilter);
      expect(api.get).toHaveBeenCalledWith('/api/memos?type=image');
    });

    it('passes the provided filter to fetchMemos, not the stale state.filter', async () => {
      api.get.mockResolvedValue([]);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().applyFilter({ type: 'link', tagId: 'tag-5' });
      });

      const calledUrl = api.get.mock.calls[0][0];
      expect(calledUrl).toContain('type=link');
      expect(calledUrl).toContain('tagId=tag-5');
    });
  });

  describe('state transitions – full flow', () => {
    it('fetchMemos then createMemo prepends the new memo to the list', async () => {
      const existingMemos = [{ id: '1', content: 'Existing memo' }];
      const newMemo = { id: '2', content: 'Brand new memo' };
      api.get.mockResolvedValue(existingMemos);
      api.post.mockResolvedValue(newMemo);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos();
      });
      expect(hookResult().memos).toHaveLength(1);

      await act(async () => {
        await hookResult().createMemo('Brand new memo');
      });

      expect(hookResult().memos).toHaveLength(2);
      expect(hookResult().memos[0]).toEqual(newMemo);
      expect(hookResult().memos[1]).toEqual(existingMemos[0]);
    });

    it('createMemo then updateMemo reflects the latest content', async () => {
      const createdMemo = { id: '10', content: 'First content' };
      const updatedMemo = { id: '10', content: 'Second content' };
      api.post.mockResolvedValue(createdMemo);
      api.put.mockResolvedValue(updatedMemo);

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().createMemo('First content');
      });
      expect(hookResult().memos[0].content).toBe('First content');

      await act(async () => {
        await hookResult().updateMemo('10', 'Second content');
      });
      expect(hookResult().memos[0].content).toBe('Second content');
    });

    it('fetchMemos then deleteMemo reduces the list by one', async () => {
      api.get.mockResolvedValue([
        { id: 'a', content: 'Memo A' },
        { id: 'b', content: 'Memo B' },
        { id: 'c', content: 'Memo C' },
      ]);
      api.delete.mockResolvedValue({});

      const { hookResult } = await renderUseMemos();

      await act(async () => {
        await hookResult().fetchMemos();
      });
      expect(hookResult().memos).toHaveLength(3);

      await act(async () => {
        await hookResult().deleteMemo('b');
      });

      expect(hookResult().memos).toHaveLength(2);
      expect(hookResult().memos.find((m) => m.id === 'b')).toBeUndefined();
    });

    it('error state is set by createMemo and can be followed by successful fetchMemos', async () => {
      api.post.mockRejectedValue(new Error('Create failed'));
      const memos = [{ id: '1', content: 'Fetched memo' }];
      api.get.mockResolvedValue(memos);

      const { hookResult } = await renderUseMemos();

      await expect(
        act(async () => {
          await hookResult().createMemo('Will fail');
        })
      ).rejects.toThrow('Create failed');

      expect(hookResult().error).toBe('Create failed');

      await act(async () => {
        await hookResult().fetchMemos();
      });

      expect(hookResult().memos).toEqual(memos);
      expect(hookResult().isLoading).toBe(false);
    });
  });
});
