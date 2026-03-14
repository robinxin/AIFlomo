import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../../lib/api-client.js';

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET requests', () => {
    test('get() makes a GET request with correct options', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: '1' }, message: 'ok' }),
      });

      const result = await apiClient.get('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
      expect(result).toEqual({ data: { id: '1' }, message: 'ok' });
    });

    test('get() throws error when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: '请先登录', message: '未授权' }),
      });

      await expect(apiClient.get('/api/auth/me')).rejects.toThrow('请先登录');
    });

    test('get() includes status in thrown error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not Found' }),
      });

      try {
        await apiClient.get('/api/nonexistent');
      } catch (error) {
        expect(error.status).toBe(404);
      }
    });
  });

  describe('POST requests', () => {
    test('post() makes a POST request with JSON body', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: '1' }, message: '成功' }),
      });

      const body = { email: 'test@example.com', password: 'pass1234' };
      await apiClient.post('/api/auth/login', body);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          credentials: 'include',
        })
      );
    });

    test('post() without body sends request without body', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null, message: '成功' }),
      });

      await apiClient.post('/api/auth/logout');

      const callOptions = global.fetch.mock.calls[0][1];
      expect(callOptions.body).toBeUndefined();
    });

    test('post() throws on server error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: '该邮箱已被注册', message: '注册失败' }),
      });

      await expect(
        apiClient.post('/api/auth/register', { email: 'test@example.com' })
      ).rejects.toThrow('该邮箱已被注册');
    });
  });

  describe('DELETE requests', () => {
    test('del() makes a DELETE request', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null, message: '删除成功' }),
      });

      await apiClient.del('/api/memos/1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/memos/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Network error handling', () => {
    test('throws network error when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network Error'));

      try {
        await apiClient.get('/api/test');
      } catch (error) {
        expect(error.message).toBe('网络连接失败，请稍后重试');
        expect(error.isNetworkError).toBe(true);
      }
    });
  });

  describe('Error response handling', () => {
    test('uses message as fallback when error field is missing', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: '服务器错误' }),
      });

      await expect(apiClient.get('/api/test')).rejects.toThrow('服务器错误');
    });

    test('handles JSON parse failure gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(apiClient.get('/api/test')).rejects.toThrow('请求失败');
    });
  });
});
