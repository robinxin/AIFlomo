import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style, testID, accessibilityLabel }) =>
    React.createElement('div', { style, 'data-testid': testID, 'aria-label': accessibilityLabel }, children),
  Text: ({ children, style, testID, numberOfLines }) =>
    React.createElement('span', { style, 'data-testid': testID, 'data-lines': numberOfLines }, children),
  ScrollView: ({ children, horizontal, style, contentContainerStyle, testID, showsHorizontalScrollIndicator }) =>
    React.createElement(
      'div',
      { style, 'data-horizontal': horizontal, 'data-testid': testID },
      children
    ),
  StyleSheet: { create: (s) => s },
}));

// ─── Mock Contexts ────────────────────────────────────────────────────────────

vi.mock('@/context/MemoContext', () => ({
  useMemoContext: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuthContext: vi.fn(),
}));

import { Heatmap } from '../components/Heatmap';
import { StatsBar } from '../components/StatsBar';
import { useMemoContext } from '@/context/MemoContext';
import { useAuthContext } from '@/context/AuthContext';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeHeatmapData(entries = []) {
  return entries;
}

function makeMemoState({ heatmapData = [], stats = null } = {}) {
  return { state: { heatmapData, stats } };
}

function makeAuthState({ user = null } = {}) {
  return { state: { user } };
}

function makeUser({ nickname = '', email = '' } = {}) {
  return { nickname, email };
}

// ─── Heatmap Tests ────────────────────────────────────────────────────────────

describe('Heatmap', () => {
  describe('渲染测试', () => {
    it('空数据时正确渲染', () => {
      useMemoContext.mockReturnValue(makeMemoState({ heatmapData: [] }));

      render(<Heatmap />);

      expect(screen.getByTestId('heatmap')).toBeDefined();
      expect(screen.getByTestId('heatmap-scroll')).toBeDefined();
      expect(screen.getByTestId('heatmap-grid')).toBeDefined();
    });

    it('有数据时正确渲染网格', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const formatDay = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const todayStr = formatDay(today);
      const yesterdayStr = formatDay(yesterday);

      const heatmapData = makeHeatmapData([
        { day: todayStr, count: 3 },
        { day: yesterdayStr, count: 7 },
      ]);

      useMemoContext.mockReturnValue(makeMemoState({ heatmapData }));

      render(<Heatmap />);

      expect(screen.getByTestId(`heatmap-cell-${todayStr}`)).toBeDefined();
      expect(screen.getByTestId(`heatmap-cell-${yesterdayStr}`)).toBeDefined();
    });

    it('正确显示标题和总计数', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const formatDay = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const heatmapData = makeHeatmapData([
        { day: formatDay(today), count: 4 },
      ]);

      useMemoContext.mockReturnValue(makeMemoState({ heatmapData }));

      render(<Heatmap />);

      const totalCountEl = screen.getByTestId('heatmap-total-count');
      expect(totalCountEl.textContent).toContain('4');
    });

    it('正确显示图例', () => {
      useMemoContext.mockReturnValue(makeMemoState({ heatmapData: [] }));

      render(<Heatmap />);

      expect(screen.getByTestId('heatmap-legend')).toBeDefined();
    });

    it('总计数为 0 时正确显示', () => {
      useMemoContext.mockReturnValue(makeMemoState({ heatmapData: [] }));

      render(<Heatmap />);

      const totalCountEl = screen.getByTestId('heatmap-total-count');
      expect(totalCountEl.textContent).toContain('0');
    });
  });

  describe('数据处理测试', () => {
    it('buildGrid 函数生成正确的 90 天网格', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const formatDay = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const oldDay = new Date(today);
      oldDay.setDate(oldDay.getDate() - 89);

      const heatmapData = makeHeatmapData([
        { day: formatDay(oldDay), count: 1 },
        { day: formatDay(today), count: 5 },
      ]);

      useMemoContext.mockReturnValue(makeMemoState({ heatmapData }));

      render(<Heatmap />);

      expect(screen.getByTestId(`heatmap-cell-${formatDay(oldDay)}`)).toBeDefined();
      expect(screen.getByTestId(`heatmap-cell-${formatDay(today)}`)).toBeDefined();
    });

    it('正确计算 totalCount', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 1);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 2);

      const formatDay = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const heatmapData = makeHeatmapData([
        { day: formatDay(today), count: 3 },
        { day: formatDay(d1), count: 2 },
        { day: formatDay(d2), count: 5 },
      ]);

      useMemoContext.mockReturnValue(makeMemoState({ heatmapData }));

      render(<Heatmap />);

      const totalCountEl = screen.getByTestId('heatmap-total-count');
      expect(totalCountEl.textContent).toContain('10');
    });

    it('heatmapData 为 undefined 时不崩溃', () => {
      useMemoContext.mockReturnValue({ state: {} });

      expect(() => render(<Heatmap />)).not.toThrow();
      expect(screen.getByTestId('heatmap-total-count').textContent).toContain('0');
    });
  });

  describe('颜色逻辑测试', () => {
    it('count=0 的格子使用默认颜色', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const formatDay = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      useMemoContext.mockReturnValue(makeMemoState({ heatmapData: [] }));

      render(<Heatmap />);

      const todayCell = screen.getByTestId(`heatmap-cell-${formatDay(today)}`);
      expect(todayCell).toBeDefined();
    });

    it('count>9 的格子使用最深颜色', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const formatDay = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const todayStr = formatDay(today);
      useMemoContext.mockReturnValue(
        makeMemoState({ heatmapData: [{ day: todayStr, count: 15 }] })
      );

      render(<Heatmap />);

      const cell = screen.getByTestId(`heatmap-cell-${todayStr}`);
      expect(cell).toBeDefined();
    });
  });

  describe('交互测试', () => {
    it('ScrollView 可滚动（horizontal 属性正确传递）', () => {
      useMemoContext.mockReturnValue(makeMemoState({ heatmapData: [] }));

      render(<Heatmap />);

      const scrollView = screen.getByTestId('heatmap-scroll');
      expect(scrollView.getAttribute('data-horizontal')).toBe('true');
    });

    it('Cell 具有正确的 accessibilityLabel', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const formatDay = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const todayStr = formatDay(today);
      useMemoContext.mockReturnValue(
        makeMemoState({ heatmapData: [{ day: todayStr, count: 5 }] })
      );

      render(<Heatmap />);

      const cell = screen.getByTestId(`heatmap-cell-${todayStr}`);
      expect(cell.getAttribute('aria-label')).toBe(`${todayStr}: 5 条笔记`);
    });
  });
});

