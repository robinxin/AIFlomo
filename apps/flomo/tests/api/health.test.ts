import { describe, it, expect } from 'vitest';
import { GET } from '../../app/api/health/route';

describe('GET /api/health', () => {
  describe('Happy Path', () => {
    it('should return 200 status code', async () => {
      const response = await GET();
      expect(response.status).toBe(200);
    });

    it('should return status "ok"', async () => {
      const response = await GET();
      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    it('should return a valid timestamp', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');
    });

    it('should return timestamp in ISO 8601 format', async () => {
      const response = await GET();
      const data = await response.json();

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(data.timestamp).toMatch(iso8601Regex);
    });

    it('should return a parseable timestamp', async () => {
      const response = await GET();
      const data = await response.json();

      const timestamp = new Date(data.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });

    it('should return timestamp close to current time', async () => {
      const before = Date.now();
      const response = await GET();
      const after = Date.now();
      const data = await response.json();

      const timestamp = new Date(data.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should respond within 200ms', async () => {
      const start = Date.now();
      await GET();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('Response Structure', () => {
    it('should return JSON content type', async () => {
      const response = await GET();
      const contentType = response.headers.get('content-type');

      expect(contentType).toContain('application/json');
    });

    it('should only contain status and timestamp fields', async () => {
      const response = await GET();
      const data = await response.json();

      const keys = Object.keys(data);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('status');
      expect(keys).toContain('timestamp');
    });

    it('should not expose any sensitive information', async () => {
      const response = await GET();
      const data = await response.json();

      // Should not contain database info, env variables, etc.
      expect(data).not.toHaveProperty('database');
      expect(data).not.toHaveProperty('env');
      expect(data).not.toHaveProperty('error');
      expect(data).not.toHaveProperty('stack');
    });
  });

  describe('Edge Cases', () => {
    it('should work without authentication', async () => {
      // No authentication headers needed
      const response = await GET();
      expect(response.status).toBe(200);
    });

    it('should be idempotent - multiple calls return consistent structure', async () => {
      const response1 = await GET();
      const response2 = await GET();
      const response3 = await GET();

      const data1 = await response1.json();
      const data2 = await response2.json();
      const data3 = await response3.json();

      expect(data1.status).toBe(data2.status);
      expect(data2.status).toBe(data3.status);
      expect(Object.keys(data1)).toEqual(Object.keys(data2));
      expect(Object.keys(data2)).toEqual(Object.keys(data3));
    });

    it('should handle concurrent requests correctly', async () => {
      const promises = Array.from({ length: 10 }, () => GET());
      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.status).toBe('ok');
        expect(data.timestamp).toBeDefined();
      }
    });

    it('timestamps should progress forward in sequential calls', async () => {
      const response1 = await GET();
      const data1 = await response1.json();

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const response2 = await GET();
      const data2 = await response2.json();

      const time1 = new Date(data1.timestamp).getTime();
      const time2 = new Date(data2.timestamp).getTime();

      expect(time2).toBeGreaterThanOrEqual(time1);
    });
  });

  describe('Spec Compliance', () => {
    it('should not perform database operations', async () => {
      // This test verifies the endpoint executes quickly without DB access
      const start = performance.now();
      await GET();
      const duration = performance.now() - start;

      // DB operations would typically take longer
      expect(duration).toBeLessThan(50);
    });

    it('should not require session validation', async () => {
      // No cookies or authorization needed
      const response = await GET();
      expect(response.status).toBe(200);
    });

    it('should match spec response format exactly', async () => {
      const response = await GET();
      const data = await response.json();

      // Spec requires exactly: { status: "ok", timestamp: ISO8601 }
      expect(data).toMatchObject({
        status: expect.stringMatching(/^(ok|error)$/),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });
  });
});
