/**
 * Integration tests for /api/health endpoint
 *
 * These tests verify the endpoint behavior through HTTP requests.
 * Run these with the dev server running: npm run dev
 *
 * Note: These are currently skipped by default.
 * To run integration tests, start the server and use: npm run test:integration
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe.skip('/api/health - Integration Tests', () => {
  describe('HTTP GET', () => {
    it('should return 200 OK', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
    });

    it('should return correct JSON response', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();

      expect(data).toEqual({ status: 'ok' });
    });

    it('should return application/json content type', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const contentType = response.headers.get('content-type');

      expect(contentType).toContain('application/json');
    });

    it('should respond quickly (< 50ms)', async () => {
      const startTime = performance.now();
      await fetch(`${BASE_URL}/api/health`);
      const endTime = performance.now();

      const responseTime = endTime - startTime;

      // Spec: 接口响应时间 < 50ms（本地环境）
      expect(responseTime).toBeLessThan(50);
    });

    it('should ignore request body', async () => {
      // Spec: 接口收到请求体 - 忽略，不解析
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });
    });

    it('should not require authentication', async () => {
      // Spec: 接口无需鉴权，任何来源均可访问
      const response = await fetch(`${BASE_URL}/api/health`, {
        headers: {
          // No Authorization header
        },
      });

      expect(response.status).toBe(200);
    });

    it('should work without any headers', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });
    });
  });

  describe('HTTP Method Restrictions', () => {
    it('should reject POST requests with 405', async () => {
      // Spec: POST / PUT 等非 GET 方法 - Next.js 默认返回 405 Method Not Allowed
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'POST',
      });

      expect(response.status).toBe(405);
    });

    it('should reject PUT requests with 405', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'PUT',
      });

      expect(response.status).toBe(405);
    });

    it('should reject DELETE requests with 405', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(405);
    });

    it('should reject PATCH requests with 405', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'PATCH',
      });

      expect(response.status).toBe(405);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests correctly', async () => {
      // Spec: 并发大量请求 - 接口无状态，无锁，天然支持并发
      const concurrentRequests = 50;
      const requests = Array.from(
        { length: concurrentRequests },
        () => fetch(`${BASE_URL}/api/health`)
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // All should return the same data
      const dataPromises = responses.map((r) => r.json());
      const data = await Promise.all(dataPromises);

      data.forEach((d) => {
        expect(d).toEqual({ status: 'ok' });
      });
    });

    it('should maintain consistent response time under load', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fetch(`${BASE_URL}/api/health`);
        const end = performance.now();
        times.push(end - start);
      }

      // Calculate average response time
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      // Average should be well under 50ms
      expect(avgTime).toBeLessThan(50);

      // No outliers (no request should take more than 2x average)
      times.forEach((time) => {
        expect(time).toBeLessThan(avgTime * 2);
      });
    });
  });

  describe('Response Validation', () => {
    it('should not expose sensitive information', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();

      // Spec: 不返回版本号、构建信息、环境变量等敏感信息
      expect(data).not.toHaveProperty('version');
      expect(data).not.toHaveProperty('env');
      expect(data).not.toHaveProperty('environment');
      expect(data).not.toHaveProperty('build');
      expect(data).not.toHaveProperty('database');
      expect(data).not.toHaveProperty('config');
      expect(data).not.toHaveProperty('timestamp');
      expect(data).not.toHaveProperty('uptime');

      // Should only have status field
      expect(Object.keys(data)).toEqual(['status']);
    });

    it('should have minimal response size', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const text = await response.text();

      // Response should be minimal
      expect(text).toBe('{"status":"ok"}');
      expect(text.length).toBeLessThan(50);
    });
  });

  describe('CORS and Access', () => {
    it('should allow access from any origin', async () => {
      // Spec: 任何来源均可访问
      const response = await fetch(`${BASE_URL}/api/health`, {
        headers: {
          Origin: 'https://example.com',
        },
      });

      expect(response.status).toBe(200);
    });
  });
});
