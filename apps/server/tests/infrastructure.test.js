/**
 * T003 - 后端共享基础设施测试
 *
 * TDD 红阶段：先写测试，再写实现
 *
 * 测试范围：
 * 1. errors.js — AppError、NotFoundError、ForbiddenError 错误类
 * 2. plugins/session.js — Session 插件注册与安全配置
 * 3. plugins/cors.js — CORS 插件注册与白名单配置
 * 4. plugins/auth.js — requireAuth preHandler（未授权返回 401）
 *
 * 安全场景覆盖：
 * - XSS 防护（错误消息不注入 HTML）
 * - 未授权访问（requireAuth 返回 401 统一格式）
 * - 输入边界（空值、特殊字符、超长字符串）
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// errors.js 测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - AppError 基类', () => {
  let AppError;

  beforeEach(async () => {
    const errorsModule = await import(`${serverRoot}/src/lib/errors.js`);
    AppError = errorsModule.AppError;
  });

  it('应该导出 AppError 类', () => {
    expect(AppError).toBeDefined();
    expect(typeof AppError).toBe('function');
  });

  it('AppError 应该继承自 Error', () => {
    const err = new AppError('test message', 500, 'INTERNAL_ERROR');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('AppError 应该包含 message、statusCode、code 三个属性', () => {
    const err = new AppError('test message', 500, 'INTERNAL_ERROR');
    expect(err.message).toBe('test message');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  it('AppError.name 应该为 "AppError"', () => {
    const err = new AppError('test', 500, 'INTERNAL_ERROR');
    expect(err.name).toBe('AppError');
  });

  it('AppError 应该有 stack trace', () => {
    const err = new AppError('test', 500, 'INTERNAL_ERROR');
    expect(err.stack).toBeDefined();
  });

  it('AppError 默认 statusCode 为 500', () => {
    const err = new AppError('server error');
    expect(err.statusCode).toBe(500);
  });

  it('AppError 默认 code 为 INTERNAL_ERROR', () => {
    const err = new AppError('server error');
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  it('XSS 防护：message 中包含 HTML 标签应原样保存，不执行', () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const err = new AppError(xssPayload, 400, 'VALIDATION_ERROR');
    expect(err.message).toBe(xssPayload);
  });

  it('边界：空字符串 message 应能正常创建', () => {
    const err = new AppError('', 400, 'VALIDATION_ERROR');
    expect(err.message).toBe('');
  });

  it('边界：超长 message 应能正常创建', () => {
    const longMessage = 'A'.repeat(10000);
    const err = new AppError(longMessage, 500, 'INTERNAL_ERROR');
    expect(err.message).toHaveLength(10000);
  });

  it('边界：特殊字符 message 应能正常创建', () => {
    const specialMessage = "It's a \"test\" \\with/ special chars 中文";
    const err = new AppError(specialMessage, 400, 'VALIDATION_ERROR');
    expect(err.message).toBe(specialMessage);
  });
});

describe('T003 - NotFoundError', () => {
  let NotFoundError;
  let AppError;

  beforeEach(async () => {
    const errorsModule = await import(`${serverRoot}/src/lib/errors.js`);
    NotFoundError = errorsModule.NotFoundError;
    AppError = errorsModule.AppError;
  });

  it('应该导出 NotFoundError 类', () => {
    expect(NotFoundError).toBeDefined();
    expect(typeof NotFoundError).toBe('function');
  });

  it('NotFoundError 应该继承自 AppError', () => {
    const err = new NotFoundError('Memo');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('NotFoundError 应该继承自 Error', () => {
    const err = new NotFoundError('Memo');
    expect(err).toBeInstanceOf(Error);
  });

  it('NotFoundError.statusCode 应该为 404', () => {
    const err = new NotFoundError('Memo');
    expect(err.statusCode).toBe(404);
  });

  it('NotFoundError.code 应该为 "NOT_FOUND"', () => {
    const err = new NotFoundError('Memo');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('NotFoundError("Memo") 的 message 应包含 "Memo"', () => {
    const err = new NotFoundError('Memo');
    expect(err.message).toContain('Memo');
  });

  it('NotFoundError("Tag") 的 message 应包含 "Tag"', () => {
    const err = new NotFoundError('Tag');
    expect(err.message).toContain('Tag');
  });

  it('NotFoundError.name 应该为 "NotFoundError"', () => {
    const err = new NotFoundError('Memo');
    expect(err.name).toBe('NotFoundError');
  });

  it('边界：不传资源名时应能正常创建', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('边界：特殊字符资源名应能正常处理', () => {
    const err = new NotFoundError('<script>Memo</script>');
    expect(err.message).toContain('<script>Memo</script>');
    expect(err.statusCode).toBe(404);
  });
});

describe('T003 - ForbiddenError', () => {
  let ForbiddenError;
  let AppError;

  beforeEach(async () => {
    const errorsModule = await import(`${serverRoot}/src/lib/errors.js`);
    ForbiddenError = errorsModule.ForbiddenError;
    AppError = errorsModule.AppError;
  });

  it('应该导出 ForbiddenError 类', () => {
    expect(ForbiddenError).toBeDefined();
    expect(typeof ForbiddenError).toBe('function');
  });

  it('ForbiddenError 应该继承自 AppError', () => {
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it('ForbiddenError 应该继承自 Error', () => {
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(Error);
  });

  it('ForbiddenError.statusCode 应该为 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it('ForbiddenError.code 应该为 "FORBIDDEN"', () => {
    const err = new ForbiddenError();
    expect(err.code).toBe('FORBIDDEN');
  });

  it('ForbiddenError.name 应该为 "ForbiddenError"', () => {
    const err = new ForbiddenError();
    expect(err.name).toBe('ForbiddenError');
  });

  it('ForbiddenError 有默认 message', () => {
    const err = new ForbiddenError();
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('ForbiddenError 可以接受自定义 message', () => {
    const err = new ForbiddenError('Custom forbidden message');
    expect(err.message).toBe('Custom forbidden message');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// plugins/auth.js — requireAuth preHandler 单元测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - requireAuth preHandler', () => {
  let requireAuth;

  beforeEach(async () => {
    const authModule = await import(`${serverRoot}/src/plugins/auth.js`);
    requireAuth = authModule.requireAuth;
  });

  it('应该导出 requireAuth 函数', () => {
    expect(requireAuth).toBeDefined();
    expect(typeof requireAuth).toBe('function');
  });

  it('session.userId 存在时应放行（不调用 reply.send）', async () => {
    const mockRequest = { session: { userId: 'user-123' } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Fastify 5 async preHandler 不接受 done 参数，放行时直接返回
    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });

  it('session 为空时应返回 401', async () => {
    const mockRequest = { session: {} };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalled();
  });

  it('session.userId 为 null 时应返回 401', async () => {
    const mockRequest = { session: { userId: null } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalled();
  });

  it('session.userId 为 undefined 时应返回 401', async () => {
    const mockRequest = { session: { userId: undefined } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalled();
  });

  it('session 本身为 null 时应返回 401', async () => {
    const mockRequest = { session: null };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalled();
  });

  it('session 本身为 undefined 时应返回 401', async () => {
    const mockRequest = { session: undefined };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalled();
  });

  it('未授权响应体应符合统一错误格式 { data: null, error: string, message: string }', async () => {
    const mockRequest = { session: {} };
    let sentBody;
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn((body) => {
        sentBody = body;
        return mockReply;
      }),
    };

    await requireAuth(mockRequest, mockReply);

    expect(sentBody).toBeDefined();
    expect(sentBody.data).toBeNull();
    expect(typeof sentBody.error).toBe('string');
    expect(typeof sentBody.message).toBe('string');
  });

  it('未授权时 error 字段应为 "Unauthorized"', async () => {
    const mockRequest = { session: {} };
    let sentBody;
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn((body) => {
        sentBody = body;
        return mockReply;
      }),
    };

    await requireAuth(mockRequest, mockReply);

    expect(sentBody.error).toBe('Unauthorized');
  });

  it('session.userId 为空字符串时应返回 401', async () => {
    const mockRequest = { session: { userId: '' } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
  });

  it('session.userId 为有效 UUID 时应放行', async () => {
    const mockRequest = { session: { userId: '550e8400-e29b-41d4-a716-446655440000' } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });

  it('XSS 防护：session.userId 含 HTML 标签时不影响逻辑（truthy 值放行）', async () => {
    const mockRequest = { session: { userId: '<script>alert(1)</script>' } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // userId 为 truthy 字符串，应放行（路由层再做权限校验）
    await requireAuth(mockRequest, mockReply);

    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// plugins/auth.js — Fastify 集成测试（通过真实的 Fastify 实例）
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - requireAuth Fastify 集成测试', () => {
  let app;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    const authModule = await import(`${serverRoot}/src/plugins/auth.js`);
    const { requireAuth } = authModule;

    // 注册一个需要鉴权的测试路由
    app.get('/protected', { preHandler: [requireAuth] }, async (request, reply) => {
      return reply.send({ data: { userId: request.session?.userId }, message: 'ok' });
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('无 session 时访问受保护路由应返回 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('Unauthorized');
  });

  it('手动设置 session.userId 后访问受保护路由应返回 200', async () => {
    const app2 = Fastify({ logger: false });

    const authModule = await import(`${serverRoot}/src/plugins/auth.js`);
    const { requireAuth } = authModule;

    // 使用 onRequest 钩子注入 session（避免 async done 问题）
    app2.addHook('onRequest', async (request) => {
      request.session = { userId: 'test-user-id' };
    });

    app2.get('/protected', { preHandler: [requireAuth] }, async (request, reply) => {
      return reply.send({ data: { userId: request.session.userId }, message: 'ok' });
    });

    await app2.ready();

    const response = await app2.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.userId).toBe('test-user-id');

    await app2.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// plugins/cors.js 测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - CORS 插件', () => {
  it('应该能导入 cors 插件模块', async () => {
    const corsModule = await import(`${serverRoot}/src/plugins/cors.js`);
    expect(corsModule).toBeDefined();
    expect(corsModule.default).toBeDefined();
    expect(typeof corsModule.default).toBe('function');
  });

  it('CORS 插件应该能注册到 Fastify 实例中', async () => {
    const originalOrigin = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://localhost:8082';

    const app = Fastify({ logger: false });
    const corsPlugin = (await import(`${serverRoot}/src/plugins/cors.js`)).default;

    await expect(app.register(corsPlugin)).resolves.not.toThrow();
    await app.ready();
    await app.close();

    process.env.CORS_ORIGIN = originalOrigin;
  });

  it('OPTIONS 请求应返回 CORS 相关响应头', async () => {
    const originalOrigin = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://localhost:8082';

    const app = Fastify({ logger: false });
    const corsPlugin = (await import(`${serverRoot}/src/plugins/cors.js`)).default;
    await app.register(corsPlugin);

    app.get('/test', async (request, reply) => {
      return reply.send({ data: 'ok', message: 'ok' });
    });

    await app.ready();

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: 'http://localhost:8082',
        'access-control-request-method': 'GET',
      },
    });

    // CORS 插件应设置 Access-Control-Allow-Origin 响应头
    expect(response.headers['access-control-allow-origin']).toBeDefined();

    await app.close();
    process.env.CORS_ORIGIN = originalOrigin;
  });

  it('CORS_ORIGIN 环境变量为空时插件仍应能注册', async () => {
    const originalOrigin = process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN;

    const app = Fastify({ logger: false });
    const corsPlugin = (await import(`${serverRoot}/src/plugins/cors.js`)).default;

    await expect(app.register(corsPlugin)).resolves.not.toThrow();
    await app.ready();
    await app.close();

    process.env.CORS_ORIGIN = originalOrigin;
  });

  it('多个 CORS_ORIGIN（逗号分隔）时插件应能正常注册', async () => {
    const originalOrigin = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://localhost:8082,https://example.com';

    const app = Fastify({ logger: false });
    const corsPlugin = (await import(`${serverRoot}/src/plugins/cors.js`)).default;

    await expect(app.register(corsPlugin)).resolves.not.toThrow();
    await app.ready();
    await app.close();

    process.env.CORS_ORIGIN = originalOrigin;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// plugins/session.js 测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - Session 插件', () => {
  it('应该能导入 session 插件模块', async () => {
    const sessionModule = await import(`${serverRoot}/src/plugins/session.js`);
    expect(sessionModule).toBeDefined();
    expect(sessionModule.default).toBeDefined();
    expect(typeof sessionModule.default).toBe('function');
  });

  it('Session 插件应该能注册到 Fastify 实例中', async () => {
    const originalSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'test-secret-for-session-plugin-at-least-32-chars';

    const app = Fastify({ logger: false });
    const sessionPlugin = (await import(`${serverRoot}/src/plugins/session.js`)).default;

    await expect(app.register(sessionPlugin)).resolves.not.toThrow();
    await app.ready();
    await app.close();

    process.env.SESSION_SECRET = originalSecret;
  });

  it('注册 session 插件后，request.session 对象应该可用', async () => {
    const originalSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'test-secret-for-session-plugin-at-least-32-chars';

    const app = Fastify({ logger: false });
    const sessionPlugin = (await import(`${serverRoot}/src/plugins/session.js`)).default;
    await app.register(sessionPlugin);

    let capturedSession;
    app.get('/session-test', async (request, reply) => {
      // @fastify/session 注册后 request.session 为对象（不是 undefined）
      capturedSession = request.session;
      return reply.send({ data: { sessionType: typeof request.session }, message: 'ok' });
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/session-test',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // session 应该是一个对象（object），不是 undefined 或 null
    expect(body.data.sessionType).toBe('object');

    await app.close();
    process.env.SESSION_SECRET = originalSecret;
  });

  it('SESSION_SECRET 未设置时插件应回退到默认密钥（不崩溃）', async () => {
    const originalSecret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;

    const app = Fastify({ logger: false });
    const sessionPlugin = (await import(`${serverRoot}/src/plugins/session.js`)).default;

    await expect(app.register(sessionPlugin)).resolves.not.toThrow();
    await app.ready();
    await app.close();

    process.env.SESSION_SECRET = originalSecret;
  });

  it('Cookie 响应头应包含 Set-Cookie（session 初始化时）', async () => {
    const originalSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'test-secret-for-session-plugin-at-least-32-chars';

    const app = Fastify({ logger: false });
    const sessionPlugin = (await import(`${serverRoot}/src/plugins/session.js`)).default;
    await app.register(sessionPlugin);

    app.get('/set-session', async (request, reply) => {
      // 设置 session 数据以触发 Set-Cookie
      request.session.userId = 'test-user';
      return reply.send({ data: 'ok', message: 'ok' });
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/set-session',
    });

    expect(response.statusCode).toBe(200);
    // 设置了 session 数据后，应该有 Set-Cookie 响应头
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();

    await app.close();
    process.env.SESSION_SECRET = originalSecret;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 文件结构验证
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - 文件结构验证', () => {
  it('apps/server/src/lib/errors.js 应该存在', async () => {
    const { default: fs } = await import('fs');
    const errorsPath = path.join(serverRoot, 'src/lib/errors.js');
    expect(fs.existsSync(errorsPath)).toBe(true);
  });

  it('apps/server/src/plugins/auth.js 应该存在', async () => {
    const { default: fs } = await import('fs');
    const authPath = path.join(serverRoot, 'src/plugins/auth.js');
    expect(fs.existsSync(authPath)).toBe(true);
  });

  it('apps/server/src/plugins/cors.js 应该存在', async () => {
    const { default: fs } = await import('fs');
    const corsPath = path.join(serverRoot, 'src/plugins/cors.js');
    expect(fs.existsSync(corsPath)).toBe(true);
  });

  it('apps/server/src/plugins/session.js 应该存在', async () => {
    const { default: fs } = await import('fs');
    const sessionPath = path.join(serverRoot, 'src/plugins/session.js');
    expect(fs.existsSync(sessionPath)).toBe(true);
  });

  it('errors.js 应该同时导出 AppError、NotFoundError、ForbiddenError', async () => {
    const errorsModule = await import(`${serverRoot}/src/lib/errors.js`);
    expect(errorsModule.AppError).toBeDefined();
    expect(errorsModule.NotFoundError).toBeDefined();
    expect(errorsModule.ForbiddenError).toBeDefined();
  });

  it('auth.js 应该导出 requireAuth 函数', async () => {
    const authModule = await import(`${serverRoot}/src/plugins/auth.js`);
    expect(authModule.requireAuth).toBeDefined();
    expect(typeof authModule.requireAuth).toBe('function');
  });

  it('cors.js 应该默认导出一个函数（Fastify 插件）', async () => {
    const corsModule = await import(`${serverRoot}/src/plugins/cors.js`);
    expect(typeof corsModule.default).toBe('function');
  });

  it('session.js 应该默认导出一个函数（Fastify 插件）', async () => {
    const sessionModule = await import(`${serverRoot}/src/plugins/session.js`);
    expect(typeof sessionModule.default).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 错误类继承链完整性验证
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - 错误类继承链完整性', () => {
  let AppError, NotFoundError, ForbiddenError;

  beforeEach(async () => {
    const errorsModule = await import(`${serverRoot}/src/lib/errors.js`);
    AppError = errorsModule.AppError;
    NotFoundError = errorsModule.NotFoundError;
    ForbiddenError = errorsModule.ForbiddenError;
  });

  it('NotFoundError instanceof AppError 应为 true', () => {
    expect(new NotFoundError('Memo') instanceof AppError).toBe(true);
  });

  it('NotFoundError instanceof Error 应为 true', () => {
    expect(new NotFoundError('Memo') instanceof Error).toBe(true);
  });

  it('ForbiddenError instanceof AppError 应为 true', () => {
    expect(new ForbiddenError() instanceof AppError).toBe(true);
  });

  it('ForbiddenError instanceof Error 应为 true', () => {
    expect(new ForbiddenError() instanceof Error).toBe(true);
  });

  it('可以用 try/catch 捕获 AppError', () => {
    expect(() => {
      throw new AppError('test error', 500, 'INTERNAL_ERROR');
    }).toThrow(AppError);
  });

  it('可以用 try/catch 捕获 NotFoundError（同时匹配 AppError 和 Error）', () => {
    expect(() => {
      throw new NotFoundError('Memo');
    }).toThrow(AppError);

    expect(() => {
      throw new NotFoundError('Memo');
    }).toThrow(Error);
  });

  it('可以用 try/catch 捕获 ForbiddenError（同时匹配 AppError 和 Error）', () => {
    expect(() => {
      throw new ForbiddenError();
    }).toThrow(AppError);

    expect(() => {
      throw new ForbiddenError();
    }).toThrow(Error);
  });

  it('AppError 有 stack，且 stack 包含调用位置信息', () => {
    const err = new AppError('test', 500, 'INTERNAL_ERROR');
    expect(err.stack).toContain('AppError');
  });

  it('NotFoundError 有 stack', () => {
    const err = new NotFoundError('Memo');
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
  });

  it('ForbiddenError 有 stack', () => {
    const err = new ForbiddenError();
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
  });

  it('各错误类的 statusCode 映射正确', () => {
    expect(new AppError('', 500).statusCode).toBe(500);
    expect(new NotFoundError('x').statusCode).toBe(404);
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it('各错误类的 code 映射正确', () => {
    expect(new AppError('', 500, 'INTERNAL_ERROR').code).toBe('INTERNAL_ERROR');
    expect(new NotFoundError('x').code).toBe('NOT_FOUND');
    expect(new ForbiddenError().code).toBe('FORBIDDEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 安全场景：requireAuth 不泄露敏感信息
// ─────────────────────────────────────────────────────────────────────────────

describe('T003 - requireAuth 安全场景', () => {
  let requireAuth;

  beforeEach(async () => {
    const authModule = await import(`${serverRoot}/src/plugins/auth.js`);
    requireAuth = authModule.requireAuth;
  });

  it('401 响应不应包含 session 内部数据（不泄露敏感信息）', async () => {
    const mockRequest = {
      session: { userId: null, secretData: 'should-not-leak' },
    };
    let sentBody;
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn((body) => {
        sentBody = body;
        return mockReply;
      }),
    };

    await requireAuth(mockRequest, mockReply);

    // 响应体不应包含 session 内部数据
    const bodyStr = JSON.stringify(sentBody);
    expect(bodyStr).not.toContain('should-not-leak');
  });

  it('SQL 注入字符串作为 userId 时，truthy 值依然放行（路由层负责数据库操作）', async () => {
    const mockRequest = {
      session: { userId: "'; DROP TABLE users; --" },
    };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // requireAuth 只检查 truthy，SQL注入字符串是 truthy，放行
    await requireAuth(mockRequest, mockReply);
    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });

  it('超长 userId 字符串时，truthy 值依然放行', async () => {
    const mockRequest = {
      session: { userId: 'x'.repeat(10000) },
    };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);
    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });

  it('数字 0 作为 userId（falsy）时应返回 401', async () => {
    const mockRequest = { session: { userId: 0 } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(401);
  });

  it('布尔值 false 作为 userId 时应返回 401', async () => {
    const mockRequest = { session: { userId: false } };
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireAuth(mockRequest, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(401);
  });
});
