import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style, testID }) =>
    React.createElement('div', { style, 'data-testid': testID }, children),
  Text: ({ children, style, numberOfLines }) =>
    React.createElement('span', { style, 'data-lines': numberOfLines }, children),
  TextInput: ({ value, onChangeText, placeholder, testID, editable, multiline, maxLength }) =>
    React.createElement('textarea', {
      value: value ?? '',
      onChange: (e) => onChangeText && onChangeText(e.target.value),
      placeholder,
      'data-testid': testID,
      disabled: editable === false,
      rows: multiline ? 4 : 1,
      maxLength,
    }),
  Pressable: ({ children, onPress, disabled, testID, style }) =>
    React.createElement(
      'button',
      { onClick: disabled ? undefined : onPress, disabled, 'data-testid': testID, style },
      children
    ),
  ScrollView: ({ children, horizontal, style }) =>
    React.createElement('div', { style, 'data-horizontal': horizontal }, children),
  Image: ({ source, style }) =>
    React.createElement('img', { src: source?.uri, style }),
  ActivityIndicator: () => React.createElement('span', null, 'loading'),
  Alert: { alert: vi.fn() },
  StyleSheet: { create: (s) => s },
  Platform: { OS: 'web' },
}));

// ─── Mock expo-image-picker ───────────────────────────────────────────────────

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  MediaTypeOptions: { Images: 'Images' },
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

import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api-client';
import { MemoProvider } from '../context/MemoContext';
import { MemoInput } from '../components/MemoInput';
import { useTrash } from '../hooks/use-trash';
import { useSearch } from '../hooks/use-search';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderMemoInput(props = {}) {
  return render(
    React.createElement(MemoProvider, null, React.createElement(MemoInput, props))
  );
}

function getTextInput() {
  return screen.getByTestId('memo-text-input');
}

function getSubmitButton() {
  return screen.getByTestId('submit-memo-btn');
}

function typeContent(content) {
  fireEvent.change(getTextInput(), { target: { value: content } });
}

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

// ─── 图片大小校验边界场景 ─────────────────────────────────────────────────────

describe('图片大小校验边界场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
  });

  it('图片大小为 0 字节时，不阻止上传', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://zero.jpg', fileSize: 0 }],
    });
    renderMemoInput();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(document.querySelector('img[src="file://zero.jpg"]')).toBeTruthy();
      expect(screen.queryByText('图片大小不得超过 5MB')).toBeNull();
    });
  });

  it('图片大小恰好等于 5MB（5 * 1024 * 1024 字节），允许上传', async () => {
    const EXACTLY_5MB = 5 * 1024 * 1024;
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://exact5mb.jpg', fileSize: EXACTLY_5MB }],
    });
    renderMemoInput();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(document.querySelector('img[src="file://exact5mb.jpg"]')).toBeTruthy();
      expect(screen.queryByText('图片大小不得超过 5MB')).toBeNull();
    });
  });

  it('图片大小为 5MB + 1 字节时，拒绝上传并显示错误', async () => {
    const OVER_5MB = 5 * 1024 * 1024 + 1;
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://over5mb.jpg', fileSize: OVER_5MB }],
    });
    renderMemoInput();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(screen.getByText('图片大小不得超过 5MB')).toBeTruthy();
      expect(document.querySelector('img[src="file://over5mb.jpg"]')).toBeNull();
    });
  });

  it('图片大小接近 5MB（比 5MB 小 1 字节），允许上传', async () => {
    const UNDER_5MB = 5 * 1024 * 1024 - 1;
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://just-under.jpg', fileSize: UNDER_5MB }],
    });
    renderMemoInput();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(document.querySelector('img[src="file://just-under.jpg"]')).toBeTruthy();
      expect(screen.queryByText('图片大小不得超过 5MB')).toBeNull();
    });
  });

  it('图片大小远超 5MB（100MB），拒绝上传并显示错误', async () => {
    const HUGE = 100 * 1024 * 1024;
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://huge.jpg', fileSize: HUGE }],
    });
    renderMemoInput();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(screen.getByText('图片大小不得超过 5MB')).toBeTruthy();
      expect(document.querySelector('img')).toBeNull();
    });
  });

  it('fileSize 未提供时，跳过大小校验，允许上传', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://nosize.jpg' }],
    });
    renderMemoInput();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(document.querySelector('img[src="file://nosize.jpg"]')).toBeTruthy();
      expect(screen.queryByText('图片大小不得超过 5MB')).toBeNull();
    });
  });

  it('第一张图片超大，第二张图片正常，正常图片被允许上传', async () => {
    const OVER_5MB = 5 * 1024 * 1024 + 1;
    ImagePicker.launchImageLibraryAsync
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://toolarge.jpg', fileSize: OVER_5MB }],
      })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://ok.jpg', fileSize: 1024 }],
      });
    renderMemoInput();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(screen.getByText('图片大小不得超过 5MB')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await waitFor(() => {
      expect(screen.queryByText('图片大小不得超过 5MB')).toBeNull();
      expect(document.querySelector('img[src="file://ok.jpg"]')).toBeTruthy();
      expect(document.querySelector('img[src="file://toolarge.jpg"]')).toBeNull();
    });
  });

  it('超大图片不会被加入提交的附件列表', async () => {
    const OVER_5MB = 5 * 1024 * 1024 + 1;
    api.post.mockResolvedValue({ data: { id: '1', content: 'test' }, message: 'ok' });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://huge.jpg', fileSize: OVER_5MB }],
    });
    renderMemoInput();
    typeContent('带超大图片的笔记');

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-image-btn'));
    });

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/memos', {
        content: '带超大图片的笔记',
        attachments: [],
      });
    });
  });
});

