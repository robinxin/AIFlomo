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

async function permanentDeleteMemo(app, cookie, memoId) {
  return app.inject({
    method: 'DELETE',
    url: `/api/memos/${memoId}/permanent`,
    headers: { cookie },
  });
}

describe('边界场景测试', () => {
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

  describe('回收站清空边界场景', () => {
    it('清空回收站最后一条笔记后，回收站返回空数组', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '唯一在回收站的笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const trashBefore = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });
      expect(JSON.parse(trashBefore.body).data).toHaveLength(1);

      await permanentDeleteMemo(app, cookie, memo.id);

      const trashAfter = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      expect(trashAfter.statusCode).toBe(200);
      const body = JSON.parse(trashAfter.body);
      expect(body.data).toEqual([]);
      expect(body.message).toBe('ok');
    });

    it('清空回收站中多条笔记后，回收站为空', async () => {
      const { cookie } = await registerAndLogin(app);

      const memoIds = [];
      for (let i = 1; i <= 5; i++) {
        const memo = await createMemo(app, cookie, `回收站笔记 ${i}`);
        await softDeleteMemo(app, cookie, memo.id);
        memoIds.push(memo.id);
      }

      const trashBefore = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });
      expect(JSON.parse(trashBefore.body).data).toHaveLength(5);

      for (const memoId of memoIds) {
        await permanentDeleteMemo(app, cookie, memoId);
      }

      const trashAfter = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie },
      });

      expect(trashAfter.statusCode).toBe(200);
      expect(JSON.parse(trashAfter.body).data).toHaveLength(0);
    });

    it('清空回收站后正常笔记列表不受影响', async () => {
      const { cookie } = await registerAndLogin(app);

      const normalMemo = await createMemo(app, cookie, '正常笔记');
      const deletedMemo = await createMemo(app, cookie, '将被清空的笔记');
      await softDeleteMemo(app, cookie, deletedMemo.id);
      await permanentDeleteMemo(app, cookie, deletedMemo.id);

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/memos',
        headers: { cookie },
      });

      const body = JSON.parse(listResponse.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(normalMemo.id);
    });

    it('清空回收站后尝试再次永久删除同一条笔记，返回 404', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '将被永久删除的笔记');
      await softDeleteMemo(app, cookie, memo.id);
      await permanentDeleteMemo(app, cookie, memo.id);

      const response = await permanentDeleteMemo(app, cookie, memo.id);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('清空其他用户的回收站不影响当前用户的回收站', async () => {
      const { cookie: cookieA } = await registerAndLogin(app, 'usera@example.com', 'password123');
      const { cookie: cookieB } = await registerAndLogin(app, 'userb@example.com', 'password123');

      const memoA = await createMemo(app, cookieA, '用户A回收站笔记');
      await softDeleteMemo(app, cookieA, memoA.id);
      await permanentDeleteMemo(app, cookieA, memoA.id);

      const memoB = await createMemo(app, cookieB, '用户B回收站笔记');
      await softDeleteMemo(app, cookieB, memoB.id);

      const trashB = await app.inject({
        method: 'GET',
        url: '/api/memos/trash',
        headers: { cookie: cookieB },
      });

      expect(JSON.parse(trashB.body).data).toHaveLength(1);
      expect(JSON.parse(trashB.body).data[0].id).toBe(memoB.id);
    });

    it('回收站为空时，第一页返回空数组不报错', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?page=1&limit=20',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });
  });

  describe('搜索结果分页边界场景', () => {
    it('搜索结果分页：page=1,limit=2，返回前 2 条', async () => {
      const { cookie } = await registerAndLogin(app);

      for (let i = 1; i <= 5; i++) {
        await createMemo(app, cookie, `会议记录 ${i}`);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议&page=1&limit=2',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
    });

    it('搜索结果分页：page=2,limit=2，返回第 3、4 条', async () => {
      const { cookie } = await registerAndLogin(app);

      for (let i = 1; i <= 5; i++) {
        await createMemo(app, cookie, `会议记录 ${i}`);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议&page=2&limit=2',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
    });

    it('搜索结果分页：page 超出范围时返回空数组', async () => {
      const { cookie } = await registerAndLogin(app);

      for (let i = 1; i <= 3; i++) {
        await createMemo(app, cookie, `会议记录 ${i}`);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议&page=100&limit=10',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it('搜索结果分页：limit 最大值为 100，超过 100 返回 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议&limit=101',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('搜索结果分页：limit=100 为边界值，返回 200', async () => {
      const { cookie } = await registerAndLogin(app);

      for (let i = 1; i <= 5; i++) {
        await createMemo(app, cookie, `会议记录 ${i}`);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=会议&limit=100',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(5);
    });

    it('搜索结果分页：q 为 200 字符时是边界值，返回 200', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: `/api/memos?q=${'a'.repeat(200)}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
    });

    it('搜索结果分页：q 超过 200 字符时返回 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: `/api/memos?q=${'a'.repeat(201)}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('搜索无结果时分页返回空数组，不报错', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '普通笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=不存在的关键词&page=1&limit=10',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it('搜索分页：page=1 为最小有效页码，返回 200', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '测试笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=测试&page=1',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
    });

    it('搜索分页：page=0 低于最小值 1，返回 400', async () => {
      const { cookie } = await registerAndLogin(app);

      await createMemo(app, cookie, '测试笔记');

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos?q=测试&page=0',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('标签数量限制边界场景', () => {
    it('恰好 10 个不同标签时，创建成功', async () => {
      const { cookie } = await registerAndLogin(app);
      const tenTags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(' ');
      const content = `测试内容 ${tenTags}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(10);
    });

    it('11 个不同标签时，返回 400 TOO_MANY_TAGS', async () => {
      const { cookie } = await registerAndLogin(app);
      const elevenTags = Array.from({ length: 11 }, (_, i) => `#tag${i}`).join(' ');
      const content = `测试内容 ${elevenTags}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('TOO_MANY_TAGS');
    });

    it('重复标签去重后，不超出限制时成功创建', async () => {
      const { cookie } = await registerAndLogin(app);
      const content = '#tag0 #tag0 #tag1 #tag1 #tag2 #tag2 #tag3 #tag3 #tag4 #tag4 #tag5 #tag5';

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(6);
    });

    it('重复标签去重后恰好等于 10 个时，创建成功', async () => {
      const { cookie } = await registerAndLogin(app);
      const tags = Array.from({ length: 10 }, (_, i) => `#tag${i}`);
      const content = `${tags.join(' ')} ${tags.join(' ')}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(10);
    });

    it('9 个标签时，创建成功', async () => {
      const { cookie } = await registerAndLogin(app);
      const nineTags = Array.from({ length: 9 }, (_, i) => `#tag${i}`).join(' ');
      const content = `测试内容 ${nineTags}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(9);
    });

    it('没有标签时，创建成功，tags 为空数组', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '无标签笔记' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toEqual([]);
    });

    it('标签名超过 20 字符的部分被忽略，不影响限制计数', async () => {
      const { cookie } = await registerAndLogin(app);
      const longTag = '#' + 'a'.repeat(25);
      const content = `测试 ${longTag}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(1);
      expect(body.data.tags[0].name.length).toBe(20);
    });

    it('更新笔记时，超过 10 个标签返回 400 TOO_MANY_TAGS', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '原始内容 #初始标签');

      const elevenTags = Array.from({ length: 11 }, (_, i) => `#更新标签${i}`).join(' ');

      const response = await app.inject({
        method: 'PUT',
        url: `/api/memos/${memo.id}`,
        headers: { cookie },
        payload: { content: `更新后内容 ${elevenTags}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('TOO_MANY_TAGS');
    });

    it('更新笔记时，恰好 10 个标签，更新成功', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '原始内容');

      const tenTags = Array.from({ length: 10 }, (_, i) => `#更新标签${i}`).join(' ');

      const response = await app.inject({
        method: 'PUT',
        url: `/api/memos/${memo.id}`,
        headers: { cookie },
        payload: { content: `更新后内容 ${tenTags}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.tags).toHaveLength(10);
    });
  });

  describe('附件数量边界场景（图片大小由前端校验，后端校验附件数量）', () => {
    it('恰好 20 个附件时，创建成功', async () => {
      const { cookie } = await registerAndLogin(app);
      const attachments = Array.from({ length: 20 }, (_, i) => ({
        type: 'image',
        url: `https://example.com/image${i}.jpg`,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '20 个附件', attachments },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.attachments).toHaveLength(20);
    });

    it('超过 20 个附件时，返回 400', async () => {
      const { cookie } = await registerAndLogin(app);
      const attachments = Array.from({ length: 21 }, (_, i) => ({
        type: 'image',
        url: `https://example.com/image${i}.jpg`,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '21 个附件', attachments },
      });

      expect(response.statusCode).toBe(400);
    });

    it('0 个附件时，创建成功', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '无附件笔记', attachments: [] },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.attachments).toHaveLength(0);
    });

    it('图片附件 URL 必须使用 http/https 协议，否则返回 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: {
          content: '非法协议附件',
          attachments: [{ type: 'image', url: 'ftp://example.com/img.jpg' }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('混合 image 和 link 附件不超过 20 个时，创建成功', async () => {
      const { cookie } = await registerAndLogin(app);
      const attachments = [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'image',
          url: `https://example.com/image${i}.jpg`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'link',
          url: `https://example.com/link${i}`,
        })),
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/memos',
        headers: { cookie },
        payload: { content: '混合附件', attachments },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.hasImage).toBe(1);
      expect(body.data.hasLink).toBe(1);
      expect(body.data.attachments).toHaveLength(20);
    });
  });

  describe('回收站分页边界场景', () => {
    it('回收站分页：limit=1 仅返回 1 条', async () => {
      const { cookie } = await registerAndLogin(app);

      for (let i = 1; i <= 3; i++) {
        const memo = await createMemo(app, cookie, `回收站 ${i}`);
        await softDeleteMemo(app, cookie, memo.id);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?page=1&limit=1',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
    });

    it('回收站分页：limit=100 是边界值，返回 200', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '唯一笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?limit=100',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
    });

    it('回收站分页：limit=101 超过边界，返回 400', async () => {
      const { cookie } = await registerAndLogin(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?limit=101',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('回收站分页：page=2 无数据时返回空数组', async () => {
      const { cookie } = await registerAndLogin(app);
      const memo = await createMemo(app, cookie, '唯一笔记');
      await softDeleteMemo(app, cookie, memo.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memos/trash?page=2&limit=10',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });
  });
});
