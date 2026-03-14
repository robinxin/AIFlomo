/**
 * api-client 单元测试（Vitest）
 *
 * 覆盖范围：
 *   - get(path) 发起 GET 请求，默认携带 credentials: 'include'
 *   - post(path, body) 发起 POST 请求，JSON 序列化 body
 *   - del(path) 发起 DELETE 请求
 *   - HTTP 401 响应时触发 dispatch({ type: 'AUTH_INIT_FAILURE' })
 *   - registerDispatch 注册 dispatch 函数
 *   - 非 401 响应不触发 dispatch
 *   - post(path) 不带 body 时不包含 body 字段（或 body 为 undefined）
 *   - 请求 URL 由 BASE_URL 与 path 拼接
 *   - Content-Type 默认为 application/json
 *
 * TDD 流程：先写测试（RED），实现后测试全部通过（GREEN），再重构（IMPROVE）。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: fetch（全局）
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// 工具函数：构建标准 fetch mock 响应
// ---------------------------------------------------------------------------

function mockFetchResponse({ status, body = {} }) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ---------------------------------------------------------------------------
// Subject：api-client 模块（每次测试前重新导入以重置模块状态）
// ---------------------------------------------------------------------------

let apiClient;

beforeEach(async () => {
  vi.clearAllMocks();
  // 重置模块缓存，确保 _dispatch 内部状态被清除
  vi.resetModules();
  apiClient = await import('../../lib/api-client.js');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// get(path) 方法
// ---------------------------------------------------------------------------

describe('apiClient.get(path)', () => {
  it('发起 GET 请求到正确 URL', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.get('/api/test');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/test');
  });

  it('使用 method: GET', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.get('/api/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('GET');
  });

  it('默认携带 credentials: include', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.get('/api/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.credentials).toBe('include');
  });

  it('携带 Content-Type: application/json 请求头', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.get('/api/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('返回 fetch 的 Response 对象', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: null, message: 'ok' }),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await apiClient.get('/api/test');

    expect(result).toBe(mockResponse);
  });
});

// ---------------------------------------------------------------------------
// post(path, body) 方法
// ---------------------------------------------------------------------------

describe('apiClient.post(path, body)', () => {
  it('发起 POST 请求到正确 URL', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.post('/api/auth/login', { email: 'a@b.com', password: '12345678' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/auth/login');
  });

  it('使用 method: POST', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.post('/api/auth/login', { email: 'a@b.com' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
  });

  it('默认携带 credentials: include', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.post('/api/auth/login', {});

    const [, options] = mockFetch.mock.calls[0];
    expect(options.credentials).toBe('include');
  });

  it('将 body 序列化为 JSON 字符串', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });
    const payload = { email: 'user@example.com', password: 'password123' };

    await apiClient.post('/api/auth/login', payload);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify(payload));
  });

  it('不传 body 时 body 字段为 undefined', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.post('/api/auth/logout');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBeUndefined();
  });

  it('携带 Content-Type: application/json 请求头', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.post('/api/auth/login', { email: 'a@b.com' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('返回 fetch 的 Response 对象', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      json: async () => ({ data: { id: '1' }, message: '注册成功' }),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await apiClient.post('/api/auth/register', { email: 'a@b.com' });

    expect(result).toBe(mockResponse);
  });
});

// ---------------------------------------------------------------------------
// del(path) 方法
// ---------------------------------------------------------------------------

describe('apiClient.del(path)', () => {
  it('发起 DELETE 请求到正确 URL', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.del('/api/memos/123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/memos/123');
  });

  it('使用 method: DELETE', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.del('/api/memos/123');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });

  it('默认携带 credentials: include', async () => {
    mockFetchResponse({ status: 200, body: { data: null, message: 'ok' } });

    await apiClient.del('/api/memos/123');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.credentials).toBe('include');
  });

  it('返回 fetch 的 Response 对象', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: null, message: 'ok' }),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await apiClient.del('/api/memos/123');

    expect(result).toBe(mockResponse);
  });
});

// ---------------------------------------------------------------------------
// HTTP 401 处理：触发 dispatch AUTH_INIT_FAILURE
// ---------------------------------------------------------------------------

describe('HTTP 401 自动触发 AUTH_INIT_FAILURE', () => {
  it('GET 请求返回 401 时，已注册的 dispatch 被调用，action type 为 AUTH_INIT_FAILURE', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 401, body: { data: null, error: '请先登录', message: '未登录' } });

    await apiClient.get('/api/auth/me');

    expect(mockDispatch).toHaveBeenCalledOnce();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
  });

  it('POST 请求返回 401 时，已注册的 dispatch 被调用', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 401, body: { data: null, error: '未登录', message: '请先登录' } });

    await apiClient.post('/api/auth/logout');

    expect(mockDispatch).toHaveBeenCalledOnce();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
  });

  it('DELETE 请求返回 401 时，已注册的 dispatch 被调用', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 401, body: { data: null, error: '未登录', message: '请先登录' } });

    await apiClient.del('/api/memos/123');

    expect(mockDispatch).toHaveBeenCalledOnce();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
  });

  it('401 响应时，仍然返回 Response 对象（调用方可继续处理）', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    const mockResponse = {
      ok: false,
      status: 401,
      json: async () => ({ data: null, error: '请先登录', message: '获取用户信息失败' }),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await apiClient.get('/api/auth/me');

    expect(result).toBe(mockResponse);
  });
});

// ---------------------------------------------------------------------------
// dispatch 未注册时 401 不抛出错误
// ---------------------------------------------------------------------------

describe('dispatch 未注册时的行为', () => {
  it('未注册 dispatch 时，HTTP 401 不抛出错误，正常返回 Response', async () => {
    // 注意：vi.resetModules() 在 beforeEach 中已重置模块，_dispatch 为 null
    mockFetchResponse({ status: 401, body: { data: null, error: '请先登录', message: '未登录' } });

    // 不应抛出错误
    await expect(apiClient.get('/api/auth/me')).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// registerDispatch 方法
// ---------------------------------------------------------------------------

describe('registerDispatch(dispatch)', () => {
  it('注册 dispatch 后，401 响应时触发该 dispatch', async () => {
    const dispatch1 = vi.fn();
    apiClient.registerDispatch(dispatch1);

    mockFetchResponse({ status: 401, body: {} });
    await apiClient.get('/api/any');

    expect(dispatch1).toHaveBeenCalledOnce();
  });

  it('重新注册 dispatch 后，使用新的 dispatch 函数', async () => {
    const dispatch1 = vi.fn();
    const dispatch2 = vi.fn();

    apiClient.registerDispatch(dispatch1);
    apiClient.registerDispatch(dispatch2);

    mockFetchResponse({ status: 401, body: {} });
    await apiClient.get('/api/any');

    expect(dispatch1).not.toHaveBeenCalled();
    expect(dispatch2).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 非 401 响应不触发 dispatch
// ---------------------------------------------------------------------------

describe('非 401 响应不触发 dispatch', () => {
  it('HTTP 200 响应不触发 dispatch', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 200, body: { data: { id: '1' }, message: 'ok' } });

    await apiClient.get('/api/auth/me');

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('HTTP 201 响应不触发 dispatch', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 201, body: { data: { id: '1' }, message: '注册成功' } });

    await apiClient.post('/api/auth/register', { email: 'a@b.com' });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('HTTP 400 响应不触发 dispatch', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 400, body: { data: null, error: '请求参数格式错误', message: '注册失败' } });

    await apiClient.post('/api/auth/register', { email: 'invalid' });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('HTTP 409 响应不触发 dispatch', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 409, body: { data: null, error: '该邮箱已被注册', message: '注册失败' } });

    await apiClient.post('/api/auth/register', { email: 'existing@example.com' });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('HTTP 500 响应不触发 dispatch', async () => {
    const mockDispatch = vi.fn();
    apiClient.registerDispatch(mockDispatch);

    mockFetchResponse({ status: 500, body: { data: null, error: '服务器内部错误', message: '请稍后重试' } });

    await apiClient.get('/api/any');

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// URL 拼接：BASE_URL + path
// ---------------------------------------------------------------------------

describe('URL 拼接', () => {
  it('get() — URL 包含 path 路径', async () => {
    mockFetchResponse({ status: 200, body: {} });

    await apiClient.get('/api/auth/me');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/me$/);
  });

  it('post() — URL 包含 path 路径', async () => {
    mockFetchResponse({ status: 200, body: {} });

    await apiClient.post('/api/auth/login', {});

    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/login$/);
  });

  it('del() — URL 包含 path 路径', async () => {
    mockFetchResponse({ status: 200, body: {} });

    await apiClient.del('/api/memos/abc-123');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/memos\/abc-123$/);
  });
});

// ---------------------------------------------------------------------------
// 默认导出包含所有方法
// ---------------------------------------------------------------------------

describe('默认导出', () => {
  it('默认导出包含 get 方法', () => {
    expect(typeof apiClient.default.get).toBe('function');
  });

  it('默认导出包含 post 方法', () => {
    expect(typeof apiClient.default.post).toBe('function');
  });

  it('默认导出包含 del 方法', () => {
    expect(typeof apiClient.default.del).toBe('function');
  });

  it('默认导出包含 registerDispatch 方法', () => {
    expect(typeof apiClient.default.registerDispatch).toBe('function');
  });
});
