import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style, testID }) =>
    React.createElement('div', { style, 'data-testid': testID }, children),
  Text: ({ children, style, testID, numberOfLines }) =>
    React.createElement('span', { style, 'data-testid': testID, 'data-lines': numberOfLines }, children),
  Pressable: ({ children, onPress, testID, style, accessibilityRole, accessibilityLabel, accessibilityState }) =>
    React.createElement(
      'button',
      {
        onClick: onPress,
        'data-testid': testID,
        style,
        role: accessibilityRole,
        'aria-label': accessibilityLabel,
        'aria-selected': accessibilityState?.selected,
      },
      children
    ),
  ScrollView: ({ children, style, testID, showsVerticalScrollIndicator }) =>
    React.createElement('div', { style, 'data-testid': testID }, children),
  FlatList: ({ data, renderItem, keyExtractor, testID, contentContainerStyle }) => {
    const items = data && data.length > 0
      ? data.map((item, index) =>
          React.createElement(
            'div',
            { key: keyExtractor ? keyExtractor(item) : index },
            renderItem({ item, index })
          )
        )
      : null;
    return React.createElement('div', { 'data-testid': testID }, items);
  },
  ActivityIndicator: ({ size, color, testID }) =>
    React.createElement('span', { 'data-testid': testID ?? 'activity-indicator' }, 'loading'),
  StyleSheet: {
    create: (s) => s,
    hairlineWidth: 1,
  },
  Platform: {
    OS: 'web',
    select: (obj) => obj.default ?? obj.web ?? obj.ios,
  },
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

// ─── Mock hooks used by SidebarFilter ────────────────────────────────────────

vi.mock('@/hooks/use-memos', () => ({
  useMemos: vi.fn(),
}));

vi.mock('@/hooks/use-tags', () => ({
  useTags: vi.fn(),
}));

import { useMemos } from '@/hooks/use-memos';
import { useTags } from '@/hooks/use-tags';
import { SidebarFilter } from '../components/SidebarFilter';
import { TagList } from '../components/TagList';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTag(overrides = {}) {
  return {
    id: 'tag-1',
    name: 'work',
    memoCount: 5,
    ...overrides,
  };
}

function defaultUseMemos() {
  return {
    filter: { type: 'all', tagId: null },
    applyFilter: vi.fn(),
    isLoading: false,
  };
}

function defaultUseTags(tags = []) {
  return { tags };
}

// ─── SidebarFilter Tests ──────────────────────────────────────────────────────

