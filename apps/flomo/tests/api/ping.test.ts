import { describe, it, expect } from 'vitest';
import { GET } from '../../app/api/ping/route';

describe('GET /api/ping', () => {
  it('should return 200 with pong message', async () => {
    const response = await GET();

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ message: 'pong' });
  });

  it('should return JSON content type', async () => {
    const response = await GET();

    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  it('should have exactly one property in response', async () => {
    const response = await GET();

    const data = await response.json();
    expect(Object.keys(data)).toHaveLength(1);
    expect(data).toHaveProperty('message');
  });

  it('should return string message value', async () => {
    const response = await GET();

    const data = await response.json();
    expect(typeof data.message).toBe('string');
    expect(data.message).toBe('pong');
  });

  it('should return consistent response on multiple calls', async () => {
    const response1 = await GET();
    const response2 = await GET();

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1).toEqual(data2);
  });
});
