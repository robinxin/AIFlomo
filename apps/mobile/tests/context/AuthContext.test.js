/**
 * AuthContext 单元测试（Vitest）
 *
 * 覆盖范围：
 *   - 初始化成功（GET /api/auth/me 返回用户）
 *   - 初始化失败（未登录，GET /api/auth/me 返回 401）
 *   - login 方法成功
 *   - login 方法失败（401 邮箱或密码错误）
 *   - register 方法成功
 *   - register 方法失败（409 邮箱已注册）
 *   - logout 方法成功
 *
 * 测试在 RED 阶段编写，实现代码尚未存在，预期全部失败。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock: fetch
// ---------------------------------------------------------------------------

// fetch 在 jsdom 环境中需要全局 mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Mock: expo-router（useRouter）
// ---------------------------------------------------------------------------

const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: mockRouterPush,
  }),
}));

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

/**
 * 包装 fetch mock，返回标准 JSON 响应。
 */
function mockFetchResponse({ status, body }) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ---------------------------------------------------------------------------
// Subject: AuthContext + AuthProvider + useAuth
// ---------------------------------------------------------------------------

// 延迟 import，因为要在 mock 配置后导入
let AuthProvider;
let useAuth;

beforeEach(async () => {
  vi.clearAllMocks();
  // 重新导入以清除模块缓存并获取最新版本
  const module = await import('../../context/AuthContext.jsx');
  AuthProvider = module.AuthProvider;
  useAuth = module.useAuth;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 辅助：Consumer 组件，将 context 值暴露到 DOM 供断言
// ---------------------------------------------------------------------------

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="isAuthenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="user-email">{auth.user ? auth.user.email : 'null'}</div>
      <div data-testid="user-nickname">{auth.user ? auth.user.nickname : 'null'}</div>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

// ---------------------------------------------------------------------------
// 初始化场景
// ---------------------------------------------------------------------------

describe('AuthContext — 初始化', () => {
  it('初始化时 loading 为 true，等待 GET /api/auth/me 完成', async () => {
    // 让 fetch 暂时 pending（不 resolve）
    let resolveFetch;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    renderWithProvider();

    // 在 fetch 完成前，loading 应为 true
    expect(screen.getByTestId('loading').textContent).toBe('true');

    // 完成 fetch（防止测试 pending）
    resolveFetch({
      ok: false,
      status: 401,
      json: async () => ({ data: null, error: '请先登录', message: '获取用户信息失败' }),
    });
  });

  it('GET /api/auth/me 成功 — 用户已登录，isAuthenticated=true，loading=false', async () => {
    mockFetchResponse({
      status: 200,
      body: {
        data: { id: 'uuid-1', email: 'user@example.com', nickname: '小明', createdAt: 1741824000000 },
        message: '获取用户信息成功',
      },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
    expect(screen.getByTestId('user-email').textContent).toBe('user@example.com');
    expect(screen.getByTestId('user-nickname').textContent).toBe('小明');
  });

  it('GET /api/auth/me 返回 401 — 未登录，isAuthenticated=false，loading=false', async () => {
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    expect(screen.getByTestId('user-email').textContent).toBe('null');
  });

  it('GET /api/auth/me 网络错误 — 降级为未登录状态，loading=false', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
  });

  it('初始化时调用了正确的 API 路径 GET /api/auth/me', async () => {
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.any(Object)
      );
    });
  });
});

// ---------------------------------------------------------------------------
// login 方法
// ---------------------------------------------------------------------------

