// apps/server/tests/auth-plugin.test.js
import Fastify from 'fastify';
import sessionPlugin from '../src/plugins/session.js';
import { requireAuth } from '../src/plugins/auth.js';

// A valid test secret that meets the 64-character minimum requirement.
const VALID_SECRET = 'a'.repeat(64);

describe('Auth Plugin - requireAuth preHandler', () => {
  let app;

  beforeEach(async () => {
    process.env.SESSION_SECRET = VALID_SECRET;
    app = Fastify();
    // Register the global error handler so UnauthorizedError is serialised
    // into the unified { data, error, message } format.
    app.setErrorHandler((error, request, reply) => {
      const statusCode = error.statusCode || 500;
      reply.status(statusCode).send({
        data: null,
        error: error.name || 'Error',
        message: error.message || 'Internal Server Error',
      });
    });
    await app.register(sessionPlugin);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.SESSION_SECRET;
  });

  it('should return 401 if session.userId is not set', async () => {
    app.get('/protected', { preHandler: [requireAuth] }, async () => {
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('UnauthorizedError');
    expect(body.message).toBe('Unauthorized');
  });

  it('should allow access if session.userId is set', async () => {
    app.get('/set-session', async (request) => {
      request.session.userId = 'user-123';
      return { ok: true };
    });

    app.get('/protected', { preHandler: [requireAuth] }, async (request) => {
      return { userId: request.session.userId };
    });

    const setResponse = await app.inject({
      method: 'GET',
      url: '/set-session',
    });

    const cookie = setResponse.headers['set-cookie'];

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        cookie,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: 'user-123' });
  });

  it('should return unified error format on 401', async () => {
    app.get('/protected', { preHandler: [requireAuth] }, async () => {
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('message');
    expect(body.data).toBeNull();
  });

  it('should handle multiple protected routes', async () => {
    app.get('/set-session', async (request) => {
      request.session.userId = 'user-456';
      return { ok: true };
    });

    app.get('/route1', { preHandler: [requireAuth] }, async (request) => {
      return { route: 'route1', userId: request.session.userId };
    });

    app.get('/route2', { preHandler: [requireAuth] }, async (request) => {
      return { route: 'route2', userId: request.session.userId };
    });

    const setResponse = await app.inject({
      method: 'GET',
      url: '/set-session',
    });

    const cookie = setResponse.headers['set-cookie'];

    const response1 = await app.inject({
      method: 'GET',
      url: '/route1',
      headers: { cookie },
    });

    expect(response1.statusCode).toBe(200);
    expect(response1.json()).toEqual({ route: 'route1', userId: 'user-456' });

    const response2 = await app.inject({
      method: 'GET',
      url: '/route2',
      headers: { cookie },
    });

    expect(response2.statusCode).toBe(200);
    expect(response2.json()).toEqual({ route: 'route2', userId: 'user-456' });
  });
});
