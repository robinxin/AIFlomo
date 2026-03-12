/**
 * @file 测试 Session 插件配置
 * @description 测试 @fastify/session 插件的 SQLite store 集成
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { dirname } from 'path';
import { createSQLiteStore, transformSessionCookie } from '../src/plugins/session.js';

const TEST_DB_PATH = './data/test-session.db';

// ---------------------------------------------------------------------------
// 辅助函数：构建最小可用的 Fastify 实例（注册 cookie + session 插件）
// ---------------------------------------------------------------------------
async function buildApp(envOverrides = {}) {
  const app = Fastify();
  await app.register(import('@fastify/cookie'));
  await app.register(import('../src/plugins/session.js'));
  return app;
}

describe('Session Plugin', () => {
  let app;

  beforeEach(async () => {
    // 创建测试数据库目录
    mkdirSync(dirname(TEST_DB_PATH), { recursive: true });

    // 设置测试环境变量（secret 必须 ≥ 32 字符）
    process.env.SESSION_SECRET = 'test-secret-key-for-session-plugin';
    process.env.DB_PATH = TEST_DB_PATH;

    app = Fastify();

    // 注册 cookie 插件（session 的依赖）
    await app.register(import('@fastify/cookie'));

    // 注册 session 插件
    await app.register(import('../src/plugins/session.js'));
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    // 清理测试数据库文件
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH, { force: true });
    }
  });

  // -------------------------------------------------------------------------
  // SESSION_SECRET 校验
  // -------------------------------------------------------------------------
  describe('SESSION_SECRET 校验', () => {
    it('SESSION_SECRET 缺失时应抛出错误', async () => {
      const original = process.env.SESSION_SECRET;
      delete process.env.SESSION_SECRET;

      const badApp = Fastify();
      await badApp.register(import('@fastify/cookie'));

      await expect(
        badApp.register(import('../src/plugins/session.js')),
      ).rejects.toThrow('SESSION_SECRET');

      process.env.SESSION_SECRET = original;
      try { await badApp.close(); } catch (_) { /* ignore */ }
    });

    it('SESSION_SECRET 长度不足 32 字符时应抛出错误', async () => {
      const original = process.env.SESSION_SECRET;
      process.env.SESSION_SECRET = 'short-secret';

      const badApp = Fastify();
      await badApp.register(import('@fastify/cookie'));

      await expect(
        badApp.register(import('../src/plugins/session.js')),
      ).rejects.toThrow('SESSION_SECRET');

      process.env.SESSION_SECRET = original;
      try { await badApp.close(); } catch (_) { /* ignore */ }
    });

    it('SESSION_SECRET 空字符串时应抛出错误', async () => {
      const original = process.env.SESSION_SECRET;
      process.env.SESSION_SECRET = '';

      const badApp = Fastify();
      await badApp.register(import('@fastify/cookie'));

      await expect(
        badApp.register(import('../src/plugins/session.js')),
      ).rejects.toThrow('SESSION_SECRET');

      process.env.SESSION_SECRET = original;
      try { await badApp.close(); } catch (_) { /* ignore */ }
    });

    it('SESSION_SECRET 恰好 32 字符时应成功注册', async () => {
      const original = process.env.SESSION_SECRET;
      process.env.SESSION_SECRET = 'a'.repeat(32);

      const goodApp = Fastify();
      await goodApp.register(import('@fastify/cookie'));
      await expect(
        goodApp.register(import('../src/plugins/session.js')),
      ).resolves.not.toThrow();

      process.env.SESSION_SECRET = original;
      await goodApp.close();
    });
  });

  // -------------------------------------------------------------------------
  // 插件注册
  // -------------------------------------------------------------------------
  describe('插件注册', () => {
    it('应成功注册 session 插件并在请求中注入 session 对象', async () => {
      app.get('/test-session', async (request, reply) => {
        return { hasSession: !!request.session };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test-session',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasSession).toBe(true);
    });

    it('应在响应头中设置 sessionId cookie', async () => {
      app.get('/test-cookie', async (request, reply) => {
        request.session.set('testKey', 'testValue');
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test-cookie',
      });

      expect(response.statusCode).toBe(200);
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('sessionId=');
    });
  });

  // -------------------------------------------------------------------------
  // Session 数据存储
  // -------------------------------------------------------------------------
  describe('Session 数据存储', () => {
    it('应能够设置和获取 session 数据', async () => {
      app.get('/set-session', async (request, reply) => {
        request.session.set('userId', '123');
        request.session.set('username', 'testuser');
        return { ok: true };
      });

      app.get('/get-session', async (request, reply) => {
        return {
          userId: request.session.get('userId'),
          username: request.session.get('username'),
        };
      });

      // 设置 session
      const setResponse = await app.inject({
        method: 'GET',
        url: '/set-session',
      });
      expect(setResponse.statusCode).toBe(200);

      // 提取 cookie
      const cookie = setResponse.headers['set-cookie'];
      expect(cookie).toBeDefined();

      // 使用 cookie 获取 session
      const getResponse = await app.inject({
        method: 'GET',
        url: '/get-session',
        headers: {
          cookie,
        },
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.userId).toBe('123');
      expect(body.username).toBe('testuser');
    });

    it('应支持 session 数据删除', async () => {
      app.get('/set-data', async (request, reply) => {
        request.session.set('tempData', 'should-be-deleted');
        return { ok: true };
      });

      app.get('/delete-data', async (request, reply) => {
        request.session.delete();
        return { ok: true };
      });

      app.get('/check-data', async (request, reply) => {
        return {
          tempData: request.session.get('tempData'),
        };
      });

      // 设置数据
      const setResponse = await app.inject({
        method: 'GET',
        url: '/set-data',
      });
      const cookie = setResponse.headers['set-cookie'];

      // 删除 session
      await app.inject({
        method: 'GET',
        url: '/delete-data',
        headers: { cookie },
      });

      // 检查数据已删除
      const checkResponse = await app.inject({
        method: 'GET',
        url: '/check-data',
        headers: { cookie },
      });

      const body = JSON.parse(checkResponse.body);
      expect(body.tempData).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Session 安全配置
  // -------------------------------------------------------------------------
  describe('Session 安全配置', () => {
    it('应设置 httpOnly cookie 属性', async () => {
      app.get('/test', async (request, reply) => {
        request.session.set('test', 'value');
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const cookie = response.headers['set-cookie'];
      expect(cookie).toContain('HttpOnly');
    });

    it('应设置 SameSite=Strict 属性', async () => {
      app.get('/test', async (request, reply) => {
        request.session.set('test', 'value');
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const cookie = response.headers['set-cookie'];
      expect(cookie).toContain('SameSite=Strict');
    });

    it('应在生产环境设置 Secure 属性', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // 重新创建 app 实例以应用生产环境配置
      await app.close();
      app = Fastify();
      await app.register(import('@fastify/cookie'));
      await app.register(import('../src/plugins/session.js'));

      app.get('/test', async (request, reply) => {
        request.session.set('test', 'value');
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const cookie = response.headers['set-cookie'];
      expect(cookie).toContain('Secure');

      process.env.NODE_ENV = originalEnv;
    });
  });

  // -------------------------------------------------------------------------
  // Session 过期时间
  // -------------------------------------------------------------------------
  describe('Session 过期时间', () => {
    it('应设置 7 天的过期时间', async () => {
      app.get('/test', async (request, reply) => {
        request.session.set('test', 'value');
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const cookie = response.headers['set-cookie'];
      expect(cookie).toBeDefined();

      // 检查 Max-Age 是否为 7 天（单位：秒）
      const maxAgeMatch = cookie.match(/Max-Age=(\d+)/);
      expect(maxAgeMatch).toBeTruthy();

      const maxAge = parseInt(maxAgeMatch[1], 10);
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      expect(maxAge).toBe(sevenDaysInSeconds);
    });
  });

  // -------------------------------------------------------------------------
  // Session Store 持久化
  // -------------------------------------------------------------------------
  describe('Session Store 持久化', () => {
    it('应将 session 数据持久化到 SQLite 数据库（验证 _fastify_sessions 表存在）', async () => {
      app.get('/set', async (request, reply) => {
        request.session.set('persistentData', 'should-persist');
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/set',
      });

      expect(response.statusCode).toBe(200);

      // Session store 复用 db/index.js 的共享连接（DB_PATH 在模块首次加载时确定）。
      // 通过直接查询共享数据库的 sqlite_master 来确认 _fastify_sessions 表已被创建。
      const { sqlite: sharedSqlite } = await import('../src/db/index.js');
      const tableRow = sharedSqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='_fastify_sessions'",
        )
        .get();
      expect(tableRow).toBeDefined();
      expect(tableRow.name).toBe('_fastify_sessions');
    });
  });

  // -------------------------------------------------------------------------
  // 非 sessionId cookie 处理
  // -------------------------------------------------------------------------
  describe('非 sessionId cookie 处理', () => {
    it('应忽略非 sessionId 的 cookie', async () => {
      app.get('/other-cookie', async (request, reply) => {
        reply.setCookie('otherCookie', 'value', {
          httpOnly: true,
          sameSite: 'strict',
        });
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/other-cookie',
      });

      const cookie = response.headers['set-cookie'];
      expect(cookie).toBeDefined();

      // otherCookie 不应包含 Max-Age（因为只有 sessionId 才添加）
      const otherCookieHeader = Array.isArray(cookie)
        ? cookie.find(c => c.includes('otherCookie'))
        : cookie;

      // 如果 otherCookie 存在，验证它没有被错误地添加 Max-Age
      if (otherCookieHeader && !otherCookieHeader.includes('sessionId')) {
        expect(otherCookieHeader).not.toContain('Max-Age=604800');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// createSQLiteStore 单元测试（直接操作 store 对象，不经过 Fastify）
// ---------------------------------------------------------------------------

describe('createSQLiteStore 单元测试', () => {
  const UNIT_DB_PATH = './data/test-store-unit.db';
  let db;
  let store;

  beforeEach(() => {
    mkdirSync(dirname(UNIT_DB_PATH), { recursive: true });
    db = new Database(UNIT_DB_PATH);
    store = createSQLiteStore(db);
  });

  afterEach(() => {
    db.close();
    if (existsSync(UNIT_DB_PATH)) {
      rmSync(UNIT_DB_PATH, { force: true });
    }
  });

  // -------------------------------------------------------------------------
  // set / get 基础操作
  // -------------------------------------------------------------------------
  describe('set / get', () => {
    it('set 后可通过 get 取回 session 数据', (done) => {
      const session = {
        cookie: { expires: new Date(Date.now() + 60_000) },
        userId: 42,
      };

      store.set('sid-1', session, (setErr) => {
        expect(setErr).toBeNull();

        store.get('sid-1', (getErr, data) => {
          expect(getErr).toBeNull();
          expect(data).not.toBeNull();
          expect(data.userId).toBe(42);
          done();
        });
      });
    });

    it('get 不存在的 sessionId 应返回 null', (done) => {
      store.get('nonexistent', (err, data) => {
        expect(err).toBeNull();
        expect(data).toBeNull();
        done();
      });
    });

    it('使用 originalMaxAge 计算过期时间', (done) => {
      const session = {
        cookie: { originalMaxAge: 60_000 },
        info: 'with-maxage',
      };

      store.set('sid-maxage', session, (err) => {
        expect(err).toBeNull();

        store.get('sid-maxage', (getErr, data) => {
          expect(getErr).toBeNull();
          expect(data.info).toBe('with-maxage');
          done();
        });
      });
    });

    it('cookie 没有 expires 也没有 originalMaxAge 时使用默认 7 天', (done) => {
      const session = { cookie: {}, fallback: true };

      store.set('sid-fallback', session, (err) => {
        expect(err).toBeNull();

        store.get('sid-fallback', (getErr, data) => {
          expect(getErr).toBeNull();
          expect(data.fallback).toBe(true);
          done();
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // 过期逻辑
  // -------------------------------------------------------------------------
  describe('过期 session 处理', () => {
    it('get 时应自动删除过期的 session 并返回 null', (done) => {
      // 直接插入一条已过期的记录
      const pastTime = Date.now() - 1_000;
      db.prepare(
        'INSERT INTO _fastify_sessions (id, data, expires_at) VALUES (?, ?, ?)',
      ).run('expired-id', JSON.stringify({ x: 1 }), pastTime);

      store.get('expired-id', (err, data) => {
        expect(err).toBeNull();
        expect(data).toBeNull();

        // 确认该行已被删除
        const row = db
          .prepare('SELECT id FROM _fastify_sessions WHERE id = ?')
          .get('expired-id');
        expect(row).toBeUndefined();
        done();
      });
    });

    it('set 时应清理所有其他已过期的 session', (done) => {
      // 插入一条已过期的记录
      const pastTime = Date.now() - 1_000;
      db.prepare(
        'INSERT INTO _fastify_sessions (id, data, expires_at) VALUES (?, ?, ?)',
      ).run('stale-id', JSON.stringify({ stale: true }), pastTime);

      const session = {
        cookie: { expires: new Date(Date.now() + 60_000) },
        fresh: true,
      };

      store.set('new-id', session, (err) => {
        expect(err).toBeNull();

        // 过期的 stale-id 应被清理
        const staleRow = db
          .prepare('SELECT id FROM _fastify_sessions WHERE id = ?')
          .get('stale-id');
        expect(staleRow).toBeUndefined();
        done();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 损坏数据防御性解析
  // -------------------------------------------------------------------------
  describe('损坏数据防御性解析', () => {
    it('data 列包含无效 JSON 时 get 应返回 null 并删除该行', (done) => {
      const futureTime = Date.now() + 60_000;
      db.prepare(
        'INSERT INTO _fastify_sessions (id, data, expires_at) VALUES (?, ?, ?)',
      ).run('corrupt-id', 'NOT_VALID_JSON{{{{', futureTime);

      store.get('corrupt-id', (err, data) => {
        expect(err).toBeNull();
        expect(data).toBeNull();

        // 该行应已被删除
        const row = db
          .prepare('SELECT id FROM _fastify_sessions WHERE id = ?')
          .get('corrupt-id');
        expect(row).toBeUndefined();
        done();
      });
    });
  });

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------
  describe('destroy', () => {
    it('destroy 应删除指定的 session', (done) => {
      const session = {
        cookie: { expires: new Date(Date.now() + 60_000) },
      };

      store.set('sid-to-destroy', session, (setErr) => {
        expect(setErr).toBeNull();

        store.destroy('sid-to-destroy', (destroyErr) => {
          expect(destroyErr).toBeNull();

          store.get('sid-to-destroy', (getErr, data) => {
            expect(getErr).toBeNull();
            expect(data).toBeNull();
            done();
          });
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // expires_at 索引
  // -------------------------------------------------------------------------
  describe('数据库索引', () => {
    it('应在 expires_at 列上创建索引', () => {
      const index = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_fastify_sessions_expires_at'",
        )
        .get();
      expect(index).toBeDefined();
      expect(index.name).toBe('idx_fastify_sessions_expires_at');
    });
  });
});

// ---------------------------------------------------------------------------
// transformSessionCookie 单元测试
// ---------------------------------------------------------------------------

describe('transformSessionCookie 单元测试', () => {
  it('非 sessionId cookie 原样返回', () => {
    const input = 'otherCookie=val; Path=/; HttpOnly';
    expect(transformSessionCookie(input, false)).toBe(input);
    expect(transformSessionCookie(input, true)).toBe(input);
  });

  it('已有 Max-Age 时不重复添加', () => {
    const input = 'sessionId=abc; Path=/; Max-Age=3600';
    const result = transformSessionCookie(input, false);
    // 只有一个 Max-Age
    expect((result.match(/Max-Age=/gi) || []).length).toBe(1);
  });

  it('无 Max-Age 时自动添加 604800', () => {
    const input = 'sessionId=abc; Path=/; HttpOnly';
    const result = transformSessionCookie(input, false);
    expect(result).toContain('Max-Age=604800');
  });

  it('addSecure=true 且无 Secure 属性时添加 Secure', () => {
    const input = 'sessionId=abc; Path=/';
    const result = transformSessionCookie(input, true);
    expect(result).toContain('Secure');
  });

  it('addSecure=false 时不添加 Secure', () => {
    const input = 'sessionId=abc; Path=/';
    const result = transformSessionCookie(input, false);
    expect(result).not.toContain('Secure');
  });

  it('已有 Secure 时不重复添加', () => {
    const input = 'sessionId=abc; Path=/; Secure';
    const result = transformSessionCookie(input, true);
    expect((result.match(/Secure/gi) || []).length).toBe(1);
  });
});
