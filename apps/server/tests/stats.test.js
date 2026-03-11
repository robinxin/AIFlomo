import Fastify from 'fastify';
import { buildLoggerConfig } from '../src/plugins/logger.js';
import { sessionPlugin } from '../src/plugins/session.js';
import { corsPlugin } from '../src/plugins/cors.js';
import { authRoutes } from '../src/routes/auth.js';
import { memoRoutes } from '../src/routes/memos.js';
import { statsRoutes } from '../src/routes/stats.js';
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
  await app.register(statsRoutes, { prefix: '/api/stats' });

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

describe('/api/stats', () => {
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

  describe('GET /api/stats — 统计数据与热力图', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return zero stats for a new user with no memos', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('ok');
      expect(body.data).toHaveProperty('totalMemos', 0);
      expect(body.data).toHaveProperty('taggedMemos', 0);
      expect(body.data).toHaveProperty('activeDays', 0);
      expect(body.data).toHaveProperty('trashCount', 0);
      expect(body.data).toHaveProperty('heatmap');
      expect(body.data.heatmap).toEqual([]);
    });

    it('should return correct data shape with all required fields', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('totalMemos');
      expect(body.data).toHaveProperty('taggedMemos');
      expect(body.data).toHaveProperty('activeDays');
      expect(body.data).toHaveProperty('trashCount');
      expect(body.data).toHaveProperty('heatmap');
      expect(Array.isArray(body.data.heatmap)).toBe(true);
    });

    it('should count total memos correctly after creating memos', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '第一条笔记');
      await createMemo(app, cookie, '第二条笔记');
      await createMemo(app, cookie, '第三条笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.totalMemos).toBe(3);
    });

    it('should not count soft-deleted memos in totalMemos', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '正常笔记');
      const memo2 = await createMemo(app, cookie, '将被删除的笔记');

      await softDeleteMemo(app, cookie, memo2.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.totalMemos).toBe(1);
    });

    it('should count taggedMemos correctly for memos with tags', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '有标签的笔记 #工作');
      await createMemo(app, cookie, '另一个有标签的笔记 #生活');
      await createMemo(app, cookie, '没有标签的笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.taggedMemos).toBe(2);
    });

    it('should count memo with multiple tags as one in taggedMemos', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '多标签笔记 #工作 #重要 #会议');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.taggedMemos).toBe(1);
    });

    it('should not count soft-deleted tagged memos in taggedMemos', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '正常有标签 #工作');
      const memo2 = await createMemo(app, cookie, '将删除的有标签 #生活');

      await softDeleteMemo(app, cookie, memo2.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.taggedMemos).toBe(1);
    });

    it('should return taggedMemos as 0 when no memos have tags', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '无标签笔记一');
      await createMemo(app, cookie, '无标签笔记二');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.taggedMemos).toBe(0);
    });

    it('should count activeDays as the number of distinct days with memos', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '今天的笔记一');
      await createMemo(app, cookie, '今天的笔记二');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.activeDays).toBe(1);
    });

    it('should not count soft-deleted memo days in activeDays', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '将要删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.activeDays).toBe(0);
    });

    it('should count trashCount correctly after soft-deleting memos', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '将删除的笔记一');
      const memo2 = await createMemo(app, cookie, '将删除的笔记二');
      await createMemo(app, cookie, '正常笔记');

      await softDeleteMemo(app, cookie, memo1.id);
      await softDeleteMemo(app, cookie, memo2.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.trashCount).toBe(2);
    });

    it('should update trashCount to 0 after permanently deleting all trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '将删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.trashCount).toBe(0);
    });

    it('should decrease trashCount after restoring a memo from trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '将删除的笔记一');
      const memo2 = await createMemo(app, cookie, '将删除的笔记二');

      await softDeleteMemo(app, cookie, memo1.id);
      await softDeleteMemo(app, cookie, memo2.id);

      await app.inject({
        method: 'POST',
        url: `/api/memos/${memo1.id}/restore`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.trashCount).toBe(1);
    });

    it('should include today in heatmap when memos were created today', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '今天的第一条笔记');
      await createMemo(app, cookie, '今天的第二条笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const today = new Date().toISOString().slice(0, 10);
      const todayEntry = body.data.heatmap.find((entry) => entry.day === today);
      expect(todayEntry).toBeDefined();
      expect(todayEntry.count).toBe(2);
    });

    it('should not include soft-deleted memos in heatmap counts', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '正常笔记');
      const memo2 = await createMemo(app, cookie, '将删除的笔记');

      await softDeleteMemo(app, cookie, memo2.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const today = new Date().toISOString().slice(0, 10);
      const todayEntry = body.data.heatmap.find((entry) => entry.day === today);
      expect(todayEntry).toBeDefined();
      expect(todayEntry.count).toBe(1);
    });

    it('should return heatmap as empty array when all memos are soft-deleted', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '将删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.heatmap).toEqual([]);
    });

    it('should return heatmap entries with day and count fields', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '测试笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.heatmap.length).toBeGreaterThan(0);
      const entry = body.data.heatmap[0];
      expect(entry).toHaveProperty('day');
      expect(entry).toHaveProperty('count');
    });

    it('should return heatmap entries ordered by day ascending', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '笔记一');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const heatmap = body.data.heatmap;
      if (heatmap.length > 1) {
        for (let i = 1; i < heatmap.length; i++) {
          expect(heatmap[i].day >= heatmap[i - 1].day).toBe(true);
        }
      }
    });

    it('should only return stats for the authenticated user', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      await createMemo(app, cookieA, '用户A笔记一');
      await createMemo(app, cookieA, '用户A笔记二 #工作');
      await createMemo(app, cookieB, '用户B笔记一');

      const responseA = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie: cookieA },
      });

      expect(responseA.statusCode).toBe(200);
      const bodyA = JSON.parse(responseA.body);
      expect(bodyA.data.totalMemos).toBe(2);
      expect(bodyA.data.taggedMemos).toBe(1);
    });

    it('should not leak another user stats to current user', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      await createMemo(app, cookieA, '用户A的私密笔记 #秘密');
      await createMemo(app, cookieA, '用户A笔记二');

      const responseB = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie: cookieB },
      });

      expect(responseB.statusCode).toBe(200);
      const bodyB = JSON.parse(responseB.body);
      expect(bodyB.data.totalMemos).toBe(0);
      expect(bodyB.data.taggedMemos).toBe(0);
      expect(bodyB.data.activeDays).toBe(0);
      expect(bodyB.data.heatmap).toEqual([]);
    });

    it('should update totalMemos after restoring a memo from trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '将删除再恢复的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const statsAfterDelete = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      const bodyAfterDelete = JSON.parse(statsAfterDelete.body);
      expect(bodyAfterDelete.data.totalMemos).toBe(0);

      await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      const statsAfterRestore = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      const bodyAfterRestore = JSON.parse(statsAfterRestore.body);
      expect(bodyAfterRestore.data.totalMemos).toBe(1);
    });

    it('should correctly reflect stats after creating, deleting, and restoring a tagged memo', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo = await createMemo(app, cookie, '有标签的笔记 #工作');

      const statsAfterCreate = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });
      const bodyAfterCreate = JSON.parse(statsAfterCreate.body);
      expect(bodyAfterCreate.data.totalMemos).toBe(1);
      expect(bodyAfterCreate.data.taggedMemos).toBe(1);

      await softDeleteMemo(app, cookie, memo.id);

      const statsAfterDelete = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });
      const bodyAfterDelete = JSON.parse(statsAfterDelete.body);
      expect(bodyAfterDelete.data.totalMemos).toBe(0);
      expect(bodyAfterDelete.data.taggedMemos).toBe(0);
      expect(bodyAfterDelete.data.trashCount).toBe(1);

      await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      const statsAfterRestore = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });
      const bodyAfterRestore = JSON.parse(statsAfterRestore.body);
      expect(bodyAfterRestore.data.totalMemos).toBe(1);
      expect(bodyAfterRestore.data.taggedMemos).toBe(1);
      expect(bodyAfterRestore.data.trashCount).toBe(0);
    });

    it('should return totalMemos and taggedMemos as numbers not strings', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '带标签 #工作');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(typeof body.data.totalMemos).toBe('number');
      expect(typeof body.data.taggedMemos).toBe('number');
      expect(typeof body.data.activeDays).toBe('number');
      expect(typeof body.data.trashCount).toBe('number');
    });

    it('should return heatmap count as a number not a string', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '测试笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.heatmap.length).toBeGreaterThan(0);
      const entry = body.data.heatmap[0];
      expect(typeof entry.count).toBe('number');
    });
  });
});
