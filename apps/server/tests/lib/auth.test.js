import { describe, test, expect, jest } from '@jest/globals';
import { requireAuth } from '../../src/lib/auth.js';

/**
 * requireAuth 中间件单元测试
 *
 * 测试策略：
 *   - 通过伪造 Fastify request / reply 对象，隔离测试中间件逻辑
 *   - 不启动真实 Fastify 服务器，保证测试纯粹、快速
 *
 * 覆盖场景：
 *   1. session 不存在（undefined）→ 返回 401
 *   2. session 存在但 userId 为 undefined → 返回 401
 *   3. session 存在但 userId 为 null → 返回 401
 *   4. session 存在但 userId 为空字符串 → 返回 401
 *   5. session 存在且 userId 有效 → 调用 done()，不发送响应
 *   6. 401 响应体格式符合统一 API 格式规范
 */

/**
 * 创建模拟的 Fastify reply 对象
 * 支持链式调用：reply.code(401).send(body)
 */
function makeReply() {
  const reply = {
    _code: null,
    _body: null,
    code(statusCode) {
      this._code = statusCode;
      return this;
    },
    send(body) {
      this._body = body;
      return this;
    },
  };
  return reply;
}

/**
 * 创建模拟的 Fastify request 对象
 * @param {object|undefined} session - 模拟 request.session
 */
function makeRequest(session) {
  return { session };
}

describe('requireAuth 中间件', () => {
  describe('未授权场景 — 应返回 HTTP 401', () => {
    test('session 为 undefined 时，返回 401', () => {
      const request = makeRequest(undefined);
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._code).toBe(401);
      expect(done).not.toHaveBeenCalled();
    });

    test('session 为 null 时，返回 401', () => {
      const request = makeRequest(null);
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._code).toBe(401);
      expect(done).not.toHaveBeenCalled();
    });

    test('session 存在但 userId 为 undefined 时，返回 401', () => {
      const request = makeRequest({ userId: undefined });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._code).toBe(401);
      expect(done).not.toHaveBeenCalled();
    });

    test('session 存在但 userId 为 null 时，返回 401', () => {
      const request = makeRequest({ userId: null });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._code).toBe(401);
      expect(done).not.toHaveBeenCalled();
    });

    test('session 存在但 userId 为空字符串时，返回 401', () => {
      const request = makeRequest({ userId: '' });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._code).toBe(401);
      expect(done).not.toHaveBeenCalled();
    });

    test('session 为空对象（无 userId 字段）时，返回 401', () => {
      const request = makeRequest({});
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._code).toBe(401);
      expect(done).not.toHaveBeenCalled();
    });
  });

  describe('401 响应体格式验证', () => {
    test('响应体符合统一 API 格式规范', () => {
      const request = makeRequest(undefined);
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._body).toEqual({
        data: null,
        error: '请先登录',
        message: '未授权访问',
      });
    });

    test('data 字段必须为 null', () => {
      const request = makeRequest(null);
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._body.data).toBeNull();
    });

    test('error 字段必须为"请先登录"', () => {
      const request = makeRequest({ userId: null });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._body.error).toBe('请先登录');
    });

    test('message 字段必须为"未授权访问"', () => {
      const request = makeRequest({ userId: undefined });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._body.message).toBe('未授权访问');
    });
  });

  describe('已授权场景 — 应调用 done() 继续执行', () => {
    test('userId 为有效字符串（UUID）时，调用 done()', () => {
      const request = makeRequest({ userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(done).toHaveBeenCalledTimes(1);
      expect(reply._code).toBeNull();
      expect(reply._body).toBeNull();
    });

    test('userId 为有效字符串时，不发送任何响应', () => {
      const request = makeRequest({ userId: 'user-123' });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(reply._body).toBeNull();
    });

    test('session 包含额外字段时，只要 userId 存在即调用 done()', () => {
      const request = makeRequest({
        userId: 'user-abc',
        otherField: 'someValue',
        createdAt: Date.now(),
      });
      const reply = makeReply();
      const done = jest.fn();

      requireAuth(request, reply, done);

      expect(done).toHaveBeenCalledTimes(1);
      expect(reply._code).toBeNull();
    });
  });
});
