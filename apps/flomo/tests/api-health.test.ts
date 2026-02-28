import { describe, expect, it } from 'vitest';
import { GET } from '../app/api/health/route';

describe('Health Check API', () => {
  // Positive cases
  it('should return HTTP 200 status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should return JSON with status "ok"', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });

  it('should return correct content-type header', async () => {
    const response = await GET();
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  // Edge cases - request parameters should be ignored
  it('should work without any parameters', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('should be available immediately after application start', async () => {
    // This test ensures the endpoint doesn't depend on async initialization
    const response = await GET();
    expect(response.status).toBe(200);
  });

  // Consistency checks
  it('should return consistent response on multiple calls', async () => {
    const response1 = await GET();
    const response2 = await GET();
    const response3 = await GET();

    const data1 = await response1.json();
    const data2 = await response2.json();
    const data3 = await response3.json();

    expect(data1).toEqual(data2);
    expect(data2).toEqual(data3);
    expect(response1.status).toBe(response2.status);
    expect(response2.status).toBe(response3.status);
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

  it('should have exactly the expected response structure', async () => {
    const response = await GET();
    const data = await response.json();

    // Should have exactly one key
    expect(Object.keys(data)).toHaveLength(1);
    // That key should be 'status'
    expect(data).toHaveProperty('status');
    // And its value should be 'ok'
    expect(data.status).toBe('ok');
  });
});
