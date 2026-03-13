/**
 * requireAuth 中间件单元测试（Jest）
 *
 * 覆盖范围：
 *   - 已登录用户（session.userId 存在）→ 通过，调用 done()
 *   - 未登录用户（session 无 userId）→ 返回 401
 *   - session 为 null / undefined → 返回 401
 *
 * 测试在 RED 阶段编写，实现代码尚未存在，预期全部失败。
 */

import { requireAuth } from '../../src/lib/auth.js';

// ---------------------------------------------------------------------------
// 辅助：构建 mock request / reply / done
// ---------------------------------------------------------------------------

function buildRequest(sessionData = {}) {
  return {
    session: sessionData,
  };
}

function buildReply() {
  const reply = {
    _statusCode: null,
    _body: null,
    code(statusCode) {
      this._statusCode = statusCode;
      return this;
    },
    send(body) {
      this._body = body;
      return this;
    },
  };
  return reply;
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

describe('requireAuth 中间件', () => {
  // -------------------------------------------------------------------------
  // 已登录用户 — 通过
  // -------------------------------------------------------------------------

  test('session.userId 存在 — 调用 done()，不发送任何响应', () => {
    const request = buildRequest({ userId: 'valid-user-uuid' });
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(reply._statusCode).toBeNull();
    expect(reply._body).toBeNull();
  });

  test('session.userId 为非空字符串 — 调用 done()', () => {
    const request = buildRequest({ userId: 'another-uuid-5678' });
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 未登录用户 — 返回 401
  // -------------------------------------------------------------------------

  test('session.userId 为 null — 返回 401，不调用 done()', () => {
    const request = buildRequest({ userId: null });
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).not.toHaveBeenCalled();
    expect(reply._statusCode).toBe(401);
    expect(reply._body).toMatchObject({
      data: null,
      error: '请先登录',
    });
  });

  test('session.userId 为 undefined — 返回 401', () => {
    const request = buildRequest({}); // userId 不存在
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).not.toHaveBeenCalled();
    expect(reply._statusCode).toBe(401);
    expect(reply._body.error).toBe('请先登录');
  });

  test('session.userId 为空字符串 — 返回 401', () => {
    const request = buildRequest({ userId: '' });
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).not.toHaveBeenCalled();
    expect(reply._statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // session 本身为 null / undefined
  // -------------------------------------------------------------------------

  test('session 为 null — 返回 401', () => {
    const request = { session: null };
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).not.toHaveBeenCalled();
    expect(reply._statusCode).toBe(401);
    expect(reply._body).toMatchObject({
      data: null,
      error: '请先登录',
    });
  });

  test('session 为 undefined — 返回 401', () => {
    const request = { session: undefined };
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).not.toHaveBeenCalled();
    expect(reply._statusCode).toBe(401);
  });

  test('request 无 session 属性 — 返回 401', () => {
    const request = {};
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(done).not.toHaveBeenCalled();
    expect(reply._statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 响应体格式校验
  // -------------------------------------------------------------------------

  test('401 响应体包含正确的 data、error、message 字段', () => {
    const request = buildRequest({ userId: null });
    const reply = buildReply();
    const done = jest.fn();

    requireAuth(request, reply, done);

    expect(reply._body).toEqual({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
  });
});
