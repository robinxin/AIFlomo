import Fastify from 'fastify';
import { buildLoggerConfig } from '../src/plugins/logger.js';
import { sessionPlugin } from '../src/plugins/session.js';
import { corsPlugin } from '../src/plugins/cors.js';
import { authRoutes } from '../src/routes/auth.js';
import { memoRoutes } from '../src/routes/memos.js';
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

describe('/api/memos/trash', () => {
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

  describe('GET /api/memos/trash — 回收站列表', () => {
    it('should return soft-deleted memos in trash', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '将要删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('ok');
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(memo.id);
    });

    it('should return empty array when trash is empty', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it('should not show normal memos in trash', async () => {
      const { cookie } = await registerAndLogin(app);
      await createMemo(app, cookie, '正常笔记不在回收站');

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should only show trash memos belonging to the current user', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      const memoA = await createMemo(app, cookieA, '用户A要删除的笔记');
      await softDeleteMemo(app, cookieA, memoA.id);

      const responseB = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie: cookieB },
      });

      const bodyB = JSON.parse(responseB.body);
      expect(bodyB.data).toHaveLength(0);
    });

    it('should include tags in trash memo details', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '带标签的笔记 #工作');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      const body = JSON.parse(response.body);
      expect(body.data[0].tags).toHaveLength(1);
      expect(body.data[0].tags[0].name).toBe('工作');
    });

    it('should include attachments in trash memo details', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '带附件的笔记', [
        { type: 'image', url: 'https://example.com/img.jpg' },
      ]);
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      const body = JSON.parse(response.body);
      expect(body.data[0].attachments).toHaveLength(1);
      expect(body.data[0].attachments[0].type).toBe('image');
    });

    it('should have non-null deletedAt on trash memos', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '待删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      const body = JSON.parse(response.body);
      expect(body.data[0].deletedAt).not.toBeNull();
    });

    it('should support pagination with page and limit params', async () => {
      const { cookie } = await registerAndLogin(app);

      for (let i = 1; i <= 5; i++) {
        const memo = await createMemo(app, cookie, `笔记 ${i}`);
        await softDeleteMemo(app, cookie, memo.id);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?page=1&limit=3',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?page=2&limit=3',
        headers: { cookie },
      });

      const body2 = JSON.parse(response2.body);
      expect(body2.data).toHaveLength(2);
    });

    it('should reject invalid pagination params with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?limit=200',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return multiple deleted memos in descending deletedAt order', async () => {
      const { cookie } = await registerAndLogin(app);

      const memo1 = await createMemo(app, cookie, '第一条删除的笔记');
      await softDeleteMemo(app, cookie, memo1.id);

      const memo2 = await createMemo(app, cookie, '第二条删除的笔记');
      await softDeleteMemo(app, cookie, memo2.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(new Date(body.data[0].deletedAt) >= new Date(body.data[1].deletedAt)).toBe(true);
    });
  });

  describe('POST /api/memos/:id/restore — 恢复笔记', () => {
    it('should restore a soft-deleted memo and return 200', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '将要删除再恢复的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('笔记已恢复');
      expect(body.data).toHaveProperty('id', memo.id);
      expect(body.data.deletedAt).toBeNull();
    });

    it('should appear in normal memo list after restore', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '恢复后应出现在列表中');
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].id).toBe(memo.id);
    });

    it('should disappear from trash after restore', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '恢复后应从回收站消失');
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      const trashResponse = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      const trashBody = JSON.parse(trashResponse.body);
      expect(trashBody.data).toHaveLength(0);
    });

    it('should return 400 when memo is not in trash', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '正常笔记');

      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('MEMO_NOT_IN_TRASH');
      expect(body.data).toBeNull();
    });

    it('should return 404 for non-existent memo restore', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos/nonexistent-id/restore',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memos/some-id/restore',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should not allow restoring another user memo', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      const memoA = await createMemo(app, cookieA, '用户A的笔记');
      await softDeleteMemo(app, cookieA, memoA.id);

      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memoA.id}/restore`,
        headers: { cookie: cookieB },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should preserve tags on restored memo', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '带标签的恢复笔记 #工作 #重要');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(2);
      const tagNames = body.data.tags.map((t) => t.name);
      expect(tagNames).toContain('工作');
      expect(tagNames).toContain('重要');
    });

    it('should preserve attachments on restored memo', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '带附件的恢复笔记', [
        { type: 'image', url: 'https://example.com/img.jpg' },
      ]);
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/restore`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.attachments).toHaveLength(1);
      expect(body.data.attachments[0].type).toBe('image');
    });
  });

  describe('DELETE /api/memos/:id/permanent — 永久删除', () => {
    it('should permanently delete a memo from trash and return 200', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '将要永久删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('笔记已永久删除');
      expect(body.data).toBeNull();
    });

    it('should not appear in trash after permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '将要永久删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      const trashResponse = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      const trashBody = JSON.parse(trashResponse.body);
      expect(trashBody.data).toHaveLength(0);
    });

    it('should not appear in normal memo list after permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '将要永久删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(0);
    });

    it('should return 400 when memo is not in trash', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '正常笔记');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('MEMO_NOT_IN_TRASH');
      expect(body.data).toBeNull();
    });

    it('should return 404 for non-existent memo permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memos/nonexistent-id/permanent',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memos/some-id/permanent',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should not allow permanent deleting another user memo', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      const memoA = await createMemo(app, cookieA, '用户A的笔记');
      await softDeleteMemo(app, cookieA, memoA.id);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoA.id}/permanent`,
        headers: { cookie: cookieB },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should cascade-delete memo_tags on permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '有标签的笔记 #工作');
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      const memoTagRows = db.select().from(memoTags).all();
      expect(memoTagRows).toHaveLength(0);
    });

    it('should cascade-delete memo_attachments on permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '有附件的笔记', [
        { type: 'image', url: 'https://example.com/img.jpg' },
      ]);
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      const attachmentRows = db.select().from(memoAttachments).all();
      expect(attachmentRows).toHaveLength(0);
    });

    it('should not delete the tag record itself when memo is permanently deleted', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '有标签的笔记 #工作');
      await softDeleteMemo(app, cookie, memo.id);

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      const tagRows = db.select().from(tags).all();
      expect(tagRows).toHaveLength(1);
      expect(tagRows[0].name).toBe('工作');
    });

    it('should still allow deleting memo permanently after failed restore attempt', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '将被永久删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memo.id}/permanent`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
