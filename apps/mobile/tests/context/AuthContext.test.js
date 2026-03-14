/**
 * TDD Test: apps/mobile/context/AuthContext.jsx
 * Task T009 - 实现 AuthContext
 *
 * Tests cover:
 * - authReducer: AUTH_INIT_SUCCESS, AUTH_INIT_FAILURE, AUTH_LOGIN_SUCCESS, AUTH_LOGOUT
 * - AuthProvider: 挂载时调用 GET /api/auth/me 初始化登录状态
 * - AuthProvider: loading=true 防闪屏（初始化完成前保持 loading）
 * - login: 调用 POST /api/auth/login，成功 dispatch AUTH_LOGIN_SUCCESS，失败抛出 Error
 * - register: 调用 POST /api/auth/register，成功 dispatch AUTH_LOGIN_SUCCESS，失败抛出 Error
 * - logout: 调用 POST /api/auth/logout，成功 dispatch AUTH_LOGOUT，失败抛出 Error
 * - useAuth: 在 Provider 外调用时抛出错误
 *
 * Mock 策略:
 * - vi.mock('../../lib/api-client.js') — mock API Client 工厂函数
 * - @testing-library/react renderHook + act — 测试 Hook 与异步状态变更
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth, authReducer } from '../../context/AuthContext.jsx';

// ── Mock api-client ────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDel = vi.fn();

vi.mock('../../lib/api-client.js', () => ({
  createApiClient: vi.fn(() => ({
    get: mockGet,
    post: mockPost,
    del: mockDel,
  })),
}));

// ── Constants ──────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-001', email: 'test@example.com', nickname: '测试用户' };

const BASE_URL = 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wrapper component to provide AuthProvider in renderHook calls.
 */
function createWrapper() {
  return function Wrapper({ children }) {
    return React.createElement(AuthProvider, { baseURL: BASE_URL }, children);
  };
}

// ── Tests: authReducer ────────────────────────────────────────────────────────

