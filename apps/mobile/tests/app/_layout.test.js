/**
 * _layout.jsx 单元测试（Vitest）
 *
 * 覆盖范围：
 *   - loading=true 时渲染加载占位（防闪屏）
 *   - loading=false, isAuthenticated=false 时 router.replace('/login')
 *   - loading=false, isAuthenticated=true, 访问 /login 时 router.replace('/')
 *   - loading=false, isAuthenticated=true 时渲染子路由内容
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock: react-native
// ---------------------------------------------------------------------------

vi.mock('react-native', async () => {
  const actual = await vi.importActual('react-native');
  return {
    ...actual,
    StyleSheet: { create: (s) => s },
  };
});

// ---------------------------------------------------------------------------
// Mock: expo-router
// ---------------------------------------------------------------------------

const mockRouterReplace = vi.fn();
const mockSegments = [''];

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
  useSegments: () => mockSegments,
  Slot: ({ children }) => React.createElement('div', { 'data-testid': 'slot' }, children),
  Stack: ({ children }) => React.createElement('div', { 'data-testid': 'stack' }, children),
}));

// ---------------------------------------------------------------------------
// Mock: AuthContext (will be replaced per test)
// ---------------------------------------------------------------------------

let mockAuthState = {
  loading: true,
  isAuthenticated: false,
  user: null,
};

vi.mock('../../context/AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => React.createElement('div', { 'data-testid': 'auth-provider' }, children),
  useAuth: () => mockAuthState,
}));

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import RootLayout from '../../app/_layout.jsx';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState = { loading: true, isAuthenticated: false, user: null };
  mockSegments.length = 0;
  mockSegments.push('');
});

describe('RootLayout — loading=true（防闪屏）', () => {
  it('loading=true 时渲染加载占位，不渲染子路由', () => {
    mockAuthState = { loading: true, isAuthenticated: false, user: null };
    render(<RootLayout />);
    // Should show loading indicator, not the actual slot content
    expect(screen.getByTestId('layout-loading')).toBeTruthy();
  });

  it('loading=true 时不触发路由跳转', () => {
    mockAuthState = { loading: true, isAuthenticated: false, user: null };
    render(<RootLayout />);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

describe('RootLayout — 未登录状态', () => {
  it('loading=false, isAuthenticated=false 时 router.replace("/login")', async () => {
    mockAuthState = { loading: false, isAuthenticated: false, user: null };
    render(<RootLayout />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });
});

describe('RootLayout — 已登录访问 /login 或 /register', () => {
  it('isAuthenticated=true 且 segment 为 "login" 时 router.replace("/")', async () => {
    mockAuthState = { loading: false, isAuthenticated: true, user: { id: 'u1', email: 'u@e.com', nickname: 'u' } };
    mockSegments.length = 0;
    mockSegments.push('login');
    render(<RootLayout />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('isAuthenticated=true 且 segment 为 "register" 时 router.replace("/")', async () => {
    mockAuthState = { loading: false, isAuthenticated: true, user: { id: 'u1', email: 'u@e.com', nickname: 'u' } };
    mockSegments.length = 0;
    mockSegments.push('register');
    render(<RootLayout />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });
});

describe('RootLayout — 已登录正常访问', () => {
  it('isAuthenticated=true 且访问非 auth 路由时不触发跳转', async () => {
    mockAuthState = { loading: false, isAuthenticated: true, user: { id: 'u1', email: 'u@e.com', nickname: 'u' } };
    mockSegments.length = 0;
    mockSegments.push('(tabs)');
    render(<RootLayout />);
    await waitFor(() => {
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });
});
