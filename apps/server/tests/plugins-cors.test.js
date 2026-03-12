/**
 * @file 测试 CORS 插件配置
 * @description 测试 @fastify/cors 插件的白名单域名过滤、凭证模式及 Preflight 处理
 *
 * TDD 阶段：RED — 实现文件 src/plugins/cors.js 尚未创建。
 * 以下所有测试在实现代码存在前均应 FAIL。
 *
 * 安全约束（来自 CLAUDE.md）：
 *   - CORS 必须仅允许白名单域名
 *   - 白名单域名从环境变量读取，不得硬编码
 *
 * 测试策略：
 *   - 使用 Fastify 的 app.inject() 发送带 Origin 头的请求
 *   - 验证响应头 Access-Control-Allow-Origin 和 Access-Control-Allow-Credentials
 *   - 每个 describe 块在 beforeEach 中重建 Fastify 实例以隔离环境变量变更
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 测试用白名单域名（逗号分隔，模拟 ALLOWED_ORIGINS 环境变量值） */
const TEST_ALLOWED_ORIGIN_1 = 'http://localhost:8082';
const TEST_ALLOWED_ORIGIN_2 = 'https://aiflomo.example.com';
const TEST_ALLOWED_ORIGINS = `${TEST_ALLOWED_ORIGIN_1},${TEST_ALLOWED_ORIGIN_2}`;

/** 不在白名单中的域名 */
const BLOCKED_ORIGIN = 'https://evil.example.com';

// ---------------------------------------------------------------------------
// 辅助函数：构建注册了 CORS 插件的最小 Fastify 实例
// ---------------------------------------------------------------------------

/**
 * 创建并初始化一个注册了 CORS 插件的 Fastify 实例。
 * 同时注册一个 GET /test 路由，方便后续断言响应头。
 *
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
async function buildApp() {
  const app = Fastify({ logger: false });

  // 注册 CORS 插件（实现文件不存在时此处会抛出 MODULE_NOT_FOUND 错误）
  await app.register(import('../src/plugins/cors.js'));

  // 注册一个简单的测试路由，用于验证 CORS 头
  app.get('/test', async (_request, _reply) => {
    return { data: 'ok', message: 'ok' };
  });

  return app;
}

// ===========================================================================
// 1. 插件注册
// ===========================================================================

describe('CORS 插件注册', () => {
  let app;

  beforeEach(async () => {
    process.env.ALLOWED_ORIGINS = TEST_ALLOWED_ORIGINS;
    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.ALLOWED_ORIGINS;
  });

  it('应成功注册 CORS 插件，不抛出异常', async () => {
    // 如果注册失败，buildApp() 会抛出，测试本身就会失败
    // 这里额外验证 app 实例是合法的 Fastify 实例
    expect(app).toBeDefined();
    expect(typeof app.inject).toBe('function');
  });

  it('注册后应能正常处理 GET 请求', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBe('ok');
  });
});

// ===========================================================================
// 2. ALLOWED_ORIGINS 环境变量校验
// ===========================================================================

describe('ALLOWED_ORIGINS 环境变量校验', () => {
  afterEach(async () => {
    delete process.env.ALLOWED_ORIGINS;
  });

  it('ALLOWED_ORIGINS 缺失时应抛出错误', async () => {
    delete process.env.ALLOWED_ORIGINS;

    const badApp = Fastify({ logger: false });
    await expect(
      badApp.register(import('../src/plugins/cors.js')),
    ).rejects.toThrow('ALLOWED_ORIGINS');

    try { await badApp.close(); } catch (_) { /* ignore */ }
  });

  it('ALLOWED_ORIGINS 为空字符串时应抛出错误', async () => {
    process.env.ALLOWED_ORIGINS = '';

    const badApp = Fastify({ logger: false });
    await expect(
      badApp.register(import('../src/plugins/cors.js')),
    ).rejects.toThrow('ALLOWED_ORIGINS');

    try { await badApp.close(); } catch (_) { /* ignore */ }
  });

  it('ALLOWED_ORIGINS 仅包含空白字符时应抛出错误', async () => {
    process.env.ALLOWED_ORIGINS = '   ';

    const badApp = Fastify({ logger: false });
    await expect(
      badApp.register(import('../src/plugins/cors.js')),
    ).rejects.toThrow('ALLOWED_ORIGINS');

    try { await badApp.close(); } catch (_) { /* ignore */ }
  });

  it('ALLOWED_ORIGINS 包含单个合法域名时应成功注册', async () => {
    process.env.ALLOWED_ORIGINS = TEST_ALLOWED_ORIGIN_1;

    const goodApp = Fastify({ logger: false });
    await expect(
      goodApp.register(import('../src/plugins/cors.js')),
    ).resolves.not.toThrow();

    await goodApp.close();
  });

  it('ALLOWED_ORIGINS 包含多个合法域名（逗号分隔）时应成功注册', async () => {
    process.env.ALLOWED_ORIGINS = TEST_ALLOWED_ORIGINS;

    const goodApp = Fastify({ logger: false });
    await expect(
      goodApp.register(import('../src/plugins/cors.js')),
    ).resolves.not.toThrow();

    await goodApp.close();
  });
});

// ===========================================================================
// 3. 允许白名单域名
// ===========================================================================