describe('authReducer', () => {
  const initialState = {
    user: null,
    isAuthenticated: false,
    loading: true,
  };

  describe('AUTH_INIT_SUCCESS', () => {
    it('should set user, isAuthenticated=true, loading=false', () => {
      const action = { type: 'AUTH_INIT_SUCCESS', payload: { user: MOCK_USER } };
      const nextState = authReducer(initialState, action);

      expect(nextState.user).toEqual(MOCK_USER);
      expect(nextState.isAuthenticated).toBe(true);
      expect(nextState.loading).toBe(false);
    });

    it('should not mutate the original state', () => {
      const action = { type: 'AUTH_INIT_SUCCESS', payload: { user: MOCK_USER } };
      const originalState = { ...initialState };
      authReducer(initialState, action);

      expect(initialState).toEqual(originalState);
    });

    it('should replace an existing user with the new user from payload', () => {
      const existingState = {
        user: { id: 'old-user', email: 'old@example.com', nickname: '旧用户' },
        isAuthenticated: true,
        loading: false,
      };
      const newUser = { id: 'new-user', email: 'new@example.com', nickname: '新用户' };
      const action = { type: 'AUTH_INIT_SUCCESS', payload: { user: newUser } };
      const nextState = authReducer(existingState, action);

      expect(nextState.user).toEqual(newUser);
    });
  });

  describe('AUTH_INIT_FAILURE', () => {
    it('should set user=null, isAuthenticated=false, loading=false', () => {
      const stateWithUser = {
        user: MOCK_USER,
        isAuthenticated: true,
        loading: true,
      };
      const action = { type: 'AUTH_INIT_FAILURE' };
      const nextState = authReducer(stateWithUser, action);

      expect(nextState.user).toBeNull();
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.loading).toBe(false);
    });

    it('should not mutate the original state', () => {
      const stateWithUser = {
        user: MOCK_USER,
        isAuthenticated: true,
        loading: true,
      };
      const originalRef = stateWithUser.user;
      const action = { type: 'AUTH_INIT_FAILURE' };
      authReducer(stateWithUser, action);

      expect(stateWithUser.user).toBe(originalRef);
    });

    it('should work when called from loading=true (initial state)', () => {
      const action = { type: 'AUTH_INIT_FAILURE' };
      const nextState = authReducer(initialState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.user).toBeNull();
    });
  });

  describe('AUTH_LOGIN_SUCCESS', () => {
    it('should set user, isAuthenticated=true, loading=false', () => {
      const action = { type: 'AUTH_LOGIN_SUCCESS', payload: { user: MOCK_USER } };
      const nextState = authReducer(initialState, action);

      expect(nextState.user).toEqual(MOCK_USER);
      expect(nextState.isAuthenticated).toBe(true);
      expect(nextState.loading).toBe(false);
    });

    it('should not mutate the original state', () => {
      const action = { type: 'AUTH_LOGIN_SUCCESS', payload: { user: MOCK_USER } };
      const originalState = { ...initialState };
      authReducer(initialState, action);

      expect(initialState).toEqual(originalState);
    });

    it('should replace an existing user with the newly logged-in user', () => {
      const existingState = {
        user: { id: 'old-user', email: 'old@example.com', nickname: '旧用户' },
        isAuthenticated: false,
        loading: false,
      };
      const action = { type: 'AUTH_LOGIN_SUCCESS', payload: { user: MOCK_USER } };
      const nextState = authReducer(existingState, action);

      expect(nextState.user).toEqual(MOCK_USER);
    });
  });

  describe('AUTH_LOGOUT', () => {
    it('should set user=null, isAuthenticated=false, loading=false', () => {
      const loggedInState = {
        user: MOCK_USER,
        isAuthenticated: true,
        loading: false,
      };
      const action = { type: 'AUTH_LOGOUT' };
      const nextState = authReducer(loggedInState, action);

      expect(nextState.user).toBeNull();
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.loading).toBe(false);
    });

    it('should not mutate the original state', () => {
      const loggedInState = {
        user: MOCK_USER,
        isAuthenticated: true,
        loading: false,
      };
      const originalRef = loggedInState.user;
      const action = { type: 'AUTH_LOGOUT' };
      authReducer(loggedInState, action);

      expect(loggedInState.user).toBe(originalRef);
    });

    it('should be idempotent when called on already-logged-out state', () => {
      const loggedOutState = {
        user: null,
        isAuthenticated: false,
        loading: false,
      };
      const action = { type: 'AUTH_LOGOUT' };
      const nextState = authReducer(loggedOutState, action);

      expect(nextState.user).toBeNull();
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.loading).toBe(false);
    });
  });

  describe('unknown action type', () => {
    it('should return the current state unchanged for unknown action types', () => {
      const action = { type: 'UNKNOWN_ACTION' };
      const nextState = authReducer(initialState, action);

      expect(nextState).toEqual(initialState);
    });
  });
});

// ── Tests: AuthProvider initialization ───────────────────────────────────────

