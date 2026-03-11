import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style, testID }) =>
    React.createElement('div', { style, 'data-testid': testID }, children),
  Text: ({ children, style, testID, numberOfLines }) =>
    React.createElement('span', { style, 'data-testid': testID, 'data-lines': numberOfLines }, children),
  Pressable: ({ children, onPress, testID, style, accessibilityLabel, accessibilityRole }) =>
    React.createElement(
      'button',
      { onClick: onPress, 'data-testid': testID, style, 'aria-label': accessibilityLabel, role: accessibilityRole },
      children
    ),
  ScrollView: ({ children, horizontal, style, contentContainerStyle, testID, showsHorizontalScrollIndicator }) =>
    React.createElement(
      'div',
      { style, 'data-horizontal': horizontal, 'data-testid': testID },
      children
    ),
  Image: ({ source, style, testID }) =>
    React.createElement('img', { src: source?.uri, style, 'data-testid': testID }),
  ActivityIndicator: ({ size, color, testID }) =>
    React.createElement('span', { 'data-testid': testID ?? 'activity-indicator' }, 'loading'),
  FlatList: ({ data, renderItem, keyExtractor, testID, ListEmptyComponent, ListFooterComponent, contentContainerStyle }) => {
    const items = data && data.length > 0
      ? data.map((item, index) =>
          React.createElement(
            'div',
            { key: keyExtractor ? keyExtractor(item) : index, 'data-testid': `flatlist-item-${keyExtractor ? keyExtractor(item) : index}` },
            renderItem({ item, index })
          )
        )
      : null;
    return React.createElement(
      'div',
      { 'data-testid': testID },
      items,
      (!data || data.length === 0) && ListEmptyComponent ? ListEmptyComponent : null,
      ListFooterComponent ? ListFooterComponent : null
    );
  },
  Modal: ({ children, visible, transparent, animationType, onRequestClose, testID }) => {
    if (!visible) return null;
    return React.createElement(
      'div',
      { 'data-testid': testID, 'data-transparent': transparent, 'data-animation': animationType },
      children
    );
  },
  StyleSheet: {
    create: (s) => s,
    hairlineWidth: 1,
  },
  Platform: {
    OS: 'web',
    select: (obj) => obj.default ?? obj.web ?? obj.ios,
  },
}));

// ─── Mock expo-image-picker (used transitively by AttachmentPreview) ──────────

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

import { MemoCard } from '../components/MemoCard';
import { MemoList } from '../components/MemoList';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMemo(overrides = {}) {
  return {
    id: 'memo-1',
    content: 'Hello world',
    createdAt: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    tags: [],
    attachments: [],
    ...overrides,
  };
}

// ─── MemoCard Tests ───────────────────────────────────────────────────────────

