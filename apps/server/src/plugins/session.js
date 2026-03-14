import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天，单位毫秒

/**
 * sessionPlugin — 配置 Fastify Session 与 Cookie
 *
 * Session 存储：使用 connect-sqlite3 适配器写入同一 SQLite 数据库
 *   - sessions 表由适配器自动创建，不纳入 Drizzle schema 管理
 *
 * Cookie 安全配置：
 *   - httpOnly: true       — 防止 XSS 窃取 Cookie
 *   - sameSite: 'strict'   — 防止 CSRF 攻击
 *   - secure: true         — 生产环境仅通过 HTTPS 传输（开发环境为 false）
 *   - maxAge: 7 天          — Session 有效期
 */
async function sessionPlugin(fastify) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Step 1: 注册 Cookie 插件（session 依赖）
  await fastify.register(fastifyCookie);

  // Step 2: 构建 SQLite Session Store
  //   connect-sqlite3 采用 CommonJS module，需通过 createRequire 加载
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);

  const SQLiteStoreFactory = require('connect-sqlite3');
  // connect-sqlite3 内部通过 Store.call(this, options) 调用 Store 基类构造函数，
  // ES6 class 语法不支持 .call() 方式调用，因此必须提供 function 形式的基类。
  // EventEmitter 兼容接口（prototype.emit / on）由 connect-sqlite3 自行绑定。
  function StoreBase() {}
  StoreBase.prototype.emit = function () {};
  StoreBase.prototype.on = function () { return this; };
  const SQLiteStore = SQLiteStoreFactory({ Store: StoreBase });

  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'aiflomo.db');
  const dbDir = path.dirname(dbPath);
  const dbFile = path.basename(dbPath);

  const store = new SQLiteStore({
    db: dbFile,
    dir: dbDir,
    table: 'sessions',
  });

  // Step 3: 校验 SESSION_SECRET（生产环境强制）
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable must be set and at least 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Step 4: 注册 Session 插件
  await fastify.register(fastifySession, {
    secret,
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
    saveUninitialized: false,
  });
}

export default fp(sessionPlugin, {
  name: 'session-plugin',
});