describe('AuthProvider — initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should start with loading=true before GET /api/auth/me resolves', async () => {
    // Never resolves during this test
    mockGet.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
  });

  it('should start with isAuthenticated=false before initialization completes', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should start with user=null before initialization completes', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
  });

  it('should call GET /api/auth/me on mount', async () => {
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });

    const wrapper = createWrapper();
    await act(async () => {
      renderHook(() => useAuth(), { wrapper });
    });

    expect(mockGet).toHaveBeenCalledWith('/api/auth/me');
  });

  it('should call GET /api/auth/me exactly once on mount', async () => {
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });

    const wrapper = createWrapper();
    await act(async () => {
      renderHook(() => useAuth(), { wrapper });
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('should set user and isAuthenticated=true after successful GET /api/auth/me', async () => {
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    expect(hookResult.current.user).toEqual(MOCK_USER);
    expect(hookResult.current.isAuthenticated).toBe(true);
    expect(hookResult.current.loading).toBe(false);
  });

  it('should set loading=false and isAuthenticated=false after GET /api/auth/me fails (401)', async () => {
    mockGet.mockRejectedValue(new Error('未授权，请重新登录'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    expect(hookResult.current.loading).toBe(false);
    expect(hookResult.current.isAuthenticated).toBe(false);
    expect(hookResult.current.user).toBeNull();
  });

  it('should set loading=false after GET /api/auth/me fails with a network error', async () => {
    mockGet.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    expect(hookResult.current.loading).toBe(false);
  });
});

// ── Tests: login ──────────────────────────────────────────────────────────────

describe('AuthProvider — login()', () => {
  beforeEach(() => {
    // Default: initialization succeeds (user is already logged in doesn't matter)
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: null, message: 'ok' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/auth/login with email and password', async () => {
    mockGet.mockResolvedValue({ data: null });
    mockPost.mockResolvedValue({ data: MOCK_USER, message: '登录成功' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.login('test@example.com', 'password123');
    });

    expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should return the user object on successful login', async () => {
    mockGet.mockResolvedValue({ data: null });
    mockPost.mockResolvedValue({ data: MOCK_USER, message: '登录成功' });

    const wrapper = createWrapper();
    let hookResult;
    let loginResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      loginResult = await hookResult.current.login('test@example.com', 'password123');
    });

    expect(loginResult).toEqual(MOCK_USER);
  });

  it('should set isAuthenticated=true and user after successful login', async () => {
    mockGet.mockResolvedValue({ data: null });
    mockPost.mockResolvedValue({ data: MOCK_USER, message: '登录成功' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.login('test@example.com', 'password123');
    });

    expect(hookResult.current.isAuthenticated).toBe(true);
    expect(hookResult.current.user).toEqual(MOCK_USER);
  });

  it('should throw an Error when login fails (e.g., wrong credentials)', async () => {
    mockGet.mockResolvedValue({ data: null });
    mockPost.mockRejectedValue(new Error('邮箱或密码错误，请重试'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await expect(
      act(async () => {
        await hookResult.current.login('test@example.com', 'wrongpassword');
      })
    ).rejects.toThrow('邮箱或密码错误，请重试');
  });

  it('should throw an Error when login fails with a network error', async () => {
    mockGet.mockResolvedValue({ data: null });
    mockPost.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await expect(
      act(async () => {
        await hookResult.current.login('test@example.com', 'password123');
      })
    ).rejects.toThrow('网络连接失败，请稍后重试');
  });

  it('should not change isAuthenticated state when login fails', async () => {
    mockGet.mockResolvedValue({ data: null });
    mockPost.mockRejectedValue(new Error('邮箱或密码错误，请重试'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    try {
      await act(async () => {
        await hookResult.current.login('test@example.com', 'wrongpassword');
      });
    } catch {
      // expected
    }

    expect(hookResult.current.isAuthenticated).toBe(false);
  });
});

// ── Tests: register ───────────────────────────────────────────────────────────

describe('AuthProvider — register()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/auth/register with email, nickname, password, agreedAt', async () => {
    mockPost.mockResolvedValue({ data: MOCK_USER, message: '注册成功' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    const agreedAt = Date.now();
    await act(async () => {
      await hookResult.current.register('test@example.com', '测试用户', 'password123', agreedAt);
    });

    expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
      email: 'test@example.com',
      nickname: '测试用户',
      password: 'password123',
      agreedAt,
    });
  });

  it('should return the user object on successful registration', async () => {
    mockPost.mockResolvedValue({ data: MOCK_USER, message: '注册成功' });

    const wrapper = createWrapper();
    let hookResult;
    let registerResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      registerResult = await hookResult.current.register(
        'test@example.com',
        '测试用户',
        'password123',
        Date.now()
      );
    });

    expect(registerResult).toEqual(MOCK_USER);
  });

  it('should set isAuthenticated=true and user after successful registration', async () => {
    mockPost.mockResolvedValue({ data: MOCK_USER, message: '注册成功' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.register(
        'test@example.com',
        '测试用户',
        'password123',
        Date.now()
      );
    });

    expect(hookResult.current.isAuthenticated).toBe(true);
    expect(hookResult.current.user).toEqual(MOCK_USER);
  });

  it('should throw an Error when registration fails (e.g., email already exists)', async () => {
    mockPost.mockRejectedValue(new Error('该邮箱已被注册'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await expect(
      act(async () => {
        await hookResult.current.register(
          'existing@example.com',
          '测试用户',
          'password123',
          Date.now()
        );
      })
    ).rejects.toThrow('该邮箱已被注册');
  });

  it('should throw an Error when registration fails with a network error', async () => {
    mockPost.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await expect(
      act(async () => {
        await hookResult.current.register(
          'test@example.com',
          '测试用户',
          'password123',
          Date.now()
        );
      })
    ).rejects.toThrow('网络连接失败，请稍后重试');
  });

  it('should not change isAuthenticated state when registration fails', async () => {
    mockPost.mockRejectedValue(new Error('该邮箱已被注册'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    try {
      await act(async () => {
        await hookResult.current.register(
          'existing@example.com',
          '测试用户',
          'password123',
          Date.now()
        );
      });
    } catch {
      // expected
    }

    expect(hookResult.current.isAuthenticated).toBe(false);
  });
});

// ── Tests: logout ─────────────────────────────────────────────────────────────

describe('AuthProvider — logout()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate already logged-in user
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/auth/logout', async () => {
    mockPost.mockResolvedValue({ data: null, message: '已登出' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.logout();
    });

    expect(mockPost).toHaveBeenCalledWith('/api/auth/logout');
  });

  it('should set isAuthenticated=false and user=null after successful logout', async () => {
    mockPost.mockResolvedValue({ data: null, message: '已登出' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    // Verify logged in before logout
    expect(hookResult.current.isAuthenticated).toBe(true);

    await act(async () => {
      await hookResult.current.logout();
    });

    expect(hookResult.current.isAuthenticated).toBe(false);
    expect(hookResult.current.user).toBeNull();
  });

  it('should set loading=false after successful logout', async () => {
    mockPost.mockResolvedValue({ data: null, message: '已登出' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.logout();
    });

    expect(hookResult.current.loading).toBe(false);
  });

  it('should throw an Error when logout fails', async () => {
    mockPost.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await expect(
      act(async () => {
        await hookResult.current.logout();
      })
    ).rejects.toThrow('网络连接失败，请稍后重试');
  });

  it('should keep isAuthenticated=true when logout fails (no premature state change)', async () => {
    mockPost.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    // User is logged in before failing logout
    expect(hookResult.current.isAuthenticated).toBe(true);

    try {
      await act(async () => {
        await hookResult.current.logout();
      });
    } catch {
      // expected
    }

    expect(hookResult.current.isAuthenticated).toBe(true);
  });
});

// ── Tests: useAuth Hook ───────────────────────────────────────────────────────

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error when used outside of AuthProvider', () => {
    // Suppress console.error from React for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');

    consoleError.mockRestore();
  });

  it('should return context value when used inside AuthProvider', async () => {
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    expect(hookResult.current).toHaveProperty('user');
    expect(hookResult.current).toHaveProperty('isAuthenticated');
    expect(hookResult.current).toHaveProperty('loading');
    expect(hookResult.current).toHaveProperty('login');
    expect(hookResult.current).toHaveProperty('register');
    expect(hookResult.current).toHaveProperty('logout');
  });

  it('should expose login, register, logout as functions', async () => {
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    expect(typeof hookResult.current.login).toBe('function');
    expect(typeof hookResult.current.register).toBe('function');
    expect(typeof hookResult.current.logout).toBe('function');
  });
});

// ── Tests: Context value shape ────────────────────────────────────────────────

describe('AuthProvider — context value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose the correct shape of context value after init success', async () => {
    mockGet.mockResolvedValue({ data: MOCK_USER, message: 'ok' });

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    const ctx = hookResult.current;
    expect(ctx.user).toEqual(MOCK_USER);
    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.loading).toBe(false);
    expect(typeof ctx.login).toBe('function');
    expect(typeof ctx.register).toBe('function');
    expect(typeof ctx.logout).toBe('function');
  });

  it('should expose the correct shape of context value after init failure', async () => {
    mockGet.mockRejectedValue(new Error('未授权'));

    const wrapper = createWrapper();
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    const ctx = hookResult.current;
    expect(ctx.user).toBeNull();
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.loading).toBe(false);
    expect(typeof ctx.login).toBe('function');
    expect(typeof ctx.register).toBe('function');
    expect(typeof ctx.logout).toBe('function');
  });
});
