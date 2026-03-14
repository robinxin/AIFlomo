/**
 * Fastify Session 插件配置
 *
 * 功能：注册 @fastify/session，配置 SQLite 兼容 Session Store（better-sqlite3）、
 *       Cookie 安全参数和 Session 生命周期。
 *
 * 技术方案参考: specs/active/43-feature-account-registration-login-3-design.md §2
 *
 * Cookie 配置：
 * - httpOnly: true          — 防止 XSS 窃取 Cookie
 * - sameSite: 'strict'      — 防止 CSRF 攻击
 * - secure: true（生产）    — 仅通过 HTTPS 传输
 * - maxAge: 7天（毫秒）      — Session 有效期
 *
 * Session Store：
 * - 使用 better-sqlite3-session-store（依赖已有的 better-sqlite3）
 * - Session 存储在同一 SQLite 数据库（DB_PATH 或默认路径）
 *
 * 环境变量：
 * - SESSION_SECRET （必须）: 用于签名 Cookie 的密钥，长度 >= 32 字符
 * - DB_PATH        （可选）: SQLite 数据库文件路径（默认 ./data.db）
 * - NODE_ENV       （可选）: 'production' 时启用 secure cookie
 */

import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import Database from 'better-sqlite3';
import SqliteStoreFactory from 'better-sqlite3-session-store';

// ── 常量 ────────────────────────────────────────────────────────────────────

/** Session 有效期：7 天（毫秒） */
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// ── 环境变量验证（模块加载时立即执行）──────────────────────────────────────────

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.trim() === '') {
  throw new Error(
    '[session plugin] SESSION_SECRET 环境变量未设置或为空。' +
    '请在 .env 文件中配置长度 >= 32 字符的密钥，例如：' +
    'SESSION_SECRET=your-very-long-and-random-secret-key-here'
  );
}

// ── SQLite Session Store 初始化 ──────────────────────────────────────────────

const dbPath = process.env.DB_PATH || './data.db';

/**
 * 创建 better-sqlite3 数据库连接用于 Session 存储。
 * Session 表（sessions）由 SqliteStore 自动创建和维护，无需 Drizzle 管理。
 */
const sessionDb = new Database(dbPath);

/**
 * 使用 better-sqlite3-session-store 创建兼容 express-session 协议的 Store。
 * @fastify/session 兼容 express-session 的 Store 接口（set/get/destroy）。
 */
const SqliteStore = SqliteStoreFactory(fastifySession);
const sessionStore = new SqliteStore({
  client: sessionDb,
  expired: {
    clear: true,
    intervalMs: 15 * 60 * 1000, // 每 15 分钟清理过期 Session
  },
});

// ── 是否启用 secure Cookie ───────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

// ── Fastify Plugin ───────────────────────────────────────────────────────────

/**
 * 注册 Fastify Session 插件。
 *
 * 使用 fastify-plugin 封装，使 session 装饰器对所有子作用域可见（不封装在 Fastify 插件沙箱内）。
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @returns {Promise<void>}
 */
async function sessionPlugin(fastify) {
  await fastify.register(fastifySession, {
    secret: sessionSecret,
    store: sessionStore,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: SESSION_MAX_AGE,
    },
  });
}

export default fp(sessionPlugin, {
  name: 'session',
  fastify: '5.x',
});
