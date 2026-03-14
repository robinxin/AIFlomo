/**
 * TDD Test: apps/mobile/lib/api-client.js
 * Task T008 - 统一 HTTP 请求封装
 *
 * Tests cover:
 * - get(path): 成功响应、自动携带 credentials、401 触发全局登出
 * - post(path, body): 成功响应、自动携带 credentials、Content-Type、401 触发全局登出
 * - del(path): 成功响应、自动携带 credentials、401 触发全局登出
 * - 错误处理: 网络错误、非 2xx 响应、JSON 解析失败
 *
 * Mock 策略:
 * - vi.stubGlobal('fetch', ...) — mock 全局 fetch
 * - createApiClient(dispatch) — 注入 mock dispatch 验证 AUTH_INIT_FAILURE
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../../lib/api-client.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';
const TEST_PATH = '/api/auth/me';
const POST_PATH = '/api/auth/login';
const DEL_PATH = '/api/memos/1';

const SUCCESS_DATA = {
  data: { id: 'user-001', email: 'user@example.com', nickname: '测试用户' },
  message: '获取用户信息成功',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build a mock Response object that mirrors the Web Fetch API Response shape.
 */
function buildMockResponse({ status = 200, body = SUCCESS_DATA, ok = true } = {}) {
  return {
    status,
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

/**
 * Build a mock Response that simulates a JSON parse failure.
 */
function buildBrokenJsonResponse({ status = 200, ok = true } = {}) {
  return {
    status,
    ok,
    json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
  };
}

// ── Test Suites ────────────────────────────────────────────────────────────────

describe('api-client', () => {
  let mockDispatch;
  let client;
  let mockFetch;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    client = createApiClient({ baseURL: BASE_URL, dispatch: mockDispatch });
  });

  // ── get(path) ────────────────────────────────────────────────────────────────

  describe('get(path)', () => {
    describe('成功响应', () => {
      it('should return parsed JSON body on HTTP 200', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: SUCCESS_DATA }));

        const result = await client.get(TEST_PATH);

        expect(result).toEqual(SUCCESS_DATA);
      });

      it('should call fetch with the correct full URL', async () => {
        mockFetch.mockResolvedValue(buildMockResponse());

        await client.get(TEST_PATH);

        expect(mockFetch).toHaveBeenCalledWith(
          `${BASE_URL}${TEST_PATH}`,
          expect.any(Object)
        );
      });

      it('should call fetch exactly once', async () => {
        mockFetch.mockResolvedValue(buildMockResponse());

        await client.get(TEST_PATH);

        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('自动携带 credentials: include', () => {
      it('should include credentials: "include" in the fetch options', async () => {
        mockFetch.mockResolvedValue(buildMockResponse());

        await client.get(TEST_PATH);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ credentials: 'include' })
        );
      });

      it('should use GET as the HTTP method', async () => {
        mockFetch.mockResolvedValue(buildMockResponse());

        await client.get(TEST_PATH);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: 'GET' })
        );
      });
    });

    describe('401 响应时触发全局登出', () => {
      it('should dispatch AUTH_INIT_FAILURE when response is 401', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 401, ok: false, body: { data: null, error: '请先登录' } })
        );

        await expect(client.get(TEST_PATH)).rejects.toThrow();

        expect(mockDispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
      });

      it('should call dispatch exactly once on 401', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 401, ok: false, body: { data: null, error: '请先登录' } })
        );

        await expect(client.get(TEST_PATH)).rejects.toThrow();

        expect(mockDispatch).toHaveBeenCalledTimes(1);
      });

      it('should throw an error after dispatching AUTH_INIT_FAILURE on 401', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 401, ok: false, body: { data: null, error: '请先登录' } })
        );

        await expect(client.get(TEST_PATH)).rejects.toThrow();
      });
    });
  });

  // ── post(path, body) ─────────────────────────────────────────────────────────

  describe('post(path, body)', () => {
    const postBody = { email: 'user@example.com', password: 'password123' };
    const postSuccess = {
      data: { id: 'user-001', email: 'user@example.com', nickname: '用户' },
      message: '登录成功',
    };

    describe('成功响应', () => {
      it('should return parsed JSON body on HTTP 201', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 201, body: postSuccess, ok: true })
        );

        const result = await client.post(POST_PATH, postBody);

        expect(result).toEqual(postSuccess);
      });

      it('should return parsed JSON body on HTTP 200', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 200, body: postSuccess, ok: true })
        );

        const result = await client.post(POST_PATH, postBody);

        expect(result).toEqual(postSuccess);
      });

      it('should call fetch with the correct full URL', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: postSuccess }));

        await client.post(POST_PATH, postBody);

        expect(mockFetch).toHaveBeenCalledWith(
          `${BASE_URL}${POST_PATH}`,
          expect.any(Object)
        );
      });

      it('should serialize the body as JSON string', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: postSuccess }));

        await client.post(POST_PATH, postBody);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ body: JSON.stringify(postBody) })
        );
      });
    });

    describe('自动携带 credentials: include', () => {
      it('should include credentials: "include" in the fetch options', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: postSuccess }));

        await client.post(POST_PATH, postBody);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ credentials: 'include' })
        );
      });

      it('should use POST as the HTTP method', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: postSuccess }));

        await client.post(POST_PATH, postBody);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    describe('设置 Content-Type: application/json', () => {
      it('should include Content-Type: application/json header', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: postSuccess }));

        await client.post(POST_PATH, postBody);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    describe('401 响应时触发全局登出', () => {
      it('should dispatch AUTH_INIT_FAILURE when response is 401', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 401,
            ok: false,
            body: { data: null, error: '邮箱或密码错误，请重试' },
          })
        );

        await expect(client.post(POST_PATH, postBody)).rejects.toThrow();

        expect(mockDispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
      });

      it('should throw an error after dispatching AUTH_INIT_FAILURE on 401', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 401,
            ok: false,
            body: { data: null, error: '邮箱或密码错误，请重试' },
          })
        );

        await expect(client.post(POST_PATH, postBody)).rejects.toThrow();
      });
    });
  });

  // ── del(path) ────────────────────────────────────────────────────────────────

  describe('del(path)', () => {
    const delSuccess = { data: null, message: '删除成功' };

    describe('成功响应', () => {
      it('should return parsed JSON body on HTTP 200', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 200, body: delSuccess, ok: true })
        );

        const result = await client.del(DEL_PATH);

        expect(result).toEqual(delSuccess);
      });

      it('should call fetch with the correct full URL', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: delSuccess }));

        await client.del(DEL_PATH);

        expect(mockFetch).toHaveBeenCalledWith(
          `${BASE_URL}${DEL_PATH}`,
          expect.any(Object)
        );
      });
    });

    describe('自动携带 credentials: include', () => {
      it('should include credentials: "include" in the fetch options', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: delSuccess }));

        await client.del(DEL_PATH);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ credentials: 'include' })
        );
      });

      it('should use DELETE as the HTTP method', async () => {
        mockFetch.mockResolvedValue(buildMockResponse({ status: 200, body: delSuccess }));

        await client.del(DEL_PATH);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: 'DELETE' })
        );
      });
    });

    describe('401 响应时触发全局登出', () => {
      it('should dispatch AUTH_INIT_FAILURE when response is 401', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 401, ok: false, body: { data: null, error: '请先登录' } })
        );

        await expect(client.del(DEL_PATH)).rejects.toThrow();

        expect(mockDispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
      });

      it('should throw an error after dispatching AUTH_INIT_FAILURE on 401', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({ status: 401, ok: false, body: { data: null, error: '请先登录' } })
        );

        await expect(client.del(DEL_PATH)).rejects.toThrow();
      });
    });
  });

  // ── 错误处理 ─────────────────────────────────────────────────────────────────

  describe('错误处理', () => {
    describe('网络错误时抛出友好错误信息', () => {
      it('should throw a friendly error message when fetch rejects (network failure)', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(client.get(TEST_PATH)).rejects.toThrow();
      });

      it('should not call dispatch when a network error occurs (no 401 logic)', async () => {
        mockFetch.mockRejectedValue(new TypeError('Network request failed'));

        try {
          await client.get(TEST_PATH);
        } catch {
          // expected
        }

        expect(mockDispatch).not.toHaveBeenCalled();
      });

      it('should throw an Error instance (not raw TypeError) with a user-friendly message on network failure', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        const error = await client.get(TEST_PATH).catch((e) => e);

        expect(error).toBeInstanceOf(Error);
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      });

      it('should throw a friendly error when fetch rejects on post', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(client.post(POST_PATH, {})).rejects.toThrow('网络连接失败，请稍后重试');
      });

      it('should throw a friendly error when fetch rejects on del', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(client.del(DEL_PATH)).rejects.toThrow('网络连接失败，请稍后重试');
      });

      it('should throw "网络连接失败，请稍后重试" on GET network failure', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(client.get(TEST_PATH)).rejects.toThrow('网络连接失败，请稍后重试');
      });
    });

    describe('非 2xx 响应时抛出错误（除了 401 特殊处理）', () => {
      it('should throw an error on HTTP 400 response', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 400,
            ok: false,
            body: { data: null, error: '请求参数格式错误' },
          })
        );

        await expect(client.get(TEST_PATH)).rejects.toThrow();
      });

      it('should throw an error on HTTP 409 response', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 409,
            ok: false,
            body: { data: null, error: '该邮箱已被注册' },
          })
        );

        await expect(client.post(POST_PATH, {})).rejects.toThrow();
      });

      it('should throw an error on HTTP 500 response', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 500,
            ok: false,
            body: { data: null, error: '服务器内部错误，请稍后重试' },
          })
        );

        await expect(client.get(TEST_PATH)).rejects.toThrow();
      });

      it('should NOT dispatch AUTH_INIT_FAILURE for non-401 error responses', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 500,
            ok: false,
            body: { data: null, error: '服务器内部错误，请稍后重试' },
          })
        );

        try {
          await client.get(TEST_PATH);
        } catch {
          // expected
        }

        expect(mockDispatch).not.toHaveBeenCalled();
      });

      it('should NOT dispatch AUTH_INIT_FAILURE for HTTP 400', async () => {
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 400,
            ok: false,
            body: { data: null, error: '请求参数格式错误' },
          })
        );

        try {
          await client.post(POST_PATH, {});
        } catch {
          // expected
        }

        expect(mockDispatch).not.toHaveBeenCalled();
      });

      it('should include the server error message in the thrown error when available', async () => {
        const serverError = '该邮箱已被注册';
        mockFetch.mockResolvedValue(
          buildMockResponse({
            status: 409,
            ok: false,
            body: { data: null, error: serverError },
          })
        );

        const error = await client.post(POST_PATH, {}).catch((e) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain(serverError);
      });
    });

    describe('返回 JSON 格式错误时抛出错误', () => {
      it('should throw an error when response.json() fails on a successful response', async () => {
        mockFetch.mockResolvedValue(buildBrokenJsonResponse({ status: 200, ok: true }));

        await expect(client.get(TEST_PATH)).rejects.toThrow();
      });

      it('should throw an error when response.json() fails on post', async () => {
        mockFetch.mockResolvedValue(buildBrokenJsonResponse({ status: 200, ok: true }));

        await expect(client.post(POST_PATH, {})).rejects.toThrow();
      });

      it('should throw an error when response.json() fails on del', async () => {
        mockFetch.mockResolvedValue(buildBrokenJsonResponse({ status: 200, ok: true }));

        await expect(client.del(DEL_PATH)).rejects.toThrow();
      });

      it('should not dispatch AUTH_INIT_FAILURE when JSON parsing fails on a non-401 response', async () => {
        mockFetch.mockResolvedValue(buildBrokenJsonResponse({ status: 200, ok: true }));

        try {
          await client.get(TEST_PATH);
        } catch {
          // expected
        }

        expect(mockDispatch).not.toHaveBeenCalled();
      });

      it('should throw an error containing the HTTP status when status=500 and json() throws', async () => {
        mockFetch.mockResolvedValue(buildBrokenJsonResponse({ status: 500, ok: false }));

        const error = await client.get(TEST_PATH).catch((e) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('500');
      });
    });
  });

  // ── createApiClient API contract ─────────────────────────────────────────────

  describe('createApiClient', () => {
    it('should return an object with get, post, and del methods', () => {
      const apiClient = createApiClient({ baseURL: BASE_URL, dispatch: vi.fn() });

      expect(typeof apiClient.get).toBe('function');
      expect(typeof apiClient.post).toBe('function');
      expect(typeof apiClient.del).toBe('function');
    });

    it('should work with different baseURL values', async () => {
      const customURL = 'https://api.example.com';
      const customClient = createApiClient({ baseURL: customURL, dispatch: vi.fn() });
      mockFetch.mockResolvedValue(buildMockResponse());

      await customClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(`${customURL}/test`, expect.any(Object));
    });

    it('should use the provided dispatch function for 401 handling', async () => {
      const customDispatch = vi.fn();
      const customClient = createApiClient({ baseURL: BASE_URL, dispatch: customDispatch });
      mockFetch.mockResolvedValue(
        buildMockResponse({ status: 401, ok: false, body: { data: null, error: '请先登录' } })
      );

      try {
        await customClient.get(TEST_PATH);
      } catch {
        // expected
      }

      expect(customDispatch).toHaveBeenCalledWith({ type: 'AUTH_INIT_FAILURE' });
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});