describe('MemoCard', () => {
  // ─── Rendering ─────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the card with correct testID', () => {
      const memo = makeMemo({ id: 'abc' });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-card-abc')).toBeTruthy();
    });

    it('renders the memo content text', () => {
      const memo = makeMemo({ content: 'My test memo content' });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId(`memo-content-${memo.id}`)).toBeTruthy();
    });

    it('renders the date text', () => {
      const memo = makeMemo();
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId(`memo-date-${memo.id}`)).toBeTruthy();
    });

    it('renders the menu button', () => {
      const memo = makeMemo();
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId(`memo-menu-btn-${memo.id}`)).toBeTruthy();
    });

    it('does not render tags section when memo has no tags', () => {
      const memo = makeMemo({ tags: [] });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.queryByTestId(`memo-tags-${memo.id}`)).toBeNull();
    });

    it('renders tags section when memo has tags (array of objects)', () => {
      const memo = makeMemo({ id: 'tag-obj', tags: [{ name: 'work' }, { name: 'life' }] });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-tags-tag-obj')).toBeTruthy();
      expect(screen.getByText('#work')).toBeTruthy();
      expect(screen.getByText('#life')).toBeTruthy();
    });

    it('renders tags section when memo has tags (array of strings)', () => {
      const memo = makeMemo({ id: 'tag-str', tags: ['reading', 'notes'] });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-tags-tag-str')).toBeTruthy();
      expect(screen.getByText('#reading')).toBeTruthy();
      expect(screen.getByText('#notes')).toBeTruthy();
    });

    it('does not render attachments when memo has no attachments', () => {
      const memo = makeMemo({ attachments: [] });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.queryByTestId('attachment-preview-images')).toBeNull();
      expect(screen.queryByTestId('attachment-preview-links')).toBeNull();
    });

    it('renders image attachments when present', () => {
      const memo = makeMemo({
        id: 'with-img',
        attachments: [{ type: 'image', url: 'https://example.com/img.jpg' }],
      });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('attachment-preview-images')).toBeTruthy();
    });

    it('renders link attachments when present', () => {
      const memo = makeMemo({
        id: 'with-link',
        attachments: [{ type: 'link', url: 'https://example.com' }],
      });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('attachment-preview-links')).toBeTruthy();
    });

    it('handles undefined tags gracefully (defaults to empty array)', () => {
      const memo = { id: 'no-tags', content: 'test', createdAt: new Date().toISOString() };
      render(React.createElement(MemoCard, { memo }));
      expect(screen.queryByTestId('memo-tags-no-tags')).toBeNull();
    });

    it('handles undefined attachments gracefully (defaults to empty array)', () => {
      const memo = { id: 'no-attach', content: 'test', createdAt: new Date().toISOString() };
      render(React.createElement(MemoCard, { memo }));
      expect(screen.queryByTestId('attachment-preview-images')).toBeNull();
    });
  });

  // ─── Date Formatting ────────────────────────────────────────────────────────

  describe('date formatting', () => {
    it('shows "刚刚" for a very recent memo (less than 1 minute ago)', () => {
      const memo = makeMemo({ id: 'recent', createdAt: new Date(Date.now() - 30000).toISOString() });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-date-recent').textContent).toBe('刚刚');
    });

    it('shows minutes ago for a memo created minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const memo = makeMemo({ id: 'minutes-ago', createdAt: fiveMinutesAgo });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-date-minutes-ago').textContent).toBe('5 分钟前');
    });

    it('shows hours ago for a memo created hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      const memo = makeMemo({ id: 'hours-ago', createdAt: twoHoursAgo });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-date-hours-ago').textContent).toBe('2 小时前');
    });

    it('shows days ago for a memo created days ago (under 7 days)', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      const memo = makeMemo({ id: 'days-ago', createdAt: threeDaysAgo });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-date-days-ago').textContent).toBe('3 天前');
    });

    it('shows formatted date for memos older than 7 days', () => {
      const oldDate = new Date('2025-01-15T10:30:00.000Z');
      const memo = makeMemo({ id: 'old-memo', createdAt: oldDate.toISOString() });
      render(React.createElement(MemoCard, { memo }));
      const dateText = screen.getByTestId('memo-date-old-memo').textContent;
      expect(dateText).toMatch(/2025-01-1\d \d\d:\d\d/);
    });

    it('renders empty string for invalid date', () => {
      const memo = makeMemo({ id: 'bad-date', createdAt: 'not-a-date' });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-date-bad-date').textContent).toBe('');
    });

    it('renders empty string when createdAt is null', () => {
      const memo = makeMemo({ id: 'null-date', createdAt: null });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-date-null-date').textContent).toBe('');
    });
  });

  // ─── Context Menu ───────────────────────────────────────────────────────────

  describe('context menu', () => {
    it('menu modal is not visible initially', () => {
      const memo = makeMemo({ id: 'menu-hidden' });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.queryByTestId('memo-menu-modal-menu-hidden')).toBeNull();
    });

    it('opens the menu modal when menu button is pressed', () => {
      const memo = makeMemo({ id: 'menu-open' });
      render(React.createElement(MemoCard, { memo }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-menu-open'));
      expect(screen.getByTestId('memo-menu-modal-menu-open')).toBeTruthy();
    });

    it('closes the menu modal when overlay is pressed', () => {
      const memo = makeMemo({ id: 'menu-close' });
      render(React.createElement(MemoCard, { memo }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-menu-close'));
      expect(screen.getByTestId('memo-menu-modal-menu-close')).toBeTruthy();

      fireEvent.click(screen.getByTestId('memo-menu-overlay-menu-close'));
      expect(screen.queryByTestId('memo-menu-modal-menu-close')).toBeNull();
    });

    it('closes the menu modal when cancel button is pressed', () => {
      const memo = makeMemo({ id: 'cancel-btn' });
      render(React.createElement(MemoCard, { memo }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-cancel-btn'));
      expect(screen.getByTestId('memo-menu-modal-cancel-btn')).toBeTruthy();

      fireEvent.click(screen.getByTestId('memo-cancel-btn-cancel-btn'));
      expect(screen.queryByTestId('memo-menu-modal-cancel-btn')).toBeNull();
    });

    it('does not render edit button when onEdit is not provided', () => {
      const memo = makeMemo({ id: 'no-edit' });
      render(React.createElement(MemoCard, { memo, onDelete: vi.fn() }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-no-edit'));
      expect(screen.queryByTestId('memo-edit-btn-no-edit')).toBeNull();
    });

    it('does not render delete button when onDelete is not provided', () => {
      const memo = makeMemo({ id: 'no-delete' });
      render(React.createElement(MemoCard, { memo, onEdit: vi.fn() }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-no-delete'));
      expect(screen.queryByTestId('memo-delete-btn-no-delete')).toBeNull();
    });

    it('renders edit button when onEdit is provided', () => {
      const memo = makeMemo({ id: 'has-edit' });
      render(React.createElement(MemoCard, { memo, onEdit: vi.fn() }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-has-edit'));
      expect(screen.getByTestId('memo-edit-btn-has-edit')).toBeTruthy();
    });

    it('renders delete button when onDelete is provided', () => {
      const memo = makeMemo({ id: 'has-delete' });
      render(React.createElement(MemoCard, { memo, onDelete: vi.fn() }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-has-delete'));
      expect(screen.getByTestId('memo-delete-btn-has-delete')).toBeTruthy();
    });

    it('calls onEdit with memo and closes menu when edit button is pressed', () => {
      const memo = makeMemo({ id: 'edit-cb' });
      const onEdit = vi.fn();
      render(React.createElement(MemoCard, { memo, onEdit }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-edit-cb'));
      fireEvent.click(screen.getByTestId('memo-edit-btn-edit-cb'));

      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onEdit).toHaveBeenCalledWith(memo);
      expect(screen.queryByTestId('memo-menu-modal-edit-cb')).toBeNull();
    });

    it('calls onDelete with memo and closes menu when delete button is pressed', () => {
      const memo = makeMemo({ id: 'delete-cb' });
      const onDelete = vi.fn();
      render(React.createElement(MemoCard, { memo, onDelete }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-delete-cb'));
      fireEvent.click(screen.getByTestId('memo-delete-btn-delete-cb'));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(memo);
      expect(screen.queryByTestId('memo-menu-modal-delete-cb')).toBeNull();
    });

    it('renders both edit and delete buttons when both callbacks are provided', () => {
      const memo = makeMemo({ id: 'both-btns' });
      render(React.createElement(MemoCard, { memo, onEdit: vi.fn(), onDelete: vi.fn() }));
      fireEvent.click(screen.getByTestId('memo-menu-btn-both-btns'));
      expect(screen.getByTestId('memo-edit-btn-both-btns')).toBeTruthy();
      expect(screen.getByTestId('memo-delete-btn-both-btns')).toBeTruthy();
      expect(screen.getByTestId('memo-cancel-btn-both-btns')).toBeTruthy();
    });
  });

  // ─── Highlight Keyword ──────────────────────────────────────────────────────

  describe('highlight keyword prop', () => {
    it('passes highlight prop to HighlightText without error', () => {
      const memo = makeMemo({ id: 'hl', content: 'Hello world from memo' });
      render(React.createElement(MemoCard, { memo, highlight: 'world' }));
      expect(screen.getByTestId(`memo-content-hl`)).toBeTruthy();
    });

    it('renders content without highlight when highlight prop is undefined', () => {
      const memo = makeMemo({ id: 'no-hl', content: 'Simple content' });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByTestId('memo-content-no-hl')).toBeTruthy();
    });

    it('renders content without highlight when highlight prop is empty string', () => {
      const memo = makeMemo({ id: 'empty-hl', content: 'Some content' });
      render(React.createElement(MemoCard, { memo, highlight: '' }));
      expect(screen.getByTestId('memo-content-empty-hl')).toBeTruthy();
    });
  });

  // ─── Multiple Tags ──────────────────────────────────────────────────────────

  describe('multiple tags', () => {
    it('renders a tag badge with # prefix for each tag', () => {
      const memo = makeMemo({
        id: 'multi-tags',
        tags: [{ name: 'work' }, { name: 'personal' }, { name: 'urgent' }],
      });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByText('#work')).toBeTruthy();
      expect(screen.getByText('#personal')).toBeTruthy();
      expect(screen.getByText('#urgent')).toBeTruthy();
    });

    it('handles mixed tag format (string and object in same list)', () => {
      const memo = makeMemo({
        id: 'mixed-tags',
        tags: ['tagA', { name: 'tagB' }],
      });
      render(React.createElement(MemoCard, { memo }));
      expect(screen.getByText('#tagA')).toBeTruthy();
      expect(screen.getByText('#tagB')).toBeTruthy();
    });
  });
});

// ─── MemoList Tests ───────────────────────────────────────────────────────────

describe('MemoList', () => {
  function renderMemoList(props = {}) {
    const defaults = {
      memos: [],
      isLoading: false,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onRefresh: vi.fn(),
      refreshing: false,
    };
    return render(React.createElement(MemoList, { ...defaults, ...props }));
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the FlatList container with testID "memo-list"', () => {
      renderMemoList();
      expect(screen.getByTestId('memo-list')).toBeTruthy();
    });

    it('renders memo cards for each memo in the list', () => {
      const memos = [
        makeMemo({ id: 'list-1', content: 'First memo' }),
        makeMemo({ id: 'list-2', content: 'Second memo' }),
        makeMemo({ id: 'list-3', content: 'Third memo' }),
      ];
      renderMemoList({ memos });
      expect(screen.getByTestId('memo-card-list-1')).toBeTruthy();
      expect(screen.getByTestId('memo-card-list-2')).toBeTruthy();
      expect(screen.getByTestId('memo-card-list-3')).toBeTruthy();
    });

    it('renders memo content for each card', () => {
      const memos = [
        makeMemo({ id: 'content-1', content: 'Alpha content' }),
        makeMemo({ id: 'content-2', content: 'Beta content' }),
      ];
      renderMemoList({ memos });
      expect(screen.getByTestId('memo-content-content-1')).toBeTruthy();
      expect(screen.getByTestId('memo-content-content-2')).toBeTruthy();
    });
  });

  // ─── Empty State ────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state message when memos array is empty and not loading', () => {
      renderMemoList({ memos: [], isLoading: false });
      expect(screen.getByTestId('memo-list-empty')).toBeTruthy();
      expect(screen.getByText('暂无笔记，快来记录第一条吧')).toBeTruthy();
    });

    it('does not show empty state message when there are memos', () => {
      renderMemoList({ memos: [makeMemo()] });
      expect(screen.queryByTestId('memo-list-empty')).toBeNull();
    });

    it('does not show empty state message when loading (even if memos is empty)', () => {
      renderMemoList({ memos: [], isLoading: true });
      expect(screen.queryByTestId('memo-list-empty')).toBeNull();
    });

    it('does not show empty state when memos is null-like (no crash)', () => {
      // Defensive: memos array with 0 items but isLoading=true
      renderMemoList({ memos: [], isLoading: true });
      expect(screen.queryByText('暂无笔记，快来记录第一条吧')).toBeNull();
    });
  });

  // ─── Loading State ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows loading indicator in footer when isLoading=true and there are memos', () => {
      const memos = [makeMemo({ id: 'loading-memo' })];
      renderMemoList({ memos, isLoading: true });
      expect(screen.getByTestId('memo-list-loading')).toBeTruthy();
    });

    it('does not show loading indicator in footer when isLoading=false', () => {
      const memos = [makeMemo({ id: 'not-loading' })];
      renderMemoList({ memos, isLoading: false });
      expect(screen.queryByTestId('memo-list-loading')).toBeNull();
    });

    it('does not show loading indicator in footer when list is empty (even if isLoading=true)', () => {
      // Footer loading is only shown when isLoading && memos.length > 0
      renderMemoList({ memos: [], isLoading: true });
      expect(screen.queryByTestId('memo-list-loading')).toBeNull();
    });
  });

  // ─── Callbacks ─────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('passes onEdit callback down to MemoCard', () => {
      const onEdit = vi.fn();
      const memo = makeMemo({ id: 'edit-pass' });
      renderMemoList({ memos: [memo], onEdit });
      fireEvent.click(screen.getByTestId('memo-menu-btn-edit-pass'));
      fireEvent.click(screen.getByTestId('memo-edit-btn-edit-pass'));
      expect(onEdit).toHaveBeenCalledWith(memo);
    });

    it('passes onDelete callback down to MemoCard', () => {
      const onDelete = vi.fn();
      const memo = makeMemo({ id: 'delete-pass' });
      renderMemoList({ memos: [memo], onDelete });
      fireEvent.click(screen.getByTestId('memo-menu-btn-delete-pass'));
      fireEvent.click(screen.getByTestId('memo-delete-btn-delete-pass'));
      expect(onDelete).toHaveBeenCalledWith(memo);
    });
  });

  // ─── Refreshing ────────────────────────────────────────────────────────────

  describe('refreshing prop', () => {
    it('defaults refreshing to false when prop is not provided', () => {
      const memos = [makeMemo()];
      // Should not throw even when refreshing is not explicitly provided
      expect(() => renderMemoList({ memos, refreshing: undefined })).not.toThrow();
    });

    it('renders without error when refreshing=true', () => {
      const memos = [makeMemo()];
      expect(() => renderMemoList({ memos, refreshing: true })).not.toThrow();
    });
  });

  // ─── Multiple Memos ─────────────────────────────────────────────────────────

  describe('multiple memos with tags and attachments', () => {
    it('renders tags for memos that have tags', () => {
      const memos = [
        makeMemo({ id: 'tagged', tags: [{ name: 'coding' }] }),
        makeMemo({ id: 'untagged', tags: [] }),
      ];
      renderMemoList({ memos });
      expect(screen.getByText('#coding')).toBeTruthy();
      expect(screen.queryByTestId('memo-tags-untagged')).toBeNull();
    });

    it('renders image attachments for memos that have images', () => {
      const memos = [
        makeMemo({
          id: 'with-attach',
          attachments: [{ type: 'image', url: 'https://img.example.com/photo.jpg' }],
        }),
        makeMemo({ id: 'no-attach', attachments: [] }),
      ];
      renderMemoList({ memos });
      expect(screen.getByTestId('attachment-preview-images')).toBeTruthy();
    });

    it('renders link attachments for memos that have links', () => {
      const memos = [
        makeMemo({
          id: 'with-link',
          attachments: [{ type: 'link', url: 'https://link.example.com' }],
        }),
      ];
      renderMemoList({ memos });
      expect(screen.getByTestId('attachment-preview-links')).toBeTruthy();
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('renders a single memo without error', () => {
      const memo = makeMemo({ id: 'single', content: 'Solo memo' });
      renderMemoList({ memos: [memo] });
      expect(screen.getByTestId('memo-card-single')).toBeTruthy();
    });

    it('renders many memos without error', () => {
      const memos = Array.from({ length: 20 }, (_, i) =>
        makeMemo({ id: `bulk-${i}`, content: `Memo ${i}` })
      );
      renderMemoList({ memos });
      expect(screen.getByTestId('memo-card-bulk-0')).toBeTruthy();
      expect(screen.getByTestId('memo-card-bulk-19')).toBeTruthy();
    });

    it('renders memo with both tags and attachments correctly', () => {
      const memo = makeMemo({
        id: 'full-memo',
        content: 'Full featured memo',
        tags: [{ name: 'important' }],
        attachments: [{ type: 'image', url: 'https://example.com/img.png' }],
      });
      renderMemoList({ memos: [memo] });
      expect(screen.getByTestId('memo-card-full-memo')).toBeTruthy();
      expect(screen.getByText('#important')).toBeTruthy();
      expect(screen.getByTestId('attachment-preview-images')).toBeTruthy();
    });
  });
});
