/**
 * TDD Test: apps/server/src/lib/auth.js
 *
 * Tests cover:
 * - Valid session: request.session.userId exists → calls done() to continue the flow
 * - Missing session: request.session is null/undefined → returns HTTP 401 with error body
 * - Missing userId: request.session.userId is null/undefined → returns HTTP 401 with error body
 */

import { requireAuth } from '../../src/lib/auth.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a mock Fastify reply object that records the status code and sent body.
 */
function buildMockReply() {
  const mock = {
    _statusCode: null,
    _body: null,
    code(statusCode) {
      mock._statusCode = statusCode;
      return mock; // enable chaining: reply.code(401).send(...)
    },
    send(body) {
      mock._body = body;
      return mock;
    },
  };
  return mock;
}

/**
 * Build a mock Fastify request with an optional session object.
 */
function buildMockRequest(session) {
  return { session };
}

/**
 * Create a simple spy function that records call count.
 * Replaces jest.fn() for ESM compatibility.
 */
function createSpy() {
  let callCount = 0;
  const spy = () => {
    callCount += 1;
  };
  spy.callCount = () => callCount;
  spy.wasCalled = () => callCount > 0;
  spy.wasNotCalled = () => callCount === 0;
  return spy;
}

// ── test suite ────────────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  describe('valid session', () => {
    it('should call done() when request.session.userId is present', () => {
      const request = buildMockRequest({ userId: 'user-001' });
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(done.callCount()).toBe(1);
      expect(reply._statusCode).toBeNull();
      expect(reply._body).toBeNull();
    });

    it('should not send any response when session is valid', () => {
      const request = buildMockRequest({ userId: 'abc-123' });
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(reply._statusCode).toBeNull();
      expect(reply._body).toBeNull();
    });
  });

  describe('missing session', () => {
    it('should return 401 when request.session is undefined', () => {
      const request = buildMockRequest(undefined);
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(done.wasNotCalled()).toBe(true);
      expect(reply._statusCode).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '请先登录',
        message: '未授权访问',
      });
    });

    it('should return 401 when request.session is null', () => {
      const request = buildMockRequest(null);
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(done.wasNotCalled()).toBe(true);
      expect(reply._statusCode).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '请先登录',
        message: '未授权访问',
      });
    });
  });

  describe('missing userId', () => {
    it('should return 401 when request.session.userId is undefined', () => {
      const request = buildMockRequest({ userId: undefined });
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(done.wasNotCalled()).toBe(true);
      expect(reply._statusCode).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '请先登录',
        message: '未授权访问',
      });
    });

    it('should return 401 when request.session.userId is null', () => {
      const request = buildMockRequest({ userId: null });
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(done.wasNotCalled()).toBe(true);
      expect(reply._statusCode).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '请先登录',
        message: '未授权访问',
      });
    });

    it('should return 401 when request.session exists but userId is an empty string', () => {
      const request = buildMockRequest({ userId: '' });
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(done.wasNotCalled()).toBe(true);
      expect(reply._statusCode).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '请先登录',
        message: '未授权访问',
      });
    });
  });

  describe('response body structure', () => {
    it('should include data: null in the 401 response', () => {
      const request = buildMockRequest(null);
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(reply._body.data).toBeNull();
    });

    it('should include error: "请先登录" in the 401 response', () => {
      const request = buildMockRequest(null);
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(reply._body.error).toBe('请先登录');
    });

    it('should include message: "未授权访问" in the 401 response', () => {
      const request = buildMockRequest(null);
      const reply = buildMockReply();
      const done = createSpy();

      requireAuth(request, reply, done);

      expect(reply._body.message).toBe('未授权访问');
    });
  });
});
