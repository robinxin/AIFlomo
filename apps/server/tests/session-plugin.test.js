// apps/server/tests/session-plugin.test.js
import Fastify from 'fastify';
import sessionPlugin from '../src/plugins/session.js';

// A valid test secret that meets the 64-character minimum requirement.
const VALID_SECRET = 'a'.repeat(64);

describe('Session Plugin', () => {
  let app;

  beforeEach(async () => {
    process.env.SESSION_SECRET = VALID_SECRET;
    app = Fastify();
    await app.register(sessionPlugin);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.SESSION_SECRET;
  });

  it('should register session plugin successfully', async () => {
    expect(app.hasDecorator('session')).toBe(true);
  });

  it('should set session cookie with httpOnly and SameSite=Strict', async () => {
    app.get('/test', async (request) => {
      request.session.userId = 'test-user-id';
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('should set session cookie with maxAge', async () => {
    app.get('/test', async (request) => {
      request.session.userId = 'test-user-id';
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    // @fastify/session converts maxAge into an Expires directive in the
    // Set-Cookie header rather than a Max-Age directive.
    expect(setCookie).toMatch(/Expires=/);
  });

  it('should persist session data across requests', async () => {
    app.get('/set', async (request) => {
      request.session.userId = 'user-123';
      return { ok: true };
    });

    app.get('/get', async (request) => {
      return { userId: request.session.userId };
    });

    const setResponse = await app.inject({
      method: 'GET',
      url: '/set',
    });

    const cookie = setResponse.headers['set-cookie'];

    const getResponse = await app.inject({
      method: 'GET',
      url: '/get',
      headers: {
        cookie,
      },
    });

    expect(getResponse.json()).toEqual({ userId: 'user-123' });
  });

  it('should NOT set Secure flag in non-production environment', async () => {
    // In test/development the secure flag must be off so HTTP works correctly.
    // NODE_ENV is 'test' in this context (not 'production').
    app.get('/test', async (request) => {
      request.session.userId = 'test-user';
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    // The Secure attribute must NOT appear in non-production environments.
    expect(setCookie).not.toContain('Secure');
  });

  it('should fail to register if SESSION_SECRET is missing', async () => {
    delete process.env.SESSION_SECRET;
    const bareApp = Fastify();

    await expect(bareApp.register(sessionPlugin)).rejects.toThrow(
      /SESSION_SECRET/
    );

    await bareApp.close();
  });

  it('should fail to register if SESSION_SECRET is shorter than 64 characters', async () => {
    process.env.SESSION_SECRET = 'short-secret';
    const bareApp = Fastify();

    await expect(bareApp.register(sessionPlugin)).rejects.toThrow(
      /SESSION_SECRET/
    );

    await bareApp.close();
  });
});