// ─── 标签数量限制边界场景 ─────────────────────────────────────────────────────

describe('标签数量限制边界场景（前端 MemoInput）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
  });

  it('恰好 10 个标签时，不显示错误，提交成功', async () => {
    const tenTags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(' ') + ' 正文';
    api.post.mockResolvedValue({ data: { id: '1', content: tenTags }, message: 'ok' });
    renderMemoInput();
    typeContent(tenTags);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
      expect(screen.queryByText('标签数量不能超过 10 个')).toBeNull();
    });
  });

  it('11 个标签时，显示错误，不提交', async () => {
    const elevenTags = Array.from({ length: 11 }, (_, i) => `#tag${i}`).join(' ');
    renderMemoInput();
    typeContent(elevenTags);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(screen.getByText('标签数量不能超过 10 个')).toBeTruthy();
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  it('重复标签去重后不超过 10 个，提交成功', async () => {
    const tagsWithDups = '#tag0 #tag1 #tag2 #tag0 #tag1 #tag2';
    api.post.mockResolvedValue({ data: { id: '2', content: tagsWithDups }, message: 'ok' });
    renderMemoInput();
    typeContent(tagsWithDups);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
      expect(screen.queryByText('标签数量不能超过 10 个')).toBeNull();
    });
  });

  it('0 个标签时，提交成功', async () => {
    api.post.mockResolvedValue({ data: { id: '3', content: '无标签笔记' }, message: 'ok' });
    renderMemoInput();
    typeContent('无标签笔记');

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });

  it('输入 11 个标签后修改为 10 个，错误消失，提交成功', async () => {
    const elevenTags = Array.from({ length: 11 }, (_, i) => `#tag${i}`).join(' ');
    renderMemoInput();
    typeContent(elevenTags);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(screen.getByText('标签数量不能超过 10 个')).toBeTruthy();
    });

    const tenTags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(' ') + ' 正文';
    api.post.mockResolvedValue({ data: { id: '4', content: tenTags }, message: 'ok' });
    typeContent(tenTags);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(screen.queryByText('标签数量不能超过 10 个')).toBeNull();
      expect(api.post).toHaveBeenCalled();
    });
  });

  it('标签名超过 20 字符时，只截取前 20 字符，不影响数量计数', async () => {
    const longTag = '#' + 'a'.repeat(25);
    renderMemoInput();
    typeContent(longTag);

    const badge = screen.queryByText('#' + 'a'.repeat(25));
    expect(badge).toBeNull();

    const partialBadge = screen.queryByText('#' + 'a'.repeat(20));
    expect(partialBadge).toBeTruthy();
  });
});

// ─── 搜索分页边界场景（前端 useSearch）─────────────────────────────────────

describe('搜索分页边界场景（useSearch）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('搜索关键词为 200 字符时，正常搜索', async () => {
    const longQuery = 'a'.repeat(200);
    api.get.mockResolvedValue([]);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery(longQuery);
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `/api/memos?q=${encodeURIComponent(longQuery)}`
      );
    });
  });

  it('搜索关键词超过 200 字符时，不发请求', async () => {
    const tooLong = 'a'.repeat(201);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery(tooLong);
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(hookResult().isSearching).toBe(false);
  });

  it('搜索关键词为空字符串时，清空搜索结果', async () => {
    api.get.mockResolvedValue([{ id: '1', content: '结果' }]);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('关键词');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(hookResult().searchResults).toHaveLength(1);
    });

    await act(async () => {
      hookResult().setQuery('');
    });

    expect(hookResult().isSearching).toBe(false);
    expect(hookResult().searchQuery).toBe('');
  });

  it('搜索关键词为纯空白字符时，不发请求', async () => {
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('   ');
    });

    expect(hookResult().isSearching).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('搜索返回空数组时，searchResults 为空数组', async () => {
    api.get.mockResolvedValue([]);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('不存在的关键词');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(hookResult().searchResults).toEqual([]);
      expect(hookResult().isSearching).toBe(false);
    });
  });

  it('clearSearch 后 isSearching 变为 false，searchResults 清空', async () => {
    api.get.mockResolvedValue([{ id: '1', content: '结果' }]);
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('关键词');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(hookResult().searchResults).toHaveLength(1);
    });

    await act(async () => {
      hookResult().clearSearch();
    });

    expect(hookResult().query).toBe('');
    expect(hookResult().searchQuery).toBe('');
    expect(hookResult().searchResults).toEqual([]);
    expect(hookResult().isSearching).toBe(false);
  });

  it('搜索 API 报错后，不抛出异常', async () => {
    api.get.mockRejectedValue(new Error('Network failure'));
    const { hookResult } = await renderHook(useSearch);

    await act(async () => {
      hookResult().setQuery('失败查询');
    });

    await expect(
      act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      })
    ).resolves.not.toThrow();
  });
});

