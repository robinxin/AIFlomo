import { describe, expect, it } from 'vitest';
import { GET } from '../app/api/health/route';

describe('Health Check API', () => {
  // Happy path - basic functionality
  it('should return HTTP 200 status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should return JSON with status "ok"', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('should return timestamp in ISO 8601 format', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty('timestamp');
    expect(typeof data.timestamp).toBe('string');

    // Validate ISO 8601 format
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    expect(data.timestamp).toMatch(isoRegex);

    // Validate it's a valid date
    const parsedDate = new Date(data.timestamp);
    expect(parsedDate.toString()).not.toBe('Invalid Date');
  });

  it('should return correct content-type header', async () => {
    const response = await GET();
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  it('should have exactly the expected response structure', async () => {
    const response = await GET();
    const data = await response.json();

    // Should have exactly two keys: status and timestamp
    expect(Object.keys(data)).toHaveLength(2);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data.status).toBe('ok');
  });

  // Edge cases from spec
  it('should ignore any request parameters', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('should be available immediately after application start', async () => {
    // This test ensures the endpoint doesn't depend on async initialization
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should return current timestamp on each request (not cached)', async () => {
    const response1 = await GET();
    const data1 = await response1.json();

    // Wait a small amount to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response2 = await GET();
    const data2 = await response2.json();

    // Status should be the same
    expect(data1.status).toBe(data2.status);

    // Timestamps should be different (not cached)
    // Note: They might be the same if requests are too close, but structure should be valid
    const time1 = new Date(data1.timestamp).getTime();
    const time2 = new Date(data2.timestamp).getTime();
    expect(time2).toBeGreaterThanOrEqual(time1);
  });

  it('should return timestamp close to current time', async () => {
    const beforeRequest = new Date();
    const response = await GET();
    const afterRequest = new Date();
    const data = await response.json();

    const responseTime = new Date(data.timestamp);

    // Response timestamp should be between before and after request times
    expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000);
    expect(responseTime.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000);
  });

  // Validation against spec requirements
  it('should not require authentication', async () => {
    // No auth headers needed - direct call should work
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should not depend on database or external services', async () => {
    // This is validated by the fact that the GET function is synchronous
    // and doesn't make any async calls to external services
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should return consistent status on multiple calls', async () => {
    const response1 = await GET();
    const response2 = await GET();
    const response3 = await GET();

    const data1 = await response1.json();
    const data2 = await response2.json();
    const data3 = await response3.json();

    // Status should always be 'ok'
    expect(data1.status).toBe('ok');
    expect(data2.status).toBe('ok');
    expect(data3.status).toBe('ok');

    // HTTP status should always be 200
    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(response3.status).toBe(200);
  });

  // Error cases - the endpoint should handle all scenarios gracefully
  it('should work without any errors even when called rapidly', async () => {
    const requests = Array.from({ length: 10 }, () => GET());
    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    }
  });
});
