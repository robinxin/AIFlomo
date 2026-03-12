/**
 * 单元测试 — requireAuth 认证中间件
 *
 * 测试目标：apps/server/src/plugins/auth.js
 *
 * 测试场景：
 * 1. Session 有效 — 应注入 userId 到 request.user，放行请求
 * 2. Session 不存在 — 应返回 401 UNAUTHORIZED
 * 3. Session 已过期 — 应返回 401 UNAUTHORIZED
 * 4. Session ID 无效（非 UUID v4 格式）— 应返回 401 UNAUTHORIZED
 * 5. Session ID 为有效 UUID v4 格式但不在数据库中 — 应返回 401 UNAUTHORIZED
 * 6. Session 有效但用户已删除 — 应返回 401 UNAUTHORIZED
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Fastify from 'fastify';
import { db } from '../src/db/index.js';
import { sessions, users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import authPlugin from '../src/plugins/auth.js';
import sessionPlugin from '../src/plugins/session.js';

describe('requireAuth middleware', () => {
  let app;
  let testUser;
  let validSessionId;

  beforeEach(async () => {
    // 创建 Fastify 实例
    app = Fastify();

    // 注册 session 和 auth 插件
    await app.register(sessionPlugin);
    await app.register(authPlugin);

    // 注册测试路由（需要认证）
    // 读取 request.user（而非 request.session）
    app.get('/protected', {
      preHandler: [app.requireAuth],
      handler: async (request, reply) => {
        return {
          data: {
            userId: request.user.userId,
            sessionId: request.user.sessionId
          },
          message: 'ok'
        };
      }
    });

    // 创建测试用户
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
      nickname: '测试用户',
      passwordHash: 'fake-hash'
    }).returning();
    testUser = user;

    // 创建有效 Session（7 天后过期）
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const [session] = await db.insert(sessions).values({
      userId: testUser.id,
      expiresAt
    }).returning();
    validSessionId = session.id;
  });

  afterEach(async () => {
    // 清理测试数据
    await db.delete(sessions);
    await db.delete(users);
    await app.close();
  });

  it('应在 Session 有效时注入 userId 并放行请求', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: {
        sessionId: validSessionId
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.userId).toBe(testUser.id);
    expect(body.data.sessionId).toBe(validSessionId);
  });

  it('应在未提供 Cookie 时返回 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected'
      // 不传 Cookie
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.message).toBe('请先登录');
    expect(body.data).toBeNull();
  });

  it('应在 Session 已过期时返回 401', async () => {
    // 创建已过期 Session（1 小时前过期）
    const expiredAt = Date.now() - 60 * 60 * 1000;
    const [expiredSession] = await db.insert(sessions).values({
      userId: testUser.id,
      expiresAt: expiredAt
    }).returning();

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: {
        sessionId: expiredSession.id
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
    // 统一错误消息，避免时序侧信道泄露
    expect(body.message).toBe('请先登录');
  });

  it('应在 Session ID 为非 UUID v4 格式时返回 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: {
        sessionId: 'invalid-session-id-not-in-db'
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.message).toBe('请先登录');
  });

  it('应在 Session ID 为有效 UUID v4 但不存在于数据库时返回 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: {
        // 有效 UUID v4 格式，但不在 sessions 表中
        sessionId: crypto.randomUUID()
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.message).toBe('请先登录');
  });

  it('应在 Session 有效但用户已删除时返回 401', async () => {
    // 删除用户（Session 因级联删除会一起删除，所以先重建 Session）
    await db.delete(users).where(eq(users.id, testUser.id));

    // 手动创建孤立 Session（模拟级联删除失败场景）
    const orphanSessionId = crypto.randomUUID();
    await db.insert(sessions).values({
      id: orphanSessionId,
      userId: 'non-existent-user-id',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: {
        sessionId: orphanSessionId
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.message).toBe('请先登录');
  });
});