describe('允许白名单域名', () => {
  let app;

  beforeEach(async () => {
    process.env.ALLOWED_ORIGINS = TEST_ALLOWED_ORIGINS;
    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.ALLOWED_ORIGINS;
  });

  it('白名单中的第一个域名应收到正确的 Access-Control-Allow-Origin 头', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      TEST_ALLOWED_ORIGIN_1,
    );
  });

  it('白名单中的第二个域名应收到正确的 Access-Control-Allow-Origin 头', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_2,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      TEST_ALLOWED_ORIGIN_2,
    );
  });

  it('白名单域名请求应返回 200 状态码', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
      },
    });

    expect(response.statusCode).toBe(200);
  });
});

// ===========================================================================
// 4. 拒绝非白名单域名
// ===========================================================================

describe('拒绝非白名单域名', () => {
  let app;

  beforeEach(async () => {
    process.env.ALLOWED_ORIGINS = TEST_ALLOWED_ORIGINS;
    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.ALLOWED_ORIGINS;
  });

  it('非白名单域名不应收到 Access-Control-Allow-Origin 头', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: BLOCKED_ORIGIN,
      },
    });

    // @fastify/cors 对不允许的 origin 不设置 ACAO 头（或设为 false/空）
    // 以确保浏览器阻止跨域访问
    const acao = response.headers['access-control-allow-origin'];
    expect(acao).not.toBe(BLOCKED_ORIGIN);
    // 不应返回通配符（禁止 credentials 模式下使用 *）
    expect(acao).not.toBe('*');
  });

  it('非白名单域名发送 OPTIONS preflight 不应收到允许的 Access-Control-Allow-Origin 头', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: BLOCKED_ORIGIN,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
    });

    const acao = response.headers['access-control-allow-origin'];
    expect(acao).not.toBe(BLOCKED_ORIGIN);
    expect(acao).not.toBe('*');
  });

  it('无 Origin 头的请求（同源请求）应正常处理，不受 CORS 影响', async () => {
    // 没有 origin 头时，@fastify/cors 不会添加 ACAO 头，请求照常处理
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
  });

  it('子域名不在白名单时不应被允许', async () => {
    // 例如 http://sub.localhost:8082 不等于 http://localhost:8082
    const subdomainOrigin = 'http://sub.localhost:8082';
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: subdomainOrigin,
      },
    });

    const acao = response.headers['access-control-allow-origin'];
    expect(acao).not.toBe(subdomainOrigin);
  });
});

// ===========================================================================
// 5. Preflight（OPTIONS）请求处理
// ===========================================================================

describe('Preflight（OPTIONS）请求处理', () => {
  let app;

  beforeEach(async () => {
    process.env.ALLOWED_ORIGINS = TEST_ALLOWED_ORIGINS;
    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.ALLOWED_ORIGINS;
  });

  it('白名单域名发送 OPTIONS preflight 应收到 204 状态码', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    // @fastify/cors 默认对 preflight 返回 204
    expect(response.statusCode).toBe(204);
  });

  it('白名单域名发送 OPTIONS preflight 应收到正确的 Access-Control-Allow-Origin 头', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBe(
      TEST_ALLOWED_ORIGIN_1,
    );
  });

  it('Preflight 响应应包含 Access-Control-Allow-Methods 头', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.headers['access-control-allow-methods']).toBeDefined();
  });

  it('Preflight 响应应包含 Access-Control-Allow-Headers 头', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.headers['access-control-allow-headers']).toBeDefined();
  });

  it('Preflight 响应应允许 Content-Type 头', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    const allowedHeaders = response.headers['access-control-allow-headers'];
    expect(allowedHeaders).toBeDefined();
    // Content-Type 必须在允许的请求头列表中
    expect(allowedHeaders.toLowerCase()).toContain('content-type');
  });
});

// ===========================================================================
// 6. 凭证模式（credentials: true）
// ===========================================================================

describe('凭证模式（credentials: true）', () => {
  let app;

  beforeEach(async () => {
    process.env.ALLOWED_ORIGINS = TEST_ALLOWED_ORIGINS;
    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.ALLOWED_ORIGINS;
  });

  it('白名单域名请求应响应 Access-Control-Allow-Credentials: true', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
      },
    });

    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('Preflight 响应也应包含 Access-Control-Allow-Credentials: true', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: TEST_ALLOWED_ORIGIN_1,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('非白名单域名请求不应携带 Access-Control-Allow-Credentials: true', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: BLOCKED_ORIGIN,
      },
    });

    // 当 origin 不被允许时，不应设置 credentials 头（或设为 false）
    // 这是安全要求：防止浏览器将凭证（cookie）发送给被阻止的来源
    const acac = response.headers['access-control-allow-credentials'];
    expect(acac).not.toBe('true');
  });
});

// ===========================================================================
// 7. 多个白名单域名的独立验证
// ===========================================================================

describe('多域名白名单的独立验证', () => {
  let app;

  beforeEach(async () => {
    // 配置三个白名单域名，覆盖更多边界情况
    process.env.ALLOWED_ORIGINS = [
      'http://localhost:8082',
      'http://localhost:3001',
      'https://app.aiflomo.com',
    ].join(',');

    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.ALLOWED_ORIGINS;
  });

  it('三个白名单域名都应各自被允许', async () => {
    const origins = [
      'http://localhost:8082',
      'http://localhost:3001',
      'https://app.aiflomo.com',
    ];

    for (const origin of origins) {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { origin },
      });

      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('ALLOWED_ORIGINS 中逗号与空格混合时应正确解析白名单', async () => {
    // 关闭当前 app，重新创建带空格的配置
    await app.close();
    process.env.ALLOWED_ORIGINS = ' http://localhost:8082 , https://app.aiflomo.com ';

    app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { origin: 'http://localhost:8082' },
    });

    // 即使配置中有前后空格，解析后也应正确匹配
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8082',
    );
  });
});
