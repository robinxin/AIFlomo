/**
 * TDD: T002 — Fastify Session 插件配置验证
 *
 * 测试策略：
 * - 验证 session 插件能正确注册到 Fastify 实例
 * - 验证 Cookie 配置：httpOnly=true, sameSite='strict', secure 随 NODE_ENV 切换
 * - 验证 Cookie maxAge = 7*24*60*60*1000（7天）
 * - 验证 Session Store 使用 better-sqlite3 兼容存储
 * - 验证 Session secret 从环境变量读取
 * - 边界场景：NODE_ENV=production 时 secure=true，开发环境 secure=false
 * - 边界场景：SESSION_SECRET 未设置时抛出错误
 *
 * 测试隔离策略：
 * - Mock @fastify/session 避免真实 Session 注册副作用
 * - Mock better-sqlite3-session-store 避免真实 SQLite 操作
 * - 每个测试后清理 process.env 变更
 */

// ── Mocks 必须在模块导入之前声明 ──────────────────────────────────────────────

// Mock @fastify/session
const mockSessionPlugin = jest.fn(async (fastifyInstance, options) => {
  fastifyInstance.sessionOptions = options;
});
mockSessionPlugin[Symbol.for('skip-override')] = true;

jest.mock('@fastify/session', () => mockSessionPlugin);

// Mock better-sqlite3-session-store
const mockStoreInstance = { name: 'MockSqliteStore' };
const MockSqliteStore = jest.fn().mockImplementation(() => mockStoreInstance);
const mockBetterSqlite3SessionStore = jest.fn().mockReturnValue(MockSqliteStore);

jest.mock('better-sqlite3-session-store', () => mockBetterSqlite3SessionStore);

// Mock better-sqlite3 to avoid actual DB connections
const mockDb = {
  exec: jest.fn(),
  prepare: jest.fn().mockReturnValue({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  }),
  close: jest.fn(),
};
const MockDatabase = jest.fn().mockImplementation(() => mockDb);
jest.mock('better-sqlite3', () => MockDatabase);

// ── fastify は real を使う ──────────────────────────────────────────────────
const fastify = require('fastify');

// ── 環境変数クリーンアップ ──────────────────────────────────────────────────

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  // Reset mocks but keep the mock implementations
  mockSessionPlugin.mockClear();
  MockSqliteStore.mockClear();
  mockBetterSqlite3SessionStore.mockClear();
  MockDatabase.mockClear();
  mockDb.exec.mockClear();

  // Re-register mocks after resetModules
  jest.mock('@fastify/session', () => mockSessionPlugin);
  jest.mock('better-sqlite3-session-store', () => mockBetterSqlite3SessionStore);
  jest.mock('better-sqlite3', () => MockDatabase);
});

afterEach(() => {
  // Restore env vars changed during tests
  process.env = { ...originalEnv };
  delete process.env.SESSION_SECRET;
  delete process.env.NODE_ENV;
  delete process.env.DB_PATH;
});