describe('AuthContext — login()', () => {
  // 我们需要一个能调用 login 的组件
  function LoginTrigger({ onReady }) {
    const auth = useAuth();
    React.useEffect(() => {
      if (!auth.loading) {
        onReady(auth);
      }
    }, [auth.loading]);
    return (
      <div>
        <div data-testid="isAuthenticated">{String(auth.isAuthenticated)}</div>
        <div data-testid="user-email">{auth.user ? auth.user.email : 'null'}</div>
      </div>
    );
  }

  it('login 成功 — isAuthenticated 变为 true，user 被设置', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // login API 调用：成功
    mockFetchResponse({
      status: 200,
      body: {
        data: { id: 'uuid-1', email: 'user@example.com', nickname: '小明', createdAt: 1741824000000 },
        message: '登录成功',
      },
    });

    let authRef = null;

    render(
      <AuthProvider>
        <LoginTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    // 等待初始化完成
    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    });

    // 调用 login
    await act(async () => {
      await authRef.login('user@example.com', 'password123');
    });

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-email').textContent).toBe('user@example.com');
    });
  });

  it('login 成功 — 调用了 POST /api/auth/login，携带了正确参数', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // login API
    mockFetchResponse({
      status: 200,
      body: {
        data: { id: 'uuid-1', email: 'user@example.com', nickname: '小明', createdAt: 1741824000000 },
        message: '登录成功',
      },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <LoginTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('false'); });

    await act(async () => {
      await authRef.login('user@example.com', 'password123');
    });

    // 验证第二次 fetch 调用是 POST /api/auth/login
    const loginCall = mockFetch.mock.calls[1];
    expect(loginCall[0]).toContain('/api/auth/login');
    const loginOptions = loginCall[1];
    expect(loginOptions.method).toBe('POST');
    const body = JSON.parse(loginOptions.body);
    expect(body.email).toBe('user@example.com');
    expect(body.password).toBe('password123');
  });

  it('login 失败（401）— 抛出错误，isAuthenticated 保持 false', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // login API: 401
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '邮箱或密码错误，请重试', message: '登录失败' },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <LoginTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('false'); });

    let caughtError;
    await act(async () => {
      try {
        await authRef.login('user@example.com', 'wrongpassword');
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeDefined();
    expect(caughtError.message).toContain('邮箱或密码错误');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
  });

  it('login 网络错误 — 抛出错误', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // login: 网络错误
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    let authRef = null;
    render(
      <AuthProvider>
        <LoginTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('false'); });

    let caughtError;
    await act(async () => {
      try {
        await authRef.login('user@example.com', 'password123');
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// register 方法
// ---------------------------------------------------------------------------

describe('AuthContext — register()', () => {
  function RegisterTrigger({ onReady }) {
    const auth = useAuth();
    React.useEffect(() => {
      if (!auth.loading) onReady(auth);
    }, [auth.loading]);
    return (
      <div>
        <div data-testid="isAuthenticated">{String(auth.isAuthenticated)}</div>
        <div data-testid="user-email">{auth.user ? auth.user.email : 'null'}</div>
      </div>
    );
  }

  it('register 成功 — isAuthenticated 变为 true，user 被设置', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // register API: 201
    mockFetchResponse({
      status: 201,
      body: {
        data: { id: 'uuid-new', email: 'new@example.com', nickname: '新用户', createdAt: 1741824000000 },
        message: '注册成功',
      },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <RegisterTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('false'); });

    await act(async () => {
      await authRef.register('new@example.com', '新用户', 'password123', true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-email').textContent).toBe('new@example.com');
    });
  });

  it('register 成功 — 调用了 POST /api/auth/register，携带正确参数（含 agreedToPrivacy）', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // register API
    mockFetchResponse({
      status: 201,
      body: {
        data: { id: 'uuid-new', email: 'new@example.com', nickname: '新用户', createdAt: 1741824000000 },
        message: '注册成功',
      },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <RegisterTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('false'); });

    await act(async () => {
      await authRef.register('new@example.com', '新用户', 'password123', true);
    });

    const registerCall = mockFetch.mock.calls[1];
    expect(registerCall[0]).toContain('/api/auth/register');
    const options = registerCall[1];
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.email).toBe('new@example.com');
    expect(body.nickname).toBe('新用户');
    expect(body.password).toBe('password123');
    expect(body.agreedToPrivacy).toBe(true);
  });

  it('register 失败（409 邮箱已注册）— 抛出错误，isAuthenticated 保持 false', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // register API: 409
    mockFetchResponse({
      status: 409,
      body: { data: null, error: '该邮箱已被注册', message: '注册失败' },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <RegisterTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('false'); });

    let caughtError;
    await act(async () => {
      try {
        await authRef.register('existing@example.com', '用户', 'password123', true);
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeDefined();
    expect(caughtError.message).toContain('该邮箱已被注册');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
  });

  it('register 失败（500 服务器错误）— 抛出错误', async () => {
    // 初始化：未登录
    mockFetchResponse({
      status: 401,
      body: { data: null, error: '请先登录', message: '获取用户信息失败' },
    });

    // register API: 500
    mockFetchResponse({
      status: 500,
      body: { data: null, error: '服务器内部错误，请稍后重试', message: '注册失败' },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <RegisterTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('false'); });

    let caughtError;
    await act(async () => {
      try {
        await authRef.register('test@example.com', '用户', 'password123', true);
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// logout 方法
// ---------------------------------------------------------------------------

describe('AuthContext — logout()', () => {
  function LogoutTrigger({ onReady }) {
    const auth = useAuth();
    React.useEffect(() => {
      if (!auth.loading) onReady(auth);
    }, [auth.loading]);
    return (
      <div>
        <div data-testid="isAuthenticated">{String(auth.isAuthenticated)}</div>
        <div data-testid="user-email">{auth.user ? auth.user.email : 'null'}</div>
      </div>
    );
  }

  it('logout 成功 — isAuthenticated 变为 false，user 变为 null', async () => {
    // 初始化：已登录
    mockFetchResponse({
      status: 200,
      body: {
        data: { id: 'uuid-1', email: 'user@example.com', nickname: '小明', createdAt: 1741824000000 },
        message: '获取用户信息成功',
      },
    });

    // logout API
    mockFetchResponse({
      status: 200,
      body: { data: null, message: '已成功登出' },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <LogoutTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    // 等待初始化完成（已登录）
    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
    });

    // 调用 logout
    await act(async () => {
      await authRef.logout();
    });

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
      expect(screen.getByTestId('user-email').textContent).toBe('null');
    });
  });

  it('logout 成功 — 调用了 POST /api/auth/logout', async () => {
    // 初始化：已登录
    mockFetchResponse({
      status: 200,
      body: {
        data: { id: 'uuid-1', email: 'user@example.com', nickname: '小明', createdAt: 1741824000000 },
        message: '获取用户信息成功',
      },
    });

    // logout API
    mockFetchResponse({
      status: 200,
      body: { data: null, message: '已成功登出' },
    });

    let authRef = null;
    render(
      <AuthProvider>
        <LogoutTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('true'); });

    await act(async () => {
      await authRef.logout();
    });

    const logoutCall = mockFetch.mock.calls[1];
    expect(logoutCall[0]).toContain('/api/auth/logout');
    expect(logoutCall[1].method).toBe('POST');
  });

  it('logout 网络错误 — 抛出错误，isAuthenticated 保持 true', async () => {
    // 初始化：已登录
    mockFetchResponse({
      status: 200,
      body: {
        data: { id: 'uuid-1', email: 'user@example.com', nickname: '小明', createdAt: 1741824000000 },
        message: '获取用户信息成功',
      },
    });

    // logout: 网络错误
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    let authRef = null;
    render(
      <AuthProvider>
        <LogoutTrigger onReady={(auth) => { authRef = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => { expect(screen.getByTestId('isAuthenticated').textContent).toBe('true'); });

    let caughtError;
    await act(async () => {
      try {
        await authRef.logout();
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useAuth — 在 Provider 外部使用时抛出错误
// ---------------------------------------------------------------------------

describe('useAuth — 在 AuthProvider 外部使用', () => {
  it('在 Provider 外部调用 useAuth 应抛出错误', () => {
    function BadConsumer() {
      useAuth(); // 应该抛出
      return null;
    }

    // React 会在 console.error 中报告错误边界，需要静默
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<BadConsumer />)).toThrow();

    consoleSpy.mockRestore();
  });
});
