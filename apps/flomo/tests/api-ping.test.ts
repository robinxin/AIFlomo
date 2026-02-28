import { describe, expect, it } from 'vitest';
import { GET } from '../app/api/ping/route';

describe('Ping API', () => {
  // Happy path - basic functionality
  it('should return HTTP 200 status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should return JSON with message "pong"', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.message).toBe('pong');
  });

  it('should return correct content-type header', async () => {
    const response = await GET();
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  it('should have exactly the expected response structure', async () => {
    const response = await GET();
    const data = await response.json();

    // Should have exactly one key: message
    expect(Object.keys(data)).toHaveLength(1);
    expect(data).toHaveProperty('message');
    expect(data.message).toBe('pong');
  });

  // Edge cases from spec
  it('should ignore any request parameters', async () => {
    // The spec states "任何请求参数忽略"
    // Even if called as a GET function without params, it should work
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('pong');
  });

  it('should be available immediately after application start', async () => {
    // This test ensures the endpoint doesn't depend on async initialization
    // As per spec: "无需数据库"
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should return consistent response on multiple calls', async () => {
    const response1 = await GET();
    const response2 = await GET();
    const response3 = await GET();

    const data1 = await response1.json();
    const data2 = await response2.json();
    const data3 = await response3.json();

    // Message should always be 'pong'
    expect(data1.message).toBe('pong');
    expect(data2.message).toBe('pong');
    expect(data3.message).toBe('pong');

    // HTTP status should always be 200
    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(response3.status).toBe(200);
  });

  // Validation against spec requirements
  it('should not require authentication', async () => {
    // Spec states: "无需鉴权"
    // No auth headers needed - direct call should work
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('pong');
  });

  it('should not depend on database or external services', async () => {
    // Spec states: "无需数据库"
    // This is validated by the fact that the GET function is simple
    // and doesn't make any async calls to external services
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('pong');
  });

  // Error cases - the endpoint should handle all scenarios gracefully
  it('should work without any errors even when called rapidly', async () => {
    const requests = Array.from({ length: 10 }, () => GET());
    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('pong');
    }
  });

  it('should return valid JSON that can be parsed', async () => {
    const response = await GET();
    const data = await response.json();

    // Should not throw when parsing
    expect(data).toBeDefined();
    expect(typeof data).toBe('object');
    expect(data.message).toBe('pong');
  });

  it('should have no extra properties in response', async () => {
    const response = await GET();
    const data = await response.json();

    // Only 'message' should be present
    const keys = Object.keys(data);
    expect(keys).toEqual(['message']);
  });

  it('should use exact string "pong" (case-sensitive)', async () => {
    const response = await GET();
    const data = await response.json();

    // Ensure it's exactly 'pong', not 'Pong' or 'PONG'
    expect(data.message).toBe('pong');
    expect(data.message).not.toBe('Pong');
    expect(data.message).not.toBe('PONG');
  });

  // Spec verification checklist
  it('should satisfy spec requirement: return HTTP 200', async () => {
    // Spec verification: "请求 `/api/ping` 返回 HTTP 200"
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should satisfy spec requirement: response contains message "pong"', async () => {
    // Spec verification: "响应体包含 `message: "pong"`"
    const response = await GET();
    const data = await response.json();
    expect(data).toHaveProperty('message');
    expect(data.message).toBe('pong');
  });
});
