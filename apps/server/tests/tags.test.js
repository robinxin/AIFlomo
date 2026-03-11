import Fastify from 'fastify';
import { buildLoggerConfig } from '../src/plugins/logger.js';
import { sessionPlugin } from '../src/plugins/session.js';
import { corsPlugin } from '../src/plugins/cors.js';
import { authRoutes } from '../src/routes/auth.js';
import { memoRoutes } from '../src/routes/memos.js';
import { tagRoutes } from '../src/routes/tags.js';
import { db } from '../src/db/index.js';
import { users, sessions, memos, tags, memoTags, memoAttachments } from '../src/db/schema.js';
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
  await app.register(tagRoutes, { prefix: '/api/tags' });

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

async function createMemo(app, cookie, content, attachments) {
  const payload = { content };
  if (attachments) payload.attachments = attachments;
  const response = await app.inject({
    method: 'POST',
    url: '/api/memos',
    headers: { cookie },
    payload,
  });
  return JSON.parse(response.body).data;
}

async function softDeleteMemo(app, cookie, memoId) {
  return app.inject({
    method: 'DELETE',
    url: `/api/memos/${memoId}`,
    headers: { cookie },
  });
}

describe('/api/tags', () => {
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

  describe('GET /api/tags — 标签列表及计数', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return empty array when user has no tags', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('ok');
      expect(body.data).toEqual([]);
    });

    it('should return tags after creating a memo with tags', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '工作相关笔记 #工作');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('工作');
    });

    it('should include id, name, createdAt, and memoCount fields in each tag', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '测试笔记 #测试');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const tag = body.data[0];
      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('name', '测试');
      expect(tag).toHaveProperty('createdAt');
      expect(tag).toHaveProperty('memoCount');
    });

    it('should return correct memoCount for a tag used in one memo', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '笔记一 #学习');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const tag = body.data.find((t) => t.name === '学习');
      expect(tag.memoCount).toBe(1);
    });

    it('should return correct memoCount when a tag is used in multiple memos', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '第一条工作笔记 #工作');
      await createMemo(app, cookie, '第二条工作笔记 #工作');
      await createMemo(app, cookie, '第三条工作笔记 #工作');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const tag = body.data.find((t) => t.name === '工作');
      expect(tag.memoCount).toBe(3);
    });

    it('should return multiple tags when memos have different tags', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '工作笔记 #工作');
      await createMemo(app, cookie, '生活笔记 #生活');
      await createMemo(app, cookie, '学习笔记 #学习');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);
    });

    it('should order tags alphabetically by name', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '笔记 #重要 #工作 #生活');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const names = body.data.map((t) => t.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should not count soft-deleted memos in memoCount', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '正常笔记 #工作');
      const memo2 = await createMemo(app, cookie, '将删除的笔记 #工作');

      await softDeleteMemo(app, cookie, memo2.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const tag = body.data.find((t) => t.name === '工作');
      expect(tag).toBeDefined();
      expect(tag.memoCount).toBe(1);
    });

    it('should return memoCount of 0 when all memos using a tag are soft-deleted', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '将删除的笔记 #工作');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const tag = body.data.find((t) => t.name === '工作');
      expect(tag).toBeDefined();
      expect(tag.memoCount).toBe(0);
    });

    it('should still list tag even when its memoCount is 0', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '将删除的笔记 #工作');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
    });

    it('should only return tags belonging to the authenticated user', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      await createMemo(app, cookieA, '用户A的笔记 #工作 #生活');
      await createMemo(app, cookieB, '用户B的笔记 #旅游');

      const responseA = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie: cookieA },
      });

      expect(responseA.statusCode).toBe(200);
      const bodyA = JSON.parse(responseA.body);
      expect(bodyA.data).toHaveLength(2);
      const tagNamesA = bodyA.data.map((t) => t.name);
      expect(tagNamesA).toContain('工作');
      expect(tagNamesA).toContain('生活');
      expect(tagNamesA).not.toContain('旅游');
    });

    it('should not leak another user tags to current user', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      await createMemo(app, cookieA, '用户A的笔记 #私密标签');

      const responseB = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie: cookieB },
      });

      expect(responseB.statusCode).toBe(200);
      const bodyB = JSON.parse(responseB.body);
      expect(bodyB.data).toHaveLength(0);
    });

    it('should count memos correctly when tag is shared across multiple memos with partial deletion', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '保留 #工作');
      const memo2 = await createMemo(app, cookie, '删除 #工作');
      const memo3 = await createMemo(app, cookie, '保留 #工作');

      await softDeleteMemo(app, cookie, memo2.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const tag = body.data.find((t) => t.name === '工作');
      expect(tag.memoCount).toBe(2);
    });

    it('should return correct counts for multiple tags on the same memo', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '多标签笔记 #工作 #重要 #会议');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);

      for (const tag of body.data) {
        expect(tag.memoCount).toBe(1);
      }
    });

    it('should not duplicate tags when the same tag is used in multiple memos', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '第一条 #工作');
      await createMemo(app, cookie, '第二条 #工作');

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const workTags = body.data.filter((t) => t.name === '工作');
      expect(workTags).toHaveLength(1);
      expect(workTags[0].memoCount).toBe(2);
    });

    it('should reflect updated counts after restoring a soft-deleted memo', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '将删除再恢复的笔记 #工作');
      await softDeleteMemo(app, cookie, memo.id);

      const responseAfterDelete = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      const bodyAfterDelete = JSON.parse(responseAfterDelete.body);
      const tagAfterDelete = bodyAfterDelete.data.find((t) => t.name === '工作');
      expect(tagAfterDelete.memoCount).toBe(0);

      await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      const responseAfterRestore = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { cookie },
      });

      const bodyAfterRestore = JSON.parse(responseAfterRestore.body);
      const tagAfterRestore = bodyAfterRestore.data.find((t) => t.name === '工作');
      expect(tagAfterRestore.memoCount).toBe(1);
    });
  });
});
