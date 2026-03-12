// apps/server/tests/cors-plugin.test.js
import Fastify from 'fastify';
import corsPlugin from '../src/plugins/cors.js';

describe('CORS Plugin', () => {
  let app;
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(async () => {
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
    process.env.CORS_ORIGIN = originalCorsOrigin;
  });

  it('should register CORS plugin successfully', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:8082';
    await app.register(corsPlugin);

    app.get('/test', async () => ({ ok: true }));

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: 'http://localhost:8082',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8082');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should allow multiple origins from whitelist', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:8082,https://example.com';
    await app.register(corsPlugin);

    app.get('/test', async () => ({ ok: true }));

    const response1 = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: 'http://localhost:8082',
      },
    });

    expect(response1.headers['access-control-allow-origin']).toBe('http://localhost:8082');

    const response2 = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: 'https://example.com',
      },
    });

    expect(response2.headers['access-control-allow-origin']).toBe('https://example.com');
  });

  it('should reject origins not in whitelist', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:8082';
    await app.register(corsPlugin);

    app.get('/test', async () => ({ ok: true }));

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: 'http://evil.com',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should throw error if CORS_ORIGIN is not set', async () => {
    delete process.env.CORS_ORIGIN;

    await expect(app.register(corsPlugin)).rejects.toThrow(
      'CORS_ORIGIN environment variable is required'
    );
  });
});