describe('SidebarFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMemos.mockReturnValue(defaultUseMemos());
    useTags.mockReturnValue(defaultUseTags());
  });

  // ─── Rendering ─────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the root container with testID "sidebar-filter"', () => {
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-filter')).toBeTruthy();
    });

    it('renders the "筛选类型" section title', () => {
      render(React.createElement(SidebarFilter));
      expect(screen.getByText('筛选类型')).toBeTruthy();
    });

    it('renders the "标签" section title', () => {
      render(React.createElement(SidebarFilter));
      expect(screen.getByText('标签')).toBeTruthy();
    });

    it('renders all four type filter items', () => {
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-type-all')).toBeTruthy();
      expect(screen.getByTestId('sidebar-type-untagged')).toBeTruthy();
      expect(screen.getByTestId('sidebar-type-image')).toBeTruthy();
      expect(screen.getByTestId('sidebar-type-link')).toBeTruthy();
    });

    it('renders the correct labels for each type filter', () => {
      render(React.createElement(SidebarFilter));
      expect(screen.getByText('全部笔记')).toBeTruthy();
      expect(screen.getByText('无标签')).toBeTruthy();
      expect(screen.getByText('有图片')).toBeTruthy();
      expect(screen.getByText('有链接')).toBeTruthy();
    });
  });

  // ─── Active State — Type Filters ────────────────────────────────────────────

  describe('type filter active state', () => {
    it('marks "全部笔记" as active when filter.type is "all" and tagId is null', () => {
      useMemos.mockReturnValue({
        ...defaultUseMemos(),
        filter: { type: 'all', tagId: null },
      });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-type-all').getAttribute('aria-selected')).toBe('true');
    });

    it('marks "无标签" as active when filter.type is "untagged" and tagId is null', () => {
      useMemos.mockReturnValue({
        ...defaultUseMemos(),
        filter: { type: 'untagged', tagId: null },
      });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-type-untagged').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('sidebar-type-all').getAttribute('aria-selected')).toBe('false');
    });

    it('marks "有图片" as active when filter.type is "image" and tagId is null', () => {
      useMemos.mockReturnValue({
        ...defaultUseMemos(),
        filter: { type: 'image', tagId: null },
      });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-type-image').getAttribute('aria-selected')).toBe('true');
    });

    it('marks "有链接" as active when filter.type is "link" and tagId is null', () => {
      useMemos.mockReturnValue({
        ...defaultUseMemos(),
        filter: { type: 'link', tagId: null },
      });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-type-link').getAttribute('aria-selected')).toBe('true');
    });

    it('does not mark any type filter as active when a tag is selected (tagId is set)', () => {
      useMemos.mockReturnValue({
        ...defaultUseMemos(),
        filter: { type: 'all', tagId: 'tag-1' },
      });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-type-all').getAttribute('aria-selected')).toBe('false');
      expect(screen.getByTestId('sidebar-type-untagged').getAttribute('aria-selected')).toBe('false');
      expect(screen.getByTestId('sidebar-type-image').getAttribute('aria-selected')).toBe('false');
      expect(screen.getByTestId('sidebar-type-link').getAttribute('aria-selected')).toBe('false');
    });
  });

  // ─── Type Filter Interactions ────────────────────────────────────────────────

  describe('type filter interactions', () => {
    it('calls applyFilter with { type: "all", tagId: null } when "全部笔记" is pressed', () => {
      const applyFilter = vi.fn();
      useMemos.mockReturnValue({ ...defaultUseMemos(), applyFilter });
      render(React.createElement(SidebarFilter));
      fireEvent.click(screen.getByTestId('sidebar-type-all'));
      expect(applyFilter).toHaveBeenCalledWith({ type: 'all', tagId: null });
    });

    it('calls applyFilter with { type: "untagged", tagId: null } when "无标签" is pressed', () => {
      const applyFilter = vi.fn();
      useMemos.mockReturnValue({ ...defaultUseMemos(), applyFilter });
      render(React.createElement(SidebarFilter));
      fireEvent.click(screen.getByTestId('sidebar-type-untagged'));
      expect(applyFilter).toHaveBeenCalledWith({ type: 'untagged', tagId: null });
    });

    it('calls applyFilter with { type: "image", tagId: null } when "有图片" is pressed', () => {
      const applyFilter = vi.fn();
      useMemos.mockReturnValue({ ...defaultUseMemos(), applyFilter });
      render(React.createElement(SidebarFilter));
      fireEvent.click(screen.getByTestId('sidebar-type-image'));
      expect(applyFilter).toHaveBeenCalledWith({ type: 'image', tagId: null });
    });

    it('calls applyFilter with { type: "link", tagId: null } when "有链接" is pressed', () => {
      const applyFilter = vi.fn();
      useMemos.mockReturnValue({ ...defaultUseMemos(), applyFilter });
      render(React.createElement(SidebarFilter));
      fireEvent.click(screen.getByTestId('sidebar-type-link'));
      expect(applyFilter).toHaveBeenCalledWith({ type: 'link', tagId: null });
    });

    it('calls applyFilter exactly once per click', () => {
      const applyFilter = vi.fn();
      useMemos.mockReturnValue({ ...defaultUseMemos(), applyFilter });
      render(React.createElement(SidebarFilter));
      fireEvent.click(screen.getByTestId('sidebar-type-untagged'));
      expect(applyFilter).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Tag Section — Empty / Loading ──────────────────────────────────────────

  describe('tag section states', () => {
    it('shows loading indicator when isLoading=true and tags is empty', () => {
      useMemos.mockReturnValue({ ...defaultUseMemos(), isLoading: true });
      useTags.mockReturnValue({ tags: [] });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-tags-loading')).toBeTruthy();
    });

    it('does not show loading indicator when isLoading=false', () => {
      useMemos.mockReturnValue({ ...defaultUseMemos(), isLoading: false });
      useTags.mockReturnValue({ tags: [] });
      render(React.createElement(SidebarFilter));
      expect(screen.queryByTestId('sidebar-tags-loading')).toBeNull();
    });

    it('does not show loading indicator when tags are present even if isLoading=true', () => {
      useMemos.mockReturnValue({ ...defaultUseMemos(), isLoading: true });
      useTags.mockReturnValue({ tags: [makeTag()] });
      render(React.createElement(SidebarFilter));
      expect(screen.queryByTestId('sidebar-tags-loading')).toBeNull();
    });

    it('shows empty tags text "暂无标签" when tags is empty and not loading', () => {
      useMemos.mockReturnValue({ ...defaultUseMemos(), isLoading: false });
      useTags.mockReturnValue({ tags: [] });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-tags-empty')).toBeTruthy();
      expect(screen.getByText('暂无标签')).toBeTruthy();
    });

    it('does not show empty tags text when there are tags', () => {
      useTags.mockReturnValue({ tags: [makeTag()] });
      render(React.createElement(SidebarFilter));
      expect(screen.queryByTestId('sidebar-tags-empty')).toBeNull();
    });

    it('renders the tag list ScrollView when tags are present', () => {
      useTags.mockReturnValue({ tags: [makeTag()] });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-tag-list')).toBeTruthy();
    });
  });

  // ─── Tag Items in SidebarFilter ──────────────────────────────────────────────

  describe('tag items', () => {
    it('renders a tag item for each tag', () => {
      const tags = [
        makeTag({ id: 'tag-1', name: 'work' }),
        makeTag({ id: 'tag-2', name: 'life' }),
        makeTag({ id: 'tag-3', name: 'study' }),
      ];
      useTags.mockReturnValue({ tags });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-tag-tag-1')).toBeTruthy();
      expect(screen.getByTestId('sidebar-tag-tag-2')).toBeTruthy();
      expect(screen.getByTestId('sidebar-tag-tag-3')).toBeTruthy();
    });

    it('renders tag names with # prefix', () => {
      useTags.mockReturnValue({ tags: [makeTag({ id: 'tag-a', name: 'coding' })] });
      render(React.createElement(SidebarFilter));
      expect(screen.getByText('#coding')).toBeTruthy();
    });

    it('renders the memo count for a tag', () => {
      useTags.mockReturnValue({ tags: [makeTag({ id: 'tag-cnt', name: 'test', memoCount: 7 })] });
      render(React.createElement(SidebarFilter));
      expect(screen.getByText('7')).toBeTruthy();
    });

    it('does not render count when memoCount is null', () => {
      useTags.mockReturnValue({ tags: [makeTag({ id: 'tag-null', name: 'nocount', memoCount: null })] });
      render(React.createElement(SidebarFilter));
      expect(screen.queryByTestId('sidebar-tag-count-tag-null')).toBeNull();
    });

    it('marks the correct tag item as active when tagId matches', () => {
      const tags = [
        makeTag({ id: 'tag-active', name: 'active-tag' }),
        makeTag({ id: 'tag-inactive', name: 'inactive-tag' }),
      ];
      useTags.mockReturnValue({ tags });
      useMemos.mockReturnValue({
        ...defaultUseMemos(),
        filter: { type: 'all', tagId: 'tag-active' },
      });
      render(React.createElement(SidebarFilter));
      expect(screen.getByTestId('sidebar-tag-tag-active').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('sidebar-tag-tag-inactive').getAttribute('aria-selected')).toBe('false');
    });

    it('calls applyFilter with { type: "all", tagId } when a tag is pressed', () => {
      const applyFilter = vi.fn();
      useMemos.mockReturnValue({ ...defaultUseMemos(), applyFilter });
      useTags.mockReturnValue({ tags: [makeTag({ id: 'tag-click', name: 'click-me' })] });
      render(React.createElement(SidebarFilter));
      fireEvent.click(screen.getByTestId('sidebar-tag-tag-click'));
      expect(applyFilter).toHaveBeenCalledWith({ type: 'all', tagId: 'tag-click' });
    });

    it('calls applyFilter exactly once when a tag item is pressed', () => {
      const applyFilter = vi.fn();
      useMemos.mockReturnValue({ ...defaultUseMemos(), applyFilter });
      useTags.mockReturnValue({ tags: [makeTag({ id: 'tag-once', name: 'once' })] });
      render(React.createElement(SidebarFilter));
      fireEvent.click(screen.getByTestId('sidebar-tag-tag-once'));
      expect(applyFilter).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('renders without crashing when tags is an empty array', () => {
      useTags.mockReturnValue({ tags: [] });
      expect(() => render(React.createElement(SidebarFilter))).not.toThrow();
    });

    it('renders without crashing when many tags are provided', () => {
      const tags = Array.from({ length: 30 }, (_, i) =>
        makeTag({ id: `tag-many-${i}`, name: `tag${i}`, memoCount: i })
      );
      useTags.mockReturnValue({ tags });
      expect(() => render(React.createElement(SidebarFilter))).not.toThrow();
      expect(screen.getByTestId('sidebar-tag-tag-many-0')).toBeTruthy();
      expect(screen.getByTestId('sidebar-tag-tag-many-29')).toBeTruthy();
    });

    it('renders without crashing when filter prop has an unknown type value', () => {
      useMemos.mockReturnValue({
        ...defaultUseMemos(),
        filter: { type: 'unknown-type', tagId: null },
      });
      expect(() => render(React.createElement(SidebarFilter))).not.toThrow();
    });
  });
});

// ─── TagList Tests ────────────────────────────────────────────────────────────

describe('TagList', () => {
  // ─── Rendering ─────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the FlatList with testID "tag-list" when tags are present', () => {
      const tags = [makeTag()];
      render(React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() }));
      expect(screen.getByTestId('tag-list')).toBeTruthy();
    });

    it('renders a tag item for each tag in the list', () => {
      const tags = [
        makeTag({ id: 'tl-1', name: 'work' }),
        makeTag({ id: 'tl-2', name: 'life' }),
      ];
      render(React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() }));
      expect(screen.getByTestId('tag-list-item-tl-1')).toBeTruthy();
      expect(screen.getByTestId('tag-list-item-tl-2')).toBeTruthy();
    });

    it('renders tag names with # prefix', () => {
      const tags = [makeTag({ id: 'tl-name', name: 'coding' })];
      render(React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() }));
      expect(screen.getByText('#coding')).toBeTruthy();
    });

    it('renders the memo count for each tag', () => {
      const tags = [makeTag({ id: 'tl-count', name: 'test', memoCount: 12 })];
      render(React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() }));
      expect(screen.getByText('12')).toBeTruthy();
    });

    it('renders 0 as memo count when memoCount is null/undefined', () => {
      const tags = [makeTag({ id: 'tl-zero', name: 'zero', memoCount: null })];
      render(React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() }));
      expect(screen.getByText('0')).toBeTruthy();
    });

    it('renders 0 as memo count when memoCount is undefined', () => {
      const tags = [{ id: 'tl-undef', name: 'undef' }];
      render(React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() }));
      expect(screen.getByText('0')).toBeTruthy();
    });

    it('uses default props when optional props are omitted', () => {
      expect(() =>
        render(React.createElement(TagList, {}))
      ).not.toThrow();
    });
  });

  // ─── Loading State ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders the loading indicator with testID "tag-list-loading" when isLoading=true and tags is empty', () => {
      render(React.createElement(TagList, { tags: [], isLoading: true }));
      expect(screen.getByTestId('tag-list-loading')).toBeTruthy();
    });

    it('does not render the tag list or empty state when loading', () => {
      render(React.createElement(TagList, { tags: [], isLoading: true }));
      expect(screen.queryByTestId('tag-list')).toBeNull();
      expect(screen.queryByTestId('tag-list-empty')).toBeNull();
    });

    it('does not show the loading indicator when isLoading=false', () => {
      render(React.createElement(TagList, { tags: [], isLoading: false }));
      expect(screen.queryByTestId('tag-list-loading')).toBeNull();
    });

    it('does not show the loading indicator when tags are present even if isLoading=true', () => {
      const tags = [makeTag()];
      render(React.createElement(TagList, { tags, isLoading: true }));
      expect(screen.queryByTestId('tag-list-loading')).toBeNull();
    });

    it('renders the tag list even when isLoading=true if tags array has items', () => {
      const tags = [makeTag({ id: 'tl-load-tag' })];
      render(React.createElement(TagList, { tags, isLoading: true }));
      expect(screen.getByTestId('tag-list')).toBeTruthy();
    });
  });

  // ─── Empty State ─────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders the empty container with testID "tag-list-empty" when no tags and not loading', () => {
      render(React.createElement(TagList, { tags: [], isLoading: false }));
      expect(screen.getByTestId('tag-list-empty')).toBeTruthy();
    });

    it('renders the empty text "暂无标签" when no tags and not loading', () => {
      render(React.createElement(TagList, { tags: [], isLoading: false }));
      expect(screen.getByText('暂无标签')).toBeTruthy();
    });

    it('does not render empty state when tags are present', () => {
      const tags = [makeTag()];
      render(React.createElement(TagList, { tags, isLoading: false }));
      expect(screen.queryByTestId('tag-list-empty')).toBeNull();
    });

    it('does not render empty state when loading (even with empty tags)', () => {
      render(React.createElement(TagList, { tags: [], isLoading: true }));
      expect(screen.queryByTestId('tag-list-empty')).toBeNull();
    });
  });

  // ─── Active State ────────────────────────────────────────────────────────────

  describe('active state', () => {
    it('marks a tag item as selected when its id matches activeTagId', () => {
      const tags = [
        makeTag({ id: 'tl-active', name: 'active' }),
        makeTag({ id: 'tl-inactive', name: 'inactive' }),
      ];
      render(
        React.createElement(TagList, { tags, activeTagId: 'tl-active', onTagPress: vi.fn() })
      );
      expect(screen.getByTestId('tag-list-item-tl-active').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('tag-list-item-tl-inactive').getAttribute('aria-selected')).toBe('false');
    });

    it('does not mark any tag as selected when activeTagId is null', () => {
      const tags = [
        makeTag({ id: 'tl-noact-1', name: 'first' }),
        makeTag({ id: 'tl-noact-2', name: 'second' }),
      ];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() })
      );
      expect(screen.getByTestId('tag-list-item-tl-noact-1').getAttribute('aria-selected')).toBe('false');
      expect(screen.getByTestId('tag-list-item-tl-noact-2').getAttribute('aria-selected')).toBe('false');
    });

    it('does not mark any tag as selected when activeTagId does not match any tag id', () => {
      const tags = [makeTag({ id: 'tl-miss', name: 'miss' })];
      render(
        React.createElement(TagList, { tags, activeTagId: 'non-existent-id', onTagPress: vi.fn() })
      );
      expect(screen.getByTestId('tag-list-item-tl-miss').getAttribute('aria-selected')).toBe('false');
    });
  });

  // ─── Interactions ─────────────────────────────────────────────────────────────

  describe('interactions', () => {
    it('calls onTagPress with the tag id when a tag item is pressed', () => {
      const onTagPress = vi.fn();
      const tags = [makeTag({ id: 'tl-press', name: 'press-me' })];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress })
      );
      fireEvent.click(screen.getByTestId('tag-list-item-tl-press'));
      expect(onTagPress).toHaveBeenCalledWith('tl-press');
    });

    it('calls onTagPress exactly once per click', () => {
      const onTagPress = vi.fn();
      const tags = [makeTag({ id: 'tl-once-click', name: 'once' })];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress })
      );
      fireEvent.click(screen.getByTestId('tag-list-item-tl-once-click'));
      expect(onTagPress).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onTagPress is not provided and a tag is pressed', () => {
      const tags = [makeTag({ id: 'tl-no-cb', name: 'no-callback' })];
      render(
        React.createElement(TagList, { tags, activeTagId: null })
      );
      expect(() =>
        fireEvent.click(screen.getByTestId('tag-list-item-tl-no-cb'))
      ).not.toThrow();
    });

    it('calls onTagPress with the correct id when multiple tags are rendered', () => {
      const onTagPress = vi.fn();
      const tags = [
        makeTag({ id: 'tl-multi-1', name: 'alpha' }),
        makeTag({ id: 'tl-multi-2', name: 'beta' }),
        makeTag({ id: 'tl-multi-3', name: 'gamma' }),
      ];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress })
      );
      fireEvent.click(screen.getByTestId('tag-list-item-tl-multi-2'));
      expect(onTagPress).toHaveBeenCalledWith('tl-multi-2');
      expect(onTagPress).not.toHaveBeenCalledWith('tl-multi-1');
      expect(onTagPress).not.toHaveBeenCalledWith('tl-multi-3');
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('sets accessibilityRole="button" on each tag item', () => {
      const tags = [makeTag({ id: 'tl-a11y', name: 'a11y' })];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() })
      );
      expect(screen.getByTestId('tag-list-item-tl-a11y').getAttribute('role')).toBe('button');
    });

    it('sets an accessibilityLabel containing the tag name and memo count', () => {
      const tags = [makeTag({ id: 'tl-label', name: 'projects', memoCount: 8 })];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() })
      );
      const item = screen.getByTestId('tag-list-item-tl-label');
      expect(item.getAttribute('aria-label')).toContain('projects');
      expect(item.getAttribute('aria-label')).toContain('8');
    });

    it('sets accessibilityLabel with 0 count when memoCount is null', () => {
      const tags = [makeTag({ id: 'tl-nulllabel', name: 'nocount', memoCount: null })];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() })
      );
      const item = screen.getByTestId('tag-list-item-tl-nulllabel');
      expect(item.getAttribute('aria-label')).toContain('0');
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('renders without crashing when tags prop is empty array and no other props', () => {
      expect(() =>
        render(React.createElement(TagList, { tags: [] }))
      ).not.toThrow();
    });

    it('renders many tags without error', () => {
      const tags = Array.from({ length: 50 }, (_, i) =>
        makeTag({ id: `tl-bulk-${i}`, name: `tag${i}`, memoCount: i })
      );
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() })
      );
      expect(screen.getByTestId('tag-list-item-tl-bulk-0')).toBeTruthy();
      expect(screen.getByTestId('tag-list-item-tl-bulk-49')).toBeTruthy();
    });

    it('renders a single tag without error', () => {
      const tags = [makeTag({ id: 'tl-single', name: 'solo', memoCount: 1 })];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() })
      );
      expect(screen.getByTestId('tag-list-item-tl-single')).toBeTruthy();
    });

    it('handles memoCount of 0 correctly', () => {
      const tags = [makeTag({ id: 'tl-zero-count', name: 'empty', memoCount: 0 })];
      render(
        React.createElement(TagList, { tags, activeTagId: null, onTagPress: vi.fn() })
      );
      expect(screen.getByText('0')).toBeTruthy();
    });
  });
});
