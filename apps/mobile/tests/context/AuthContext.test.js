import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext.jsx';
import React from 'react';

// Mock the api-client
vi.mock('../../lib/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
  },
}));

const { apiClient } = await import('../../lib/api-client.js');

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  nickname: '测试用户',
  createdAt: 1741824000000,
};

function Wrapper({ children }) {
  return React.createElement(AuthProvider, null, children);
}

describe('AuthProvider initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('starts with loading=true', () => {
    apiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  test('sets isAuthenticated=true after successful GET /api/auth/me', async () => {
    apiClient.get.mockResolvedValueOnce({ data: mockUser, message: '获取用户信息成功' });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  test('sets isAuthenticated=false after failed GET /api/auth/me', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Not authenticated'));

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  test('sets loading=false after 401 response from /me', async () => {
    apiClient.get.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('AuthProvider login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockRejectedValueOnce(new Error('Not authenticated'));
  });

  test('login() calls POST /api/auth/login and updates state', async () => {
    apiClient.post.mockResolvedValueOnce({ data: mockUser, message: '登录成功' });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@example.com', 'password123');
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(loginResult).toEqual(mockUser);
  });

  test('login() throws when API returns error', async () => {
    apiClient.post.mockRejectedValueOnce(Object.assign(new Error('邮箱或密码错误，请重试'), { error: '邮箱或密码错误，请重试' }));

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login('test@example.com', 'wrongpassword');
      })
    ).rejects.toThrow();

    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('AuthProvider register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockRejectedValueOnce(new Error('Not authenticated'));
  });

  test('register() calls POST /api/auth/register and updates state', async () => {
    apiClient.post.mockResolvedValueOnce({ data: mockUser, message: '注册成功' });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let registerResult;
    await act(async () => {
      registerResult = await result.current.register('test@example.com', '测试用户', 'password123', true);
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'test@example.com',
      nickname: '测试用户',
      password: 'password123',
      agreedToPrivacy: true,
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(registerResult).toEqual(mockUser);
  });

  test('register() throws when email already registered', async () => {
    apiClient.post.mockRejectedValueOnce(
      Object.assign(new Error('该邮箱已被注册'), { error: '该邮箱已被注册' })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.register('existing@example.com', '用户', 'password123', true);
      })
    ).rejects.toThrow();

    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('AuthProvider logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('logout() calls POST /api/auth/logout and clears state', async () => {
    // Start authenticated
    apiClient.get.mockResolvedValueOnce({ data: mockUser, message: '获取用户信息成功' });
    apiClient.post.mockResolvedValueOnce({ data: null, message: '已成功登出' });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/logout');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});

describe('useAuth hook', () => {
  test('throws when used outside AuthProvider', () => {
    // Suppress React error output for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');

    consoleSpy.mockRestore();
  });

  test('returns all expected context values', async () => {
    apiClient.get.mockResolvedValueOnce({ data: mockUser, message: '获取用户信息成功' });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('register');
    expect(result.current).toHaveProperty('logout');
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.logout).toBe('function');
  });
});
