/**
 * TDD Test: apps/mobile/app/_layout.jsx
 * Task T016 - 在根布局文件中挂载 AuthProvider，实现路由守卫
 *
 * Tests cover:
 * 1. 渲染测试：根布局应渲染 AuthProvider 并包裹子路由（Slot）
 * 2. 路由守卫测试 — loading 状态：loading=true 时渲染占位，不渲染 Slot，不调用 router.replace()
 * 3. 路由守卫测试 — 未登录状态：loading=false && !isAuthenticated 时跳转 /login
 * 4. 路由守卫测试 — 已登录访问认证页面：已登录访问 /login 或 /register 时跳转 /
 * 5. 已登录正常访问：渲染 Slot，不调用 router.replace()
 *
 * Mock 策略:
 * - vi.mock('expo-router') — mock useRouter、Slot、usePathname
 * - vi.mock('../../context/AuthContext.jsx') — mock AuthProvider、useAuth
 * - vi.mock('react-native') — mock View、Text、ActivityIndicator
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// ── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => {
  const ReactLib = require('react');

  const View = ({ children, testID, style }) =>
    ReactLib.createElement('div', { 'data-testid': testID, style }, children);

  const Text = ({ children, testID, style }) =>
    ReactLib.createElement('span', { 'data-testid': testID, style }, children);

  const ActivityIndicator = ({ testID, size, color }) =>
    ReactLib.createElement('div', {
      'data-testid': testID || 'activity-indicator',
      'data-size': size,
      'data-color': color,
      role: 'progressbar',
    });

  return {
    View,
    Text,
    ActivityIndicator,
    StyleSheet: { create: (s) => s },
    Platform: { OS: 'web', select: (obj) => obj.web ?? obj.default },
  };
});

// ── Mock expo-router ──────────────────────────────────────────────────────────

const mockReplace = vi.fn();
let mockPathname = '/';

vi.mock('expo-router', () => {
  const ReactLib = require('react');
  return {
    useRouter: vi.fn(() => ({ replace: mockReplace })),
    usePathname: vi.fn(() => mockPathname),
    Slot: ({ testID }) =>
      ReactLib.createElement('div', { 'data-testid': testID || 'slot-component' }, 'slot-content'),
  };
});

// ── Mock AuthContext ──────────────────────────────────────────────────────────

let mockAuthState = {
  isAuthenticated: false,
  loading: true,
};

vi.mock('../../context/AuthContext.jsx', () => {
  const ReactLib = require('react');
  return {
    AuthProvider: ({ children, baseURL }) =>
      ReactLib.createElement(
        'div',
        { 'data-testid': 'auth-provider', 'data-base-url': baseURL },
        children
      ),
    useAuth: vi.fn(() => mockAuthState),
  };
});

// ── Import component under test ───────────────────────────────────────────────
// Placed after all mocks so vi.mock hoisting picks them up correctly.

import RootLayout from '../../app/_layout.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderLayout() {
  return render(React.createElement(RootLayout));
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = '/';
  mockAuthState = { isAuthenticated: false, loading: true };
});

afterEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// 1. 渲染测试
// =============================================================================

describe('RootLayout — 渲染测试', () => {
  it('应渲染 AuthProvider', () => {
    const { getByTestId } = renderLayout();
    expect(getByTestId('auth-provider')).toBeTruthy();
  });

  it('loading=true 时应渲染加载占位', () => {
    mockAuthState = { isAuthenticated: false, loading: true };
    const { getByRole } = renderLayout();
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('loading=false 且已登录时应渲染子路由（Slot）', () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/';
    const { getByTestId } = renderLayout();
    expect(getByTestId('slot-component')).toBeTruthy();
  });
});

// =============================================================================
// 2. 路由守卫测试 — loading 状态
// =============================================================================

describe('RootLayout — loading 状态', () => {
  it('loading=true 时应渲染加载占位（ActivityIndicator）', () => {
    mockAuthState = { isAuthenticated: false, loading: true };
    const { getByRole } = renderLayout();
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('loading=true 时不应渲染子路由（Slot）', () => {
    mockAuthState = { isAuthenticated: false, loading: true };
    const { queryByTestId } = renderLayout();
    expect(queryByTestId('slot-component')).toBeNull();
  });

  it('loading=true 时不应调用 router.replace()', () => {
    mockAuthState = { isAuthenticated: false, loading: true };
    renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('loading=true 且已认证时也不应调用 router.replace()', () => {
    mockAuthState = { isAuthenticated: true, loading: true };
    mockPathname = '/login';
    renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 3. 路由守卫测试 — 未登录状态
// =============================================================================

describe('RootLayout — 未登录状态路由守卫', () => {
  it('loading=false && !isAuthenticated 且路径为 / 时应调用 router.replace("/login")', async () => {
    mockAuthState = { isAuthenticated: false, loading: false };
    mockPathname = '/';
    await act(async () => {
      renderLayout();
    });
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('loading=false && !isAuthenticated 且路径为 /other 时应调用 router.replace("/login")', async () => {
    mockAuthState = { isAuthenticated: false, loading: false };
    mockPathname = '/other';
    await act(async () => {
      renderLayout();
    });
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('已在 /login 路径且未登录时不应重复跳转', () => {
    mockAuthState = { isAuthenticated: false, loading: false };
    mockPathname = '/login';
    renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('已在 /register 路径且未登录时不应跳转到 /login', () => {
    mockAuthState = { isAuthenticated: false, loading: false };
    mockPathname = '/register';
    renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 4. 路由守卫测试 — 已登录访问认证页面
// =============================================================================

describe('RootLayout — 已登录访问认证页面', () => {
  it('已登录用户访问 /login 时应调用 router.replace("/")', async () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/login';
    await act(async () => {
      renderLayout();
    });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('已登录用户访问 /register 时应调用 router.replace("/")', async () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/register';
    await act(async () => {
      renderLayout();
    });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('已登录用户访问 / 时不应跳转', () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/';
    renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('已登录用户访问 /other 时不应跳转', () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/other';
    renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 5. 已登录正常访问
// =============================================================================

describe('RootLayout — 已登录正常访问', () => {
  it('loading=false && isAuthenticated 且路径为 / 时应渲染子路由（Slot）', () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/';
    const { getByTestId } = renderLayout();
    expect(getByTestId('slot-component')).toBeTruthy();
  });

  it('loading=false && isAuthenticated 时不应调用 router.replace()', () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/';
    renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('loading=false && isAuthenticated 且路径为 /other 时应渲染子路由（Slot）', () => {
    mockAuthState = { isAuthenticated: true, loading: false };
    mockPathname = '/other';
    const { getByTestId } = renderLayout();
    expect(getByTestId('slot-component')).toBeTruthy();
  });
});
