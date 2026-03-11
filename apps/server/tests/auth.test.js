import Fastify from 'fastify';
import { buildLoggerConfig } from '../src/plugins/logger.js';
import { sessionPlugin } from '../src/plugins/session.js';
import { corsPlugin } from '../src/plugins/cors.js';
import { authRoutes } from '../src/routes/auth.js';
import { db } from '../src/db/index.js';
import { users, sessions } from '../src/db/schema.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  const app = Fastify({ logger: buildLoggerConfig() });

  await app.register(corsPlugin);
  await app.register(sessionPlugin);
  await app.register(authRoutes, { prefix: '/api/auth' });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      data: null,
      error: 'NOT_FOUND',
      message: '接口不存在',
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        data: null,
        error: 'VALIDATION_ERROR',
        message: '请求参数不合法',
      });
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        data: null,
        error: error.code ?? 'ERROR',
        message: error.message,
      });
    }

    return reply.status(500).send({
      data: null,
      error: 'INTERNAL_ERROR',
      message: error.message,
    });
  });

  await app.ready();
  return app;
}

function initDb() {
  const migrationSql = readFileSync(
    join(__dirname, '../src/db/migrations/0000_initial.sql'),
    'utf-8'
  );

  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    db.$client.exec(statement);
  }
}

function clearDb() {
  db.delete(sessions).run();
  db.delete(users).run();
}

describe('/api/auth', () => {
  let app;

  beforeAll(async () => {
    initDb();
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clearDb();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('注册成功');
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe('test@example.com');
      expect(body.data).not.toHaveProperty('passwordHash');
    });

    it('should derive nickname from email when nickname is not provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'john@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.nickname).toBe('john');
    });

    it('should use provided nickname when given', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          nickname: 'TestUser',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.nickname).toBe('TestUser');
    });

    it('should set session cookie after successful registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers['set-cookie']).toBeTruthy();
    });

    it('should reject duplicate email with 409', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password456' },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('EMAIL_TAKEN');
      expect(body.data).toBeNull();
    });

    it('should reject missing email with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { password: 'password123' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should reject missing password with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should reject empty payload with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject password shorter than 8 characters with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'short' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid email format with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'not-an-email', password: 'password123' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('登录成功');
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe('test@example.com');
    });

    it('should set session cookie on successful login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['set-cookie']).toBeTruthy();
    });

    it('should not return passwordHash in login response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).not.toHaveProperty('passwordHash');
    });

    it('should reject wrong password with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'wrongpassword' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_CREDENTIALS');
      expect(body.data).toBeNull();
    });

    it('should reject non-existent user with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nobody@example.com', password: 'password123' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should reject missing email with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: 'password123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject missing password with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully when authenticated', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });
      const cookie = loginResponse.headers['set-cookie'];

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('已登出');
      expect(body.data).toBeNull();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should invalidate session after logout so /me returns 401', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });
      const cookie = loginResponse.headers['set-cookie'];

      await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie },
      });

      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });

      expect(meResponse.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated via login', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });
      const cookie = loginResponse.headers['set-cookie'];

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.email).toBe('test@example.com');
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('nickname');
      expect(body.data).toHaveProperty('createdAt');
    });

    it('should use session established during registration', async () => {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });
      const cookie = registerResponse.headers['set-cookie'];

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.email).toBe('test@example.com');
    });

    it('should not expose passwordHash in /me response', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });
      const cookie = loginResponse.headers['set-cookie'];

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });
  });
});
