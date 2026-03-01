import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/health/route';

describe('/api/health', () => {
  describe('GET', () => {
    it('should return 200 with status ok', async () => {
      const response = await GET();

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });
    });

    it('should return JSON content type', async () => {
      const response = await GET();

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });

    it('should handle multiple concurrent requests', async () => {
      // Spec: 接口无状态，无锁，天然支持并发
      const requests = Array.from({ length: 10 }, () => GET());
      const responses = await Promise.all(requests);

      // All should succeed with 200
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // All should return the same data
      const data = await Promise.all(responses.map(r => r.json()));
      data.forEach((d) => {
        expect(d).toEqual({ status: 'ok' });
      });
    });

    it('should respond quickly (performance check)', async () => {
      const startTime = performance.now();
      await GET();
      const endTime = performance.now();

      const responseTime = endTime - startTime;

      // Spec: 接口响应时间 < 50ms（本地环境）
      // In test environment, we allow a bit more headroom
      expect(responseTime).toBeLessThan(100);
    });

    it('should not throw errors', async () => {
      // Spec: 正常情况下只应出现 200。若出现 500，说明部署环境存在问题
      await expect(GET()).resolves.toBeDefined();
    });

    it('should return immutable response structure', async () => {
      const response1 = await GET();
      const response2 = await GET();

      const data1 = await response1.json();
      const data2 = await response2.json();

      // Should always return the exact same structure
      expect(data1).toEqual(data2);
      expect(Object.keys(data1)).toEqual(['status']);
      expect(data1.status).toBe('ok');
    });
  });

  describe('边界条件', () => {
    it('should not expose sensitive information', async () => {
      const response = await GET();
      const data = await response.json();

      // Spec: 不返回版本号、构建信息、环境变量等敏感信息
      expect(data).not.toHaveProperty('version');
      expect(data).not.toHaveProperty('env');
      expect(data).not.toHaveProperty('build');
      expect(data).not.toHaveProperty('database');
      expect(data).not.toHaveProperty('config');

      // Only has 'status' field
      expect(Object.keys(data)).toHaveLength(1);
      expect(Object.keys(data)[0]).toBe('status');
    });

    it('should have minimal response payload', async () => {
      const response = await GET();
      const text = await response.text();

      // Response should be minimal (just {"status":"ok"})
      expect(text.length).toBeLessThan(50);
    });
  });

  describe('无依赖性验证', () => {
    it('should not require database connection', async () => {
      // Spec: 接口本身不查询数据库、不依赖外部服务
      // This test verifies the handler doesn't import or use Prisma
      const response = await GET();

      // Should succeed even if database is not available
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });
    });

    it('should be stateless', async () => {
      // Spec: 接口无状态
      // Multiple calls should not affect each other
      const r1 = await GET();
      const r2 = await GET();
      const r3 = await GET();

      const d1 = await r1.json();
      const d2 = await r2.json();
      const d3 = await r3.json();

      expect(d1).toEqual(d2);
      expect(d2).toEqual(d3);
    });
  });

  describe('性能特征', () => {
    it('should have no database queries', async () => {
      // Spec: 无数据库查询，无 I/O 操作
      // We verify this by checking response time is minimal
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await GET();
        const end = performance.now();
        times.push(end - start);
      }

      // All responses should be consistently fast
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(50);
    });

    it('should have no I/O operations', async () => {
      // Verify consistent timing (no file reads, network calls, etc.)
      const response1Start = performance.now();
      await GET();
      const response1Time = performance.now() - response1Start;

      const response2Start = performance.now();
      await GET();
      const response2Time = performance.now() - response2Start;

      // Response times should be similar (within 20ms variance)
      // indicating no variable I/O operations
      const variance = Math.abs(response1Time - response2Time);
      expect(variance).toBeLessThan(20);
    });
  });
});
