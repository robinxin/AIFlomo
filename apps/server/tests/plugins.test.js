import Fastify from 'fastify';
import { buildLoggerConfig } from '../src/plugins/logger.js';
import { sessionPlugin } from '../src/plugins/session.js';
import { corsPlugin } from '../src/plugins/cors.js';
import { authRoutes } from '../src/routes/auth.js';
import { memoRoutes } from '../src/routes/memos.js';
import { db } from '../src/db/index.js';
import { users, sessions, memos, tags, memoTags, memoAttachments } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  const app = Fastify({ logger: buildLoggerConfig() });

  await app.register(corsPlugin);
  await app.register(sessionPlugin);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(memoRoutes, { prefix: '/api/memos' });

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
  db.delete(memoAttachments).run();
  db.delete(memoTags).run();
  db.delete(memos).run();
  db.delete(tags).run();
  db.delete(sessions).run();
  db.delete(users).run();
}

async function registerAndLogin(app, email = 'test@example.com', password = 'password123') {
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password },
  });
  const cookie = registerResponse.headers['set-cookie'];
  return { cookie, userId: JSON.parse(registerResponse.body).data.id };
}

describe('plugins/cors.js — CORS behavior', () => {
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

  it('should allow requests with no origin (non-browser clients)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(response.statusCode).toBe(401);
  });

  it('should allow requests from whitelisted origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { origin: 'http://localhost:8081' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8081');
  });

  it('should block requests from non-whitelisted origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { origin: 'http://evil.com' },
    });
    expect(response.statusCode).toBe(500);
  });

  it('should respond to OPTIONS preflight requests', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/me',
      headers: {
        origin: 'http://localhost:8081',
        'access-control-request-method': 'POST',
      },
    });
    expect(response.statusCode).toBe(204);
  });
});

describe('plugins/session.js — session store edge cases', () => {
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

  it('should return 401 after session is destroyed', async () => {
    const { cookie } = await registerAndLogin(app);

    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should handle expired session by returning 401', async () => {
    const { cookie } = await registerAndLogin(app);

    const allSessions = db.select().from(sessions).all();
    expect(allSessions.length).toBeGreaterThan(0);

    const pastDate = new Date(Date.now() - 1000).toISOString();
    db.update(sessions).set({ expired: pastDate }).run();

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should handle corrupted session JSON by returning 401', async () => {
    const { cookie } = await registerAndLogin(app);

    db.update(sessions).set({ sess: 'not-valid-json' }).run();

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reuse existing session record on subsequent requests', async () => {
    const { cookie } = await registerAndLogin(app);

    const response1 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    const response2 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(response1.statusCode).toBe(200);
    expect(response2.statusCode).toBe(200);

    const sessionCount = db.select().from(sessions).all().length;
    expect(sessionCount).toBe(1);
  });
});

describe('routes/memos.js — additional PUT update branches', () => {
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

  it('should reject PUT with invalid attachment URL', async () => {
    const { cookie } = await registerAndLogin(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '原始内容' },
    });
    const memoId = JSON.parse(createResponse.body).data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/memos/${memoId}`,
      headers: { cookie },
      payload: {
        content: '更新内容',
        attachments: [{ type: 'image', url: 'ftp://example.com/img.jpg' }],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('INVALID_ATTACHMENT_URL');
  });

  it('should reject PUT with more than 10 tags', async () => {
    const { cookie } = await registerAndLogin(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '原始内容' },
    });
    const memoId = JSON.parse(createResponse.body).data.id;

    const manyTags = Array.from({ length: 11 }, (_, i) => `#tag${i}`).join(' ');
    const response = await app.inject({
      method: 'PUT',
      url: `/api/memos/${memoId}`,
      headers: { cookie },
      payload: { content: `更新内容 ${manyTags}` },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('TOO_MANY_TAGS');
  });

  it('should update hasLink from content URL when no attachments provided', async () => {
    const { cookie } = await registerAndLogin(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '普通内容' },
    });
    const memoId = JSON.parse(createResponse.body).data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/memos/${memoId}`,
      headers: { cookie },
      payload: { content: '更新后包含链接 https://example.com' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.hasLink).toBe(1);
  });

  it('should update attachments when explicitly provided in PUT', async () => {
    const { cookie } = await registerAndLogin(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '原始内容' },
    });
    const memoId = JSON.parse(createResponse.body).data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/memos/${memoId}`,
      headers: { cookie },
      payload: {
        content: '更新内容',
        attachments: [{ type: 'image', url: 'https://example.com/new-img.jpg' }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.hasImage).toBe(1);
    expect(body.data.attachments).toHaveLength(1);
    expect(body.data.attachments[0].url).toBe('https://example.com/new-img.jpg');
  });

  it('should clear attachments when PUT provides empty attachments array', async () => {
    const { cookie } = await registerAndLogin(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: {
        content: '带附件的笔记',
        attachments: [{ type: 'image', url: 'https://example.com/img.jpg' }],
      },
    });
    const memoId = JSON.parse(createResponse.body).data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/memos/${memoId}`,
      headers: { cookie },
      payload: {
        content: '更新后无附件',
        attachments: [],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.hasImage).toBe(0);
    expect(body.data.attachments).toHaveLength(0);
  });

  it('should set hasLink=1 when PUT attachments include a link type', async () => {
    const { cookie } = await registerAndLogin(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '普通内容' },
    });
    const memoId = JSON.parse(createResponse.body).data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/memos/${memoId}`,
      headers: { cookie },
      payload: {
        content: '更新内容',
        attachments: [{ type: 'link', url: 'https://example.com' }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.hasLink).toBe(1);
  });
});

describe('routes — 404 not found handler', () => {
  let app;

  beforeAll(async () => {
    initDb();
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 404 with standard error format for unknown routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/unknown-endpoint',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('NOT_FOUND');
  });
});
