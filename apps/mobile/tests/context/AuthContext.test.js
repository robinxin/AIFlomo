/**
 * AuthContext.test.js
 *
 * Unit tests for apps/mobile/context/AuthContext.jsx
 *
 * Written without JSX syntax so the file can use the standard .test.js
 * extension without requiring special Vite/esbuild configuration.
 * React.createElement() is used in place of JSX throughout.
 *
 * Coverage targets:
 *  - authReducer: all 4 action types
 *  - AuthProvider: mounts and calls GET /api/auth/me (init success and failure)
 *  - login(): calls POST /api/auth/login, dispatches AUTH_LOGIN_SUCCESS, returns user
 *  - register(): calls POST /api/auth/register, dispatches AUTH_LOGIN_SUCCESS, returns user
 *  - logout(): calls POST /api/auth/logout, dispatches AUTH_LOGOUT
 *  - useAuth(): throws when used outside AuthProvider
 *  - loading state starts as true, resolves after init
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Shorthand alias — avoids JSX dependency
// ---------------------------------------------------------------------------
const h = React.createElement;

// ---------------------------------------------------------------------------
// Mock react-native before importing any modules that depend on it.
// ---------------------------------------------------------------------------
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// ---------------------------------------------------------------------------
// Mock the apiClient so no real HTTP requests are made.
// ---------------------------------------------------------------------------
const mockApiClient = {
  setDispatch: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
};

vi.mock('../../lib/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// ---------------------------------------------------------------------------
// Import module under test after mocks are set up.
// We re-import per test group via vi.resetModules() to get fresh state.
// ---------------------------------------------------------------------------
async function loadAuthContext() {
  const mod = await import('../../context/AuthContext.jsx');
  return mod;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_USER = {
  id: 'user-1',
  email: 'test@example.com',
  nickname: 'Tester',
  createdAt: 1741824000000,
};

// ---------------------------------------------------------------------------
// authReducer (pure function tests — no React rendering needed)
// ---------------------------------------------------------------------------

describe('authReducer', () => {
  let authReducer;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await loadAuthContext();
    authReducer = mod.authReducer;
  });

  const initialState = {
    user: null,
    isAuthenticated: false,
    loading: true,
  };

  it('returns unchanged state for unknown actions', () => {
    const state = authReducer(initialState, { type: 'UNKNOWN_ACTION' });
    expect(state).toEqual(initialState);
  });

  describe('AUTH_INIT_SUCCESS', () => {
    it('sets user, isAuthenticated=true, loading=false', () => {
      const action = { type: 'AUTH_INIT_SUCCESS', payload: { user: TEST_USER } };
      const state = authReducer(initialState, action);
      expect(state).toEqual({
        user: TEST_USER,
        isAuthenticated: true,
        loading: false,
      });
    });

    it('does not mutate the original state object', () => {
      const action = { type: 'AUTH_INIT_SUCCESS', payload: { user: TEST_USER } };
      const frozen = Object.freeze({ ...initialState });
      // Should not throw even though the original is frozen (new object is returned)
      const state = authReducer(frozen, action);
      expect(state).not.toBe(frozen);
      expect(state.loading).toBe(false);
    });
  });

  describe('AUTH_INIT_FAILURE', () => {
    it('sets user=null, isAuthenticated=false, loading=false', () => {
      const previousState = { user: TEST_USER, isAuthenticated: true, loading: true };
      const action = { type: 'AUTH_INIT_FAILURE' };
      const state = authReducer(previousState, action);
      expect(state).toEqual({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    });

    it('works correctly starting from initial state', () => {
      const action = { type: 'AUTH_INIT_FAILURE' };
      const state = authReducer(initialState, action);
      expect(state).toEqual({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    });
  });

  describe('AUTH_LOGIN_SUCCESS', () => {
    it('sets user, isAuthenticated=true, loading=false', () => {
      const action = { type: 'AUTH_LOGIN_SUCCESS', payload: { user: TEST_USER } };
      const state = authReducer(initialState, action);
      expect(state).toEqual({
        user: TEST_USER,
        isAuthenticated: true,
        loading: false,
      });
    });

    it('updates user when already authenticated', () => {
      const oldUser = { id: 'old-1', email: 'old@example.com', nickname: 'Old' };
      const previousState = { user: oldUser, isAuthenticated: true, loading: false };
      const action = { type: 'AUTH_LOGIN_SUCCESS', payload: { user: TEST_USER } };
      const state = authReducer(previousState, action);
      expect(state.user).toEqual(TEST_USER);
    });
  });

  describe('AUTH_LOGOUT', () => {
    it('clears user, sets isAuthenticated=false, loading=false', () => {
      const previousState = { user: TEST_USER, isAuthenticated: true, loading: false };
      const action = { type: 'AUTH_LOGOUT' };
      const state = authReducer(previousState, action);
      expect(state).toEqual({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    });

    it('is idempotent when already logged out', () => {
      const action = { type: 'AUTH_LOGOUT' };
      const state = authReducer({ user: null, isAuthenticated: false, loading: false }, action);
      expect(state).toEqual({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// AuthProvider — initialization
// ---------------------------------------------------------------------------

describe('AuthProvider', () => {
  let AuthProvider, useAuth;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await loadAuthContext();
    AuthProvider = mod.AuthProvider;
    useAuth = mod.useAuth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with loading=true before GET /api/auth/me resolves', async () => {
    let resolveGet;
    mockApiClient.get.mockImplementation(
      () => new Promise((resolve) => { resolveGet = resolve; })
    );

    const captured = { loading: null };

    function Spy() {
      const ctx = useAuth();
      captured.loading = ctx.loading;
      return null;
    }

    await act(async () => {
      render(h(AuthProvider, null, h(Spy, null)));
    });

    expect(captured.loading).toBe(true);

    // Resolve the hanging promise to avoid open handles
    await act(async () => {
      resolveGet({ data: TEST_USER, message: 'ok' });
    });
  });

  it('sets user and isAuthenticated=true when GET /api/auth/me succeeds', async () => {
    mockApiClient.get.mockResolvedValue({ data: TEST_USER, message: 'ok' });

    const captured = { user: null, isAuthenticated: null, loading: null };

    function Spy() {
      const ctx = useAuth();
      captured.user = ctx.user;
      captured.isAuthenticated = ctx.isAuthenticated;
      captured.loading = ctx.loading;
      return null;
    }

    await act(async () => {
      render(h(AuthProvider, null, h(Spy, null)));
    });

    await waitFor(() => expect(captured.loading).toBe(false));

    expect(captured.user).toEqual(TEST_USER);
    expect(captured.isAuthenticated).toBe(true);
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/me');
  });

  it('sets loading=false, user=null, isAuthenticated=false when GET /api/auth/me fails', async () => {
    mockApiClient.get.mockRejectedValue(new Error('未授权访问'));

    const captured = { user: undefined, isAuthenticated: undefined, loading: null };

    function Spy() {
      const ctx = useAuth();
      captured.user = ctx.user;
      captured.isAuthenticated = ctx.isAuthenticated;
      captured.loading = ctx.loading;
      return null;
    }

    await act(async () => {
      render(h(AuthProvider, null, h(Spy, null)));
    });

    await waitFor(() => expect(captured.loading).toBe(false));

    expect(captured.user).toBeNull();
    expect(captured.isAuthenticated).toBe(false);
  });

  it('calls apiClient.setDispatch with the reducer dispatch function on mount', async () => {
    mockApiClient.get.mockResolvedValue({ data: TEST_USER, message: 'ok' });

    await act(async () => {
      render(h(AuthProvider, null, null));
    });

    expect(mockApiClient.setDispatch).toHaveBeenCalledWith(expect.any(Function));
  });

  it('renders children', async () => {
    mockApiClient.get.mockResolvedValue({ data: TEST_USER, message: 'ok' });

    await act(async () => {
      render(
        h(AuthProvider, null,
          h('div', { 'data-testid': 'child' }, 'hello')
        )
      );
    });

    expect(screen.getByTestId('child')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------

describe('login()', () => {
  let AuthProvider, useAuth;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // Auth init: unauthenticated state
    mockApiClient.get.mockRejectedValue(new Error('UNAUTHORIZED'));
    const mod = await loadAuthContext();
    AuthProvider = mod.AuthProvider;
    useAuth = mod.useAuth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderWithProvider(childFactory) {
    return render(h(AuthProvider, null, childFactory()));
  }

  it('calls POST /api/auth/login with email and password', async () => {
    mockApiClient.post.mockResolvedValue({ data: TEST_USER, message: '登录成功' });

    let loginFn;

    function Spy() {
      const ctx = useAuth();
      loginFn = ctx.login;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      await loginFn('test@example.com', 'password123');
    });

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('updates state to authenticated after successful login', async () => {
    mockApiClient.post.mockResolvedValue({ data: TEST_USER, message: '登录成功' });

    const captured = { user: null, isAuthenticated: null };

    function Spy() {
      const ctx = useAuth();
      captured.user = ctx.user;
      captured.isAuthenticated = ctx.isAuthenticated;
      return h('button', { onClick: () => ctx.login('test@example.com', 'pass') }, 'login');
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(captured.isAuthenticated).toBe(true));

    expect(captured.user).toEqual(TEST_USER);
  });

  it('returns the user object on success', async () => {
    mockApiClient.post.mockResolvedValue({ data: TEST_USER, message: '登录成功' });

    let returnedUser;
    let loginFn;

    function Spy() {
      const ctx = useAuth();
      loginFn = ctx.login;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      returnedUser = await loginFn('test@example.com', 'password123');
    });

    expect(returnedUser).toEqual(TEST_USER);
  });

  it('throws an error when POST /api/auth/login fails', async () => {
    const loginError = new Error('邮箱或密码错误，请重试');
    loginError.status = 401;
    mockApiClient.post.mockRejectedValue(loginError);

    let loginFn;
    let thrownError;

    function Spy() {
      const ctx = useAuth();
      loginFn = ctx.login;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      try {
        await loginFn('bad@example.com', 'wrongpass');
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe('邮箱或密码错误，请重试');
  });
});

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------

describe('register()', () => {
  let AuthProvider, useAuth;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockApiClient.get.mockRejectedValue(new Error('UNAUTHORIZED'));
    const mod = await loadAuthContext();
    AuthProvider = mod.AuthProvider;
    useAuth = mod.useAuth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderWithProvider(childFactory) {
    return render(h(AuthProvider, null, childFactory()));
  }

  it('calls POST /api/auth/register with correct parameters', async () => {
    mockApiClient.post.mockResolvedValue({ data: TEST_USER, message: '注册成功' });

    let registerFn;

    function Spy() {
      const ctx = useAuth();
      registerFn = ctx.register;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      await registerFn('test@example.com', 'Tester', 'password123');
    });

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'test@example.com',
      nickname: 'Tester',
      password: 'password123',
      agreedToPrivacy: true,
    });
  });

  it('updates state to authenticated after successful registration', async () => {
    mockApiClient.post.mockResolvedValue({ data: TEST_USER, message: '注册成功' });

    const captured = { user: null, isAuthenticated: null };
    let registerFn;

    function Spy() {
      const ctx = useAuth();
      registerFn = ctx.register;
      captured.user = ctx.user;
      captured.isAuthenticated = ctx.isAuthenticated;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      await registerFn('test@example.com', 'Tester', 'password123', Date.now());
    });

    expect(captured.user).toEqual(TEST_USER);
    expect(captured.isAuthenticated).toBe(true);
  });

  it('returns the user object on success', async () => {
    mockApiClient.post.mockResolvedValue({ data: TEST_USER, message: '注册成功' });

    let returnedUser;
    let registerFn;

    function Spy() {
      const ctx = useAuth();
      registerFn = ctx.register;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      returnedUser = await registerFn('test@example.com', 'Tester', 'password123', Date.now());
    });

    expect(returnedUser).toEqual(TEST_USER);
  });

  it('throws an error when POST /api/auth/register fails', async () => {
    const registerError = new Error('该邮箱已被注册');
    registerError.status = 409;
    mockApiClient.post.mockRejectedValue(registerError);

    let registerFn;
    let thrownError;

    function Spy() {
      const ctx = useAuth();
      registerFn = ctx.register;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await act(async () => {
      try {
        await registerFn('exists@example.com', 'Tester', 'password123', Date.now());
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe('该邮箱已被注册');
  });
});

// ---------------------------------------------------------------------------
// logout()
// ---------------------------------------------------------------------------

describe('logout()', () => {
  let AuthProvider, useAuth;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // Start authenticated
    mockApiClient.get.mockResolvedValue({ data: TEST_USER, message: 'ok' });
    const mod = await loadAuthContext();
    AuthProvider = mod.AuthProvider;
    useAuth = mod.useAuth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderWithProvider(childFactory) {
    return render(h(AuthProvider, null, childFactory()));
  }

  it('calls POST /api/auth/logout', async () => {
    mockApiClient.post.mockResolvedValue({ data: null, message: '已登出' });

    let logoutFn;

    function Spy() {
      const ctx = useAuth();
      logoutFn = ctx.logout;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await waitFor(() => expect(logoutFn).toBeDefined());

    await act(async () => {
      await logoutFn();
    });

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout');
  });

  it('clears user and sets isAuthenticated=false after logout', async () => {
    mockApiClient.post.mockResolvedValue({ data: null, message: '已登出' });

    const captured = { user: undefined, isAuthenticated: undefined };

    function Spy() {
      const ctx = useAuth();
      captured.user = ctx.user;
      captured.isAuthenticated = ctx.isAuthenticated;
      return h('button', { onClick: () => ctx.logout() }, 'logout');
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await waitFor(() => expect(captured.isAuthenticated).toBe(true));

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(captured.isAuthenticated).toBe(false));

    expect(captured.user).toBeNull();
  });

  it('throws an error when POST /api/auth/logout fails', async () => {
    const logoutError = new Error('网络连接失败，请稍后重试');
    mockApiClient.post.mockRejectedValue(logoutError);

    let logoutFn;
    let thrownError;

    function Spy() {
      const ctx = useAuth();
      logoutFn = ctx.logout;
      return null;
    }

    await act(async () => {
      renderWithProvider(() => h(Spy, null));
    });

    await waitFor(() => expect(logoutFn).toBeDefined());

    await act(async () => {
      try {
        await logoutFn();
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe('网络连接失败，请稍后重试');
  });
});

// ---------------------------------------------------------------------------
// useAuth() — outside Provider
// ---------------------------------------------------------------------------

describe('useAuth()', () => {
  let useAuth, AuthProvider;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await loadAuthContext();
    useAuth = mod.useAuth;
    AuthProvider = mod.AuthProvider;
  });

  it('throws an error when used outside AuthProvider', () => {
    const consoleError = console.error;
    console.error = vi.fn();

    function BadConsumer() {
      useAuth();
      return null;
    }

    expect(() => render(h(BadConsumer, null))).toThrow(
      'useAuth must be used within AuthProvider'
    );

    console.error = consoleError;
  });

  it('does not throw when used inside AuthProvider', async () => {
    mockApiClient.get.mockResolvedValue({ data: TEST_USER, message: 'ok' });

    function GoodConsumer() {
      useAuth();
      return null;
    }

    await act(async () => {
      expect(() =>
        render(h(AuthProvider, null, h(GoodConsumer, null)))
      ).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

describe('AuthContext value shape', () => {
  let AuthProvider, useAuth;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockApiClient.get.mockResolvedValue({ data: TEST_USER, message: 'ok' });
    const mod = await loadAuthContext();
    AuthProvider = mod.AuthProvider;
    useAuth = mod.useAuth;
  });

  it('exposes user, isAuthenticated, loading, login, register, logout', async () => {
    const captured = {};

    function Spy() {
      const ctx = useAuth();
      Object.assign(captured, ctx);
      return null;
    }

    await act(async () => {
      render(h(AuthProvider, null, h(Spy, null)));
    });

    await waitFor(() => expect(captured.loading).toBe(false));

    expect(captured).toHaveProperty('user');
    expect(captured).toHaveProperty('isAuthenticated');
    expect(captured).toHaveProperty('loading');
    expect(typeof captured.login).toBe('function');
    expect(typeof captured.register).toBe('function');
    expect(typeof captured.logout).toBe('function');
  });
});