// ─── StatsBar Tests ───────────────────────────────────────────────────────────

describe('StatsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('正确显示昵称（nickname）', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '测试用户', email: 'test@example.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: { totalCount: 10, daysUsed: 5 } }));

      render(<StatsBar />);

      expect(screen.getByTestId('stats-nickname').textContent).toBe('测试用户');
    });

    it('昵称为空时使用 email', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '', email: 'user@example.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: { totalCount: 0, daysUsed: 0 } }));

      render(<StatsBar />);

      expect(screen.getByTestId('stats-nickname').textContent).toBe('user@example.com');
    });

    it('正确显示总笔记数（totalCount）', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '用户', email: 'a@b.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: { totalCount: 42, daysUsed: 7 } }));

      render(<StatsBar />);

      expect(screen.getByTestId('stats-total-count').textContent).toBe('42');
    });

    it('正确显示使用天数（daysUsed）', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '用户', email: 'a@b.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: { totalCount: 10, daysUsed: 30 } }));

      render(<StatsBar />);

      expect(screen.getByTestId('stats-days-used').textContent).toBe('30');
    });

    it('渲染 stats-bar 容器', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '用户', email: 'a@b.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState());

      render(<StatsBar />);

      expect(screen.getByTestId('stats-bar')).toBeDefined();
    });
  });

  describe('边界情况测试', () => {
    it('数据缺失时显示默认值 0（totalCount）', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '用户', email: 'a@b.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: null }));

      render(<StatsBar />);

      expect(screen.getByTestId('stats-total-count').textContent).toBe('0');
    });

    it('数据缺失时显示默认值 0（daysUsed）', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '用户', email: 'a@b.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: null }));

      render(<StatsBar />);

      expect(screen.getByTestId('stats-days-used').textContent).toBe('0');
    });

    it('authState.user 为 null 时昵称显示空字符串', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: null }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: { totalCount: 5, daysUsed: 3 } }));

      render(<StatsBar />);

      expect(screen.getByTestId('stats-nickname').textContent).toBe('');
    });

    it('memoState.stats 为 null 时不崩溃', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: 'U', email: 'u@u.com' }) }));
      useMemoContext.mockReturnValue(makeMemoState({ stats: null }));

      expect(() => render(<StatsBar />)).not.toThrow();
    });

    it('nickname 和 email 都为空时显示空字符串', () => {
      useAuthContext.mockReturnValue(makeAuthState({ user: makeUser({ nickname: '', email: '' }) }));
      useMemoContext.mockReturnValue(makeMemoState());

      render(<StatsBar />);

      expect(screen.getByTestId('stats-nickname').textContent).toBe('');
    });

    it('user 有 nickname 时优先显示 nickname 而非 email', () => {
      useAuthContext.mockReturnValue(
        makeAuthState({ user: makeUser({ nickname: '昵称优先', email: 'should-not-show@example.com' }) })
      );
      useMemoContext.mockReturnValue(makeMemoState({ stats: { totalCount: 1, daysUsed: 1 } }));

      render(<StatsBar />);

      const nicknameEl = screen.getByTestId('stats-nickname');
      expect(nicknameEl.textContent).toBe('昵称优先');
      expect(nicknameEl.textContent).not.toContain('should-not-show');
    });
  });
});
