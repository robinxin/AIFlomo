/**
 * api-client.test.js
 *
 * Unit tests for apps/mobile/lib/api-client.js
 *
 * Coverage targets:
 *  - get(), post(), del(), put() methods
 *  - credentials: 'include' always sent
 *  - Content-Type: application/json on POST / PUT
 *  - Network errors → custom Error with localised message
 *  - HTTP 4xx / 5xx → Error with .status and .body
 *  - HTTP 401 → dispatch(AUTH_INIT_FAILURE) called
 *  - HTTP 401 without dispatch set → no crash
 *  - Successful 2xx → returns parsed JSON
 *  - Empty body on 2xx → returns null gracefully
 *  - setDispatch() replaces the dispatch reference
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock react-native Platform before importing the module under test.
// ---------------------------------------------------------------------------
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock process.env so BASE_URL resolves to empty string (web mode).
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.EXPO_PUBLIC_API_URL;
});
afterEach(() => {
  process.env = originalEnv;
});

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks are set up so the module picks up the mocked
// Platform.  We re-import in each group via a beforeEach reset.
// ---------------------------------------------------------------------------

// We use a local helper to get a fresh module reference each test group.
async function loadClient() {
  // Vitest module cache — reset between tests via vi.resetModules()
  const mod = await import('../../lib/api-client.js');
  return mod.apiClient;
}

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

function mockFetch(response) {
  global.fetch = vi.fn().mockResolvedValue(response);
}

function buildResponse({ status = 200, body = null, ok = true } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('apiClient', () => {
  let client;

  beforeEach(async () => {
    vi.resetModules();
    client = await loadClient();
    // Reset dispatch to null between tests
    client.setDispatch(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------

  describe('get(path)', () => {
    it('sends a GET request to the correct path', async () => {
      const responseBody = { data: { id: '1', email: 'a@b.com', nickname: 'A' }, message: 'ok' };
      mockFetch(buildResponse({ body: responseBody }));

      const result = await client.get('/api/auth/me');

      expect(fetch).toHaveBeenCalledOnce();
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('/api/auth/me');
      expect(options.method).toBe('GET');
      expect(result).toEqual(responseBody);
    });

    it('always sends credentials: include', async () => {
      mockFetch(buildResponse({ body: {} }));

      await client.get('/api/auth/me');

      const [, options] = fetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('does NOT set Content-Type on GET requests', async () => {
      mockFetch(buildResponse({ body: {} }));

      await client.get('/api/some-resource');

      const [, options] = fetch.mock.calls[0];
      expect(options.headers?.['Content-Type']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // POST
  // -------------------------------------------------------------------------

  describe('post(path, body)', () => {
    it('sends a POST request with JSON body and Content-Type header', async () => {
      const payload = { email: 'user@example.com', password: 'secret123' };
      const responseBody = { data: { id: '1', email: 'user@example.com', nickname: 'U' }, message: '登录成功' };
      mockFetch(buildResponse({ body: responseBody }));

      const result = await client.post('/api/auth/login', payload);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('/api/auth/login');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBe(JSON.stringify(payload));
      expect(result).toEqual(responseBody);
    });

    it('always sends credentials: include on POST', async () => {
      mockFetch(buildResponse({ body: {} }));

      await client.post('/api/auth/register', { email: 'a@b.com' });

      const [, options] = fetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------

  describe('del(path)', () => {
    it('sends a DELETE request to the correct path', async () => {
      mockFetch(buildResponse({ body: { data: null, message: '已删除' } }));

      const result = await client.del('/api/memos/123');

      expect(fetch).toHaveBeenCalledOnce();
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('/api/memos/123');
      expect(options.method).toBe('DELETE');
      expect(result).toEqual({ data: null, message: '已删除' });
    });

    it('always sends credentials: include on DELETE', async () => {
      mockFetch(buildResponse({ body: null }));

      await client.del('/api/memos/abc');

      const [, options] = fetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });
  });

  // -------------------------------------------------------------------------
  // PUT
  // -------------------------------------------------------------------------

  describe('put(path, body)', () => {
    it('sends a PUT request with JSON body', async () => {
      const payload = { nickname: 'NewName' };
      const responseBody = { data: { id: '1', nickname: 'NewName' }, message: '更新成功' };
      mockFetch(buildResponse({ body: responseBody }));

      const result = await client.put('/api/users/1', payload);

      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('/api/users/1');
      expect(options.method).toBe('PUT');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBe(JSON.stringify(payload));
      expect(result).toEqual(responseBody);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling — network failures
  // -------------------------------------------------------------------------

  describe('network error handling', () => {
    it('throws a user-friendly Error when fetch rejects (network failure)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(client.get('/api/auth/me')).rejects.toThrow('网络连接失败，请稍后重试');
    });

    it('wraps network error as .cause on the thrown Error', async () => {
      const networkError = new TypeError('Failed to fetch');
      global.fetch = vi.fn().mockRejectedValue(networkError);

      let thrown;
      try {
        await client.get('/api/auth/me');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.cause).toBe(networkError);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling — HTTP errors
  // -------------------------------------------------------------------------

  describe('HTTP error handling', () => {
    it('throws an Error with message from response body for 400 errors', async () => {
      const errorBody = { data: null, error: 'VALIDATION_ERROR', message: '请求参数格式非法' };
      mockFetch(buildResponse({ status: 400, ok: false, body: errorBody }));

      await expect(client.post('/api/auth/register', {})).rejects.toThrow('请求参数格式非法');
    });

    it('attaches .status and .body to the thrown Error', async () => {
      const errorBody = { data: null, error: 'VALIDATION_ERROR', message: '请求参数格式非法' };
      mockFetch(buildResponse({ status: 400, ok: false, body: errorBody }));

      let thrown;
      try {
        await client.post('/api/auth/register', {});
      } catch (err) {
        thrown = err;
      }

      expect(thrown.status).toBe(400);
      expect(thrown.body).toEqual(errorBody);
    });

    it('falls back to error field when message is absent', async () => {
      const errorBody = { data: null, error: 'EMAIL_ALREADY_EXISTS' };
      mockFetch(buildResponse({ status: 409, ok: false, body: errorBody }));

      await expect(client.post('/api/auth/register', {})).rejects.toThrow('EMAIL_ALREADY_EXISTS');
    });

    it('falls back to generic message when response body is not valid JSON', async () => {
      const response = {
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      };
      global.fetch = vi.fn().mockResolvedValue(response);

      await expect(client.get('/api/memos')).rejects.toThrow('HTTP error 500');
    });

    it('throws for 5xx server errors', async () => {
      const errorBody = { data: null, error: 'INTERNAL_ERROR', message: '服务器内部错误' };
      mockFetch(buildResponse({ status: 500, ok: false, body: errorBody }));

      await expect(client.get('/api/memos')).rejects.toThrow('服务器内部错误');
    });
  });

  // -------------------------------------------------------------------------
  // 401 — global auth failure interception
  // -------------------------------------------------------------------------

  describe('HTTP 401 interception', () => {
    it('dispatches AUTH_INIT_FAILURE when a 401 response is received', async () => {
      const errorBody = { data: null, error: 'UNAUTHORIZED', message: '未授权访问' };
      mockFetch(buildResponse({ status: 401, ok: false, body: errorBody }));

      const dispatch = vi.fn();
      client.setDispatch(dispatch);

      await expect(client.get('/api/auth/me')).rejects.toThrow();

      expect(dispatch).toHaveBeenCalledOnce();
      expect(dispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
    });

    it('still throws an Error after dispatching AUTH_INIT_FAILURE', async () => {
      const errorBody = { data: null, error: 'UNAUTHORIZED', message: '未授权访问' };
      mockFetch(buildResponse({ status: 401, ok: false, body: errorBody }));

      const dispatch = vi.fn();
      client.setDispatch(dispatch);

      await expect(client.get('/api/auth/me')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('does NOT throw when dispatch is not set (null) and a 401 arrives', async () => {
      const errorBody = { data: null, error: 'UNAUTHORIZED', message: '未授权访问' };
      mockFetch(buildResponse({ status: 401, ok: false, body: errorBody }));

      // dispatch is null by default after setDispatch(null) in beforeEach
      await expect(client.get('/api/auth/me')).rejects.toThrow('未授权访问');
      // The key assertion: no crash due to calling null()
    });

    it('does NOT call dispatch for 403 responses', async () => {
      const errorBody = { data: null, error: 'FORBIDDEN', message: '权限不足' };
      mockFetch(buildResponse({ status: 403, ok: false, body: errorBody }));

      const dispatch = vi.fn();
      client.setDispatch(dispatch);

      await expect(client.get('/api/admin')).rejects.toThrow('权限不足');
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // setDispatch
  // -------------------------------------------------------------------------

  describe('setDispatch(dispatch)', () => {
    it('replaces the existing dispatch reference', async () => {
      const dispatch1 = vi.fn();
      const dispatch2 = vi.fn();

      client.setDispatch(dispatch1);
      client.setDispatch(dispatch2);

      const errorBody = { data: null, error: 'UNAUTHORIZED', message: '未授权访问' };
      mockFetch(buildResponse({ status: 401, ok: false, body: errorBody }));

      await expect(client.get('/api/auth/me')).rejects.toThrow();

      expect(dispatch1).not.toHaveBeenCalled();
      expect(dispatch2).toHaveBeenCalledOnce();
    });

    it('accepts null to clear the dispatch reference', async () => {
      const dispatch = vi.fn();
      client.setDispatch(dispatch);
      client.setDispatch(null);

      const errorBody = { data: null, error: 'UNAUTHORIZED', message: '未授权访问' };
      mockFetch(buildResponse({ status: 401, ok: false, body: errorBody }));

      // Should not crash
      await expect(client.get('/api/auth/me')).rejects.toThrow();
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty 2xx response body gracefully (returns null)', async () => {
      const response = {
        ok: true,
        status: 204,
        json: vi.fn().mockRejectedValue(new SyntaxError('No content')),
      };
      global.fetch = vi.fn().mockResolvedValue(response);

      const result = await client.del('/api/memos/abc');
      expect(result).toBeNull();
    });

    it('uses EXPO_PUBLIC_API_URL as base when set', async () => {
      // Reset module to pick up the env variable
      vi.resetModules();
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.100:3000';

      const mod = await import('../../lib/api-client.js');
      const freshClient = mod.apiClient;

      mockFetch(buildResponse({ body: {} }));

      await freshClient.get('/api/auth/me');

      const [url] = fetch.mock.calls[0];
      expect(url).toBe('http://192.168.1.100:3000/api/auth/me');

      // Cleanup
      delete process.env.EXPO_PUBLIC_API_URL;
    });

    it('strips trailing slash from EXPO_PUBLIC_API_URL base url', async () => {
      vi.resetModules();
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.100:3000/';

      const mod = await import('../../lib/api-client.js');
      const freshClient = mod.apiClient;

      mockFetch(buildResponse({ body: {} }));

      await freshClient.get('/api/auth/me');

      const [url] = fetch.mock.calls[0];
      expect(url).toBe('http://192.168.1.100:3000/api/auth/me');

      delete process.env.EXPO_PUBLIC_API_URL;
    });
  });
});