// ─── 回收站清空边界场景（前端 useTrash）─────────────────────────────────────

describe('回收站清空边界场景（useTrash）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('回收站为空时，trashCount 初始为 0', async () => {
    const { hookResult } = await renderHook(useTrash);
    expect(hookResult().trashCount).toBe(0);
    expect(hookResult().trashMemos).toEqual([]);
  });

  it('永久删除最后一条回收站笔记后，trashCount 为 0', async () => {
    const trashMemos = [{ id: 'last-memo', content: '最后一条' }];
    api.get.mockResolvedValue(trashMemos);
    api.delete.mockResolvedValue({});

    const { hookResult } = await renderHook(useTrash);

    await act(async () => {
      await hookResult().fetchTrash();
    });
    expect(hookResult().trashCount).toBe(1);

    await act(async () => {
      await hookResult().permanentDeleteMemo('last-memo');
    });

    expect(hookResult().trashMemos).toHaveLength(0);
    expect(hookResult().trashCount).toBe(0);
  });

  it('恢复最后一条回收站笔记后，trashCount 为 0', async () => {
    const trashMemos = [{ id: 'restore-memo', content: '待恢复' }];
    api.get.mockResolvedValue(trashMemos);
    api.post.mockResolvedValue({});

    const { hookResult } = await renderHook(useTrash);

    await act(async () => {
      await hookResult().fetchTrash();
    });
    expect(hookResult().trashCount).toBe(1);

    await act(async () => {
      await hookResult().restoreMemo('restore-memo');
    });

    expect(hookResult().trashMemos).toHaveLength(0);
    expect(hookResult().trashCount).toBe(0);
  });

  it('批量永久删除所有笔记后，trashCount 为 0', async () => {
    const trashMemos = [
      { id: 'memo-1', content: '笔记 1' },
      { id: 'memo-2', content: '笔记 2' },
      { id: 'memo-3', content: '笔记 3' },
    ];
    api.get.mockResolvedValue(trashMemos);
    api.delete.mockResolvedValue({});

    const { hookResult } = await renderHook(useTrash);

    await act(async () => {
      await hookResult().fetchTrash();
    });
    expect(hookResult().trashCount).toBe(3);

    for (const memo of trashMemos) {
      await act(async () => {
        await hookResult().permanentDeleteMemo(memo.id);
      });
    }

    expect(hookResult().trashMemos).toHaveLength(0);
    expect(hookResult().trashCount).toBe(0);
  });

  it('trashCount 不会因对不存在的笔记操作而降到 0 以下', async () => {
    api.delete.mockResolvedValue({});
    const { hookResult } = await renderHook(useTrash);

    expect(hookResult().trashCount).toBe(0);

    await act(async () => {
      await hookResult().permanentDeleteMemo('nonexistent-id');
    });

    expect(hookResult().trashCount).toBe(0);
  });

  it('fetchTrash 返回空数组时，trashCount 为 0', async () => {
    api.get.mockResolvedValue([]);
    const { hookResult } = await renderHook(useTrash);

    await act(async () => {
      await hookResult().fetchTrash();
    });

    expect(hookResult().trashMemos).toEqual([]);
    expect(hookResult().trashCount).toBe(0);
  });

  it('fetchTrash API 报错后，回收站状态保持不变', async () => {
    const trashMemos = [{ id: 't1', content: '笔记' }];
    api.get
      .mockResolvedValueOnce(trashMemos)
      .mockRejectedValueOnce(new Error('fetch failed'));

    const { hookResult } = await renderHook(useTrash);

    await act(async () => {
      await hookResult().fetchTrash();
    });
    expect(hookResult().trashCount).toBe(1);

    await act(async () => {
      await hookResult().fetchTrash();
    });

    expect(hookResult().trashCount).toBe(1);
    expect(hookResult().trashMemos).toEqual(trashMemos);
  });

  it('permanentDeleteMemo API 报错时，抛出异常，本地状态不变', async () => {
    const trashMemos = [{ id: 'err-memo', content: '报错笔记' }];
    api.get.mockResolvedValue(trashMemos);
    api.delete.mockRejectedValue(new Error('Delete failed'));

    const { hookResult } = await renderHook(useTrash);

    await act(async () => {
      await hookResult().fetchTrash();
    });
    expect(hookResult().trashCount).toBe(1);

    await expect(
      act(async () => {
        await hookResult().permanentDeleteMemo('err-memo');
      })
    ).rejects.toThrow('Delete failed');

    expect(hookResult().trashCount).toBe(1);
    expect(hookResult().trashMemos).toHaveLength(1);
  });
});
