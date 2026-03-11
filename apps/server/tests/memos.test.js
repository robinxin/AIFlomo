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

describe('/api/memos', () => {
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

  describe('POST /api/memos — 创建笔记', () => {
    it('should create a memo with plain content and return 201', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '这是一条测试笔记' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('创建成功');
      expect(body.data).toHaveProperty('id');
      expect(body.data.content).toBe('这是一条测试笔记');
      expect(body.data.hasImage).toBe(0);
      expect(body.data.hasLink).toBe(0);
      expect(body.data.deletedAt).toBeNull();
      expect(body.data.tags).toEqual([]);
      expect(body.data.attachments).toEqual([]);
    });

    it('should auto-extract #tags from content', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '今日计划 #工作 #重要' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(2);
      const tagNames = body.data.tags.map((t) => t.name);
      expect(tagNames).toContain('工作');
      expect(tagNames).toContain('重要');
    });

    it('should deduplicate identical tags in content', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '#工作 做了很多 #工作 相关的事情' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(1);
      expect(body.data.tags[0].name).toBe('工作');
    });

    it('should reuse existing tags instead of creating duplicates', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '第一条笔记 #工作' },
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '第二条笔记 #工作' },
      });

      expect(response2.statusCode).toBe(201);
      const body2 = JSON.parse(response2.body);
      expect(body2.data.tags).toHaveLength(1);

      const allTags = db.select().from(tags).all();
      expect(allTags).toHaveLength(1);
    });

    it('should set hasImage=1 when image attachment is provided', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {
          content: '带图片的笔记',
          attachments: [{ type: 'image', url: 'https://example.com/image.jpg' }],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.hasImage).toBe(1);
      expect(body.data.attachments).toHaveLength(1);
      expect(body.data.attachments[0].type).toBe('image');
      expect(body.data.attachments[0].url).toBe('https://example.com/image.jpg');
    });

    it('should set hasLink=1 when link attachment is provided', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {
          content: '带链接的笔记',
          attachments: [{ type: 'link', url: 'https://example.com' }],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.hasLink).toBe(1);
    });

    it('should set hasLink=1 when content contains a URL', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '查看这个链接 https://example.com' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.hasLink).toBe(1);
    });

    it('should reject content exceeding 10000 characters with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: 'a'.repeat(10001) },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should reject empty content with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject missing content with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        payload: { content: '未认证的笔记' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should reject more than 10 tags with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const manyTags = Array.from({ length: 11 }, (_, i) => `#tag${i}`).join(' ');
      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: `测试内容 ${manyTags}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('TOO_MANY_TAGS');
    });

    it('should reject attachment URL without http/https protocol with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {
          content: '带附件的笔记',
          attachments: [{ type: 'image', url: 'ftp://example.com/img.jpg' }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create memo with content exactly 10000 characters', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: 'a'.repeat(10000) },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('GET /api/memos — 列表', () => {
    it('should return empty array when no memos exist', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.message).toBe('ok');
    });

    it('should return memos in descending order by createdAt', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '第一条笔记' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '第二条笔记' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '第三条笔记' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].content).toBe('第三条笔记');
      expect(body.data[2].content).toBe('第一条笔记');
    });

    it('should include tags and attachments in each memo', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {
          content: '带标签和附件 #工作',
          attachments: [{ type: 'image', url: 'https://example.com/img.jpg' }],
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const memo = body.data[0];
      expect(memo.tags).toHaveLength(1);
      expect(memo.tags[0].name).toBe('工作');
      expect(memo.attachments).toHaveLength(1);
    });

    it('should not return soft-deleted memos', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要被删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
    });

    it('should only return memos belonging to the authenticated user', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie: cookieA },
        payload: { content: '用户A的笔记' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie: cookieB },
        payload: { content: '用户B的笔记' },
      });

      const responseA = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie: cookieA },
      });

      const bodyA = JSON.parse(responseA.body);
      expect(bodyA.data).toHaveLength(1);
      expect(bodyA.data[0].content).toBe('用户A的笔记');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/memos',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should support pagination with page and limit params', async () => {
      const { cookie } = await registerAndLogin(app);

      for (let i = 1; i <= 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/memos',
          headers: { cookie },
          payload: { content: `笔记 ${i}` },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?page=1&limit=3',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/memos?page=2&limit=3',
        headers: { cookie },
      });

      const body2 = JSON.parse(response2.body);
      expect(body2.data).toHaveLength(2);
    });

  });

  describe('GET /api/memos?type= — 类型筛选', () => {
    it('should filter memos by type=tagged', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '有标签的笔记 #工作' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '没有标签的笔记' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?type=tagged',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].content).toBe('有标签的笔记 #工作');
    });

    it('should filter memos by type=untagged', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '有标签的笔记 #工作' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '没有标签的笔记' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?type=untagged',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].content).toBe('没有标签的笔记');
    });

    it('should filter memos by type=image', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {
          content: '带图片的笔记',
          attachments: [{ type: 'image', url: 'https://example.com/img.jpg' }],
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '普通笔记' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?type=image',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].content).toBe('带图片的笔记');
    });

    it('should filter memos by type=link', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {
          content: '带链接的笔记',
          attachments: [{ type: 'link', url: 'https://example.com' }],
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '普通笔记' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?type=link',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].content).toBe('带链接的笔记');
    });

    it('should reject invalid type value with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?type=invalid',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should filter memos by tagId', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '工作相关笔记 #工作' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '生活相关笔记 #生活' },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });
      const listBody = JSON.parse(listResponse.body);
      const workMemo = listBody.data.find((m) => m.content.includes('#工作'));
      const workTagId = workMemo.tags.find((t) => t.name === '工作').id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/memos?tagId=${workTagId}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].content).toContain('#工作');
    });

    it('should return empty array for tagId with no matching memos', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?tagId=nonexistent-tag-id',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });
  });

  describe('GET /api/memos?q= — 搜索', () => {
    it('should return memos matching search keyword', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '今天参加了会议，讨论了项目进度' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '去超市购物，买了蔬菜和水果' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].content).toContain('会议');
    });

    it('should return empty array when no memos match search keyword', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '普通笔记内容' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=不存在的关键词',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it('should support partial matching in search', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '参加了今天的团队会议记录' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
    });

    it('should not return soft-deleted memos in search results', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除的会议笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
    });

    it('should reject q parameter exceeding 200 characters with 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: `/api/memos?q=${'a'.repeat(201)}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle special SQL characters in search query safely', async () => {
      const { cookie } = await registerAndLogin(app);

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '包含特殊字符 % _ \\ 的笔记' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=%25',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
    });
  });

  describe('DELETE /api/memos/:id — 软删除', () => {
    it('should soft-delete a memo and return 200', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('笔记已移入回收站');
      expect(body.data).toBeNull();
    });

    it('should not appear in normal memo list after soft-delete', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
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

    it('should set deletedAt timestamp on soft-deleted memo', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const trashResponse = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      const trashBody = JSON.parse(trashResponse.body);
      expect(trashBody.data).toHaveLength(1);
      expect(trashBody.data[0].id).toBe(memoId);
      expect(trashBody.data[0].deletedAt).not.toBeNull();
    });

    it('should return 404 for non-existent memo', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memos/nonexistent-id',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when memo is already in trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('MEMO_IN_TRASH');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memos/some-id',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should not allow deleting another user memo', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie: cookieA },
        payload: { content: '用户A的私人笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie: cookieB },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/memos/trash — 回收站', () => {
    it('should return soft-deleted memos in trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('ok');
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(memoId);
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

      await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '正常笔记不在回收站' },
      });

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
    });

    it('should only show trash memos belonging to current user', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      const createResponseA = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie: cookieA },
        payload: { content: '用户A要删除的笔记' },
      });
      const memoIdA = JSON.parse(createResponseA.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoIdA}`,
        headers: { cookie: cookieA },
      });

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

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '带标签的笔记 #工作' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      const body = JSON.parse(response.body);
      expect(body.data[0].tags).toHaveLength(1);
      expect(body.data[0].tags[0].name).toBe('工作');
    });
  });

  describe('POST /api/memos/:id/restore — 恢复笔记', () => {
    it('should restore a soft-deleted memo', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除再恢复的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memoId}/restore`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('笔记已恢复');
      expect(body.data).toHaveProperty('id', memoId);
      expect(body.data.deletedAt).toBeNull();
    });

    it('should appear in normal list after restore', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '恢复后应出现在列表中' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      await app.inject({
        method: 'POST',
        url: `/api/memos/${memoId}/restore`,
        headers: { cookie },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].id).toBe(memoId);
    });

    it('should return 400 when memo is not in trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '正常笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memoId}/restore`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('MEMO_NOT_IN_TRASH');
    });

    it('should return 404 for non-existent memo restore', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos/nonexistent-id/restore',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memos/some-id/restore',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/memos/:id/permanent — 永久删除', () => {
    it('should permanently delete a memo from trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要永久删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}/permanent`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('笔记已永久删除');
      expect(body.data).toBeNull();
    });

    it('should not appear in trash after permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要永久删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}/permanent`,
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

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '正常笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}/permanent`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('MEMO_NOT_IN_TRASH');
    });

    it('should return 404 for non-existent memo permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memos/nonexistent-id/permanent',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memos/some-id/permanent',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should cascade-delete memo_tags on permanent delete', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '有标签的笔记 #工作' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}/permanent`,
        headers: { cookie },
      });

      const memoTagRows = db.select().from(memoTags).all();
      expect(memoTagRows).toHaveLength(0);
    });
  });

  describe('PUT /api/memos/:id — 更新笔记', () => {
    it('should update memo content successfully', async () => {
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
        payload: { content: '更新后的内容 #新标签' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('更新成功');
      expect(body.data.content).toBe('更新后的内容 #新标签');
      expect(body.data.tags).toHaveLength(1);
      expect(body.data.tags[0].name).toBe('新标签');
    });

    it('should return 404 when updating non-existent memo', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/memos/nonexistent-id',
        headers: { cookie },
        payload: { content: '更新内容' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 when updating a memo in trash', async () => {
      const { cookie } = await registerAndLogin(app);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '将要删除的笔记' },
      });
      const memoId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'DELETE',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/memos/${memoId}`,
        headers: { cookie },
        payload: { content: '尝试更新回收站笔记' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('MEMO_IN_TRASH');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/memos/some-id',
        payload: { content: '更新内容' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
