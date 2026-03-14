import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { requireAuth } from '../../src/lib/auth.js';

describe('requireAuth middleware', () => {
  let mockReply;

  beforeEach(() => {
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  test('calls done() when session.userId exists', () => {
    const mockRequest = {
      session: { userId: 'user-123' },
    };
    const done = jest.fn();

    requireAuth(mockRequest, mockReply, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });

  test('returns 401 when session is null', () => {
    const mockRequest = { session: null };
    const done = jest.fn();

    requireAuth(mockRequest, mockReply, done);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
    expect(done).not.toHaveBeenCalled();
  });

  test('returns 401 when session is undefined', () => {
    const mockRequest = {};
    const done = jest.fn();

    requireAuth(mockRequest, mockReply, done);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
    expect(done).not.toHaveBeenCalled();
  });

  test('returns 401 when session.userId is undefined', () => {
    const mockRequest = { session: {} };
    const done = jest.fn();

    requireAuth(mockRequest, mockReply, done);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
    expect(done).not.toHaveBeenCalled();
  });

  test('returns 401 when session.userId is null', () => {
    const mockRequest = { session: { userId: null } };
    const done = jest.fn();

    requireAuth(mockRequest, mockReply, done);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
    expect(done).not.toHaveBeenCalled();
  });

  test('returns 401 when session.userId is empty string', () => {
    const mockRequest = { session: { userId: '' } };
    const done = jest.fn();

    requireAuth(mockRequest, mockReply, done);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
    expect(done).not.toHaveBeenCalled();
  });

  test('response format matches API contract exactly', () => {
    const mockRequest = { session: null };
    const done = jest.fn();

    requireAuth(mockRequest, mockReply, done);

    const sentPayload = mockReply.send.mock.calls[0][0];
    expect(sentPayload).toHaveProperty('data', null);
    expect(sentPayload).toHaveProperty('error', '请先登录');
    expect(sentPayload).toHaveProperty('message', '未授权访问');
    expect(Object.keys(sentPayload)).toHaveLength(3);
  });
});