// ── Helper: build a fresh Fastify app with the session plugin ───────────────
async function buildApp(env = {}) {
  Object.assign(process.env, env);
  // Re-require after env setup so the module sees the new env vars
  const sessionPlugin = require('../../src/plugins/session.js');
  const app = fastify({ logger: false });
  await app.register(sessionPlugin);
  await app.ready();
  return app;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. 模块导出验证
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — 模块导出', () => {
  test('SESSION_SECRET 已设置时，插件模块可正常导入', () => {
    process.env.SESSION_SECRET = 'test-secret-32chars-minimum-length!';
    expect(() => {
      require('../../src/plugins/session.js');
    }).not.toThrow();
  });

  test('session 插件导出是一个函数（ESM default export）', () => {
    process.env.SESSION_SECRET = 'test-secret-32chars-minimum-length!';
    const mod = require('../../src/plugins/session.js');
    // Babel 将 ESM export default 编译为 CJS 时，导出在 .default 属性上
    const sessionPlugin = mod.default || mod;
    expect(typeof sessionPlugin).toBe('function');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. SESSION_SECRET 缺失处理
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — SESSION_SECRET 缺失处理', () => {
  test('SESSION_SECRET 未设置时抛出错误', () => {
    delete process.env.SESSION_SECRET;
    expect(() => {
      require('../../src/plugins/session.js');
    }).toThrow(/SESSION_SECRET/i);
  });

  test('SESSION_SECRET 为空字符串时抛出错误', () => {
    process.env.SESSION_SECRET = '';
    expect(() => {
      require('../../src/plugins/session.js');
    }).toThrow(/SESSION_SECRET/i);
  });

  test('SESSION_SECRET 只含空白字符时抛出错误', () => {
    process.env.SESSION_SECRET = '   ';
    expect(() => {
      require('../../src/plugins/session.js');
    }).toThrow(/SESSION_SECRET/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. @fastify/session 注册验证
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — 注册 @fastify/session', () => {
  test('@fastify/session 插件被注册一次', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'test',
    });
    expect(mockSessionPlugin).toHaveBeenCalledTimes(1);
    await app.close();
  });

  test('注册时传入非空 options 对象', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'test',
    });
    const [, options] = mockSessionPlugin.mock.calls[0];
    expect(options).toBeDefined();
    expect(typeof options).toBe('object');
    expect(options).not.toBeNull();
    await app.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Cookie 配置验证
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — Cookie 配置', () => {
  let capturedOptions;
  let app;

  beforeEach(async () => {
    app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'development',
    });
    capturedOptions = mockSessionPlugin.mock.calls[0][1];
  });

  afterEach(async () => {
    await app.close();
  });

  test('cookie 配置对象存在', () => {
    expect(capturedOptions.cookie).toBeDefined();
    expect(typeof capturedOptions.cookie).toBe('object');
  });

  test('Cookie httpOnly 为 true', () => {
    expect(capturedOptions.cookie.httpOnly).toBe(true);
  });

  test('Cookie sameSite 为 "strict"', () => {
    expect(capturedOptions.cookie.sameSite).toBe('strict');
  });

  test('Cookie maxAge 为 7 天（毫秒单位）', () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    expect(capturedOptions.cookie.maxAge).toBe(SEVEN_DAYS_MS);
  });

  test('开发环境下 Cookie secure 为 false', () => {
    expect(capturedOptions.cookie.secure).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. secure Cookie 随 NODE_ENV 切换
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — secure Cookie 随环境切换', () => {
  test('NODE_ENV=production 时 Cookie secure 为 true', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'production',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    expect(options.cookie.secure).toBe(true);
    await app.close();
  });

  test('NODE_ENV=development 时 Cookie secure 为 false', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'development',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    expect(options.cookie.secure).toBe(false);
    await app.close();
  });

  test('NODE_ENV=test 时 Cookie secure 为 false', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'test',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    expect(options.cookie.secure).toBe(false);
    await app.close();
  });

  test('NODE_ENV 未设置时 Cookie secure 为 false', async () => {
    delete process.env.NODE_ENV;
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    expect(options.cookie.secure).toBe(false);
    await app.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Session secret 配置
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — Session secret 配置', () => {
  test('secret 从 SESSION_SECRET 环境变量读取', async () => {
    const testSecret = 'my-custom-secret-value-for-testing-purposes!!';
    const app = await buildApp({
      SESSION_SECRET: testSecret,
      NODE_ENV: 'test',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    expect(options.secret).toBe(testSecret);
    await app.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. SQLite Session Store 配置
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — SQLite Session Store 配置', () => {
  test('better-sqlite3-session-store 被引入', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'test',
    });
    expect(mockBetterSqlite3SessionStore).toHaveBeenCalled();
    await app.close();
  });

  test('Session Store 实例被传入 @fastify/session 配置', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'test',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    expect(options.store).toBeDefined();
    await app.close();
  });

  test('Session Store 是 SqliteStore 的实例', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'test',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    // The store should be the mockStoreInstance returned by MockSqliteStore()
    expect(options.store).toBe(mockStoreInstance);
    await app.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. saveUninitialized 配置
// ────────────────────────────────────────────────────────────────────────────

describe('Session 插件 — saveUninitialized 配置', () => {
  test('saveUninitialized 为 false（按需保存 Session，符合 EU Cookie Law）', async () => {
    const app = await buildApp({
      SESSION_SECRET: 'test-secret-value-must-be-long-enough-32chars',
      NODE_ENV: 'test',
    });
    const options = mockSessionPlugin.mock.calls[0][1];
    expect(options.saveUninitialized).toBe(false);
    await app.close();
  });
});
