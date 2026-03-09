import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { eq, lt } from 'drizzle-orm';

// SQLite Session Store 实现
class SQLiteSessionStore {
  constructor(db, schema) {
    this.db = db;
    this.schema = schema;
  }

  // 设置 Session
  async set(sessionId, session, callback) {
    try {
      const expiresAt = session.cookie?.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000; // 默认 7 天

      const userId = session.userId || null;

      // 检查 Session 是否已存在
      const existing = await this.db
        .select()
        .from(this.schema)
        .where(eq(this.schema.id, sessionId))
        .limit(1);

      if (existing.length > 0) {
        // 更新已有 Session
        await this.db
          .update(this.schema)
          .set({
            userId,
            expiresAt,
          })
          .where(eq(this.schema.id, sessionId));
      } else {
        // 插入新 Session
        await this.db.insert(this.schema).values({
          id: sessionId,
          userId,
          expiresAt,
        });
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  // 获取 Session
  async get(sessionId, callback) {
    try {
      const result = await this.db
        .select()
        .from(this.schema)
        .where(eq(this.schema.id, sessionId))
        .limit(1);

      if (result.length === 0) {
        return callback(null, null);
      }

      const session = result[0];

      // 检查是否过期
      if (session.expiresAt < Date.now()) {
        // Session 已过期，删除并返回 null
        await this.destroy(sessionId, () => {});
        return callback(null, null);
      }

      // 返回 Session 对象
      callback(null, {
        userId: session.userId,
        sessionId: session.id,
        cookie: {
          expires: new Date(session.expiresAt),
        },
      });
    } catch (error) {
      callback(error);
    }
  }

  // 销毁 Session
  async destroy(sessionId, callback) {
    try {
      await this.db
        .delete(this.schema)
        .where(eq(this.schema.id, sessionId));
      callback();
    } catch (error) {
      callback(error);
    }
  }

  // 清理过期 Session（可选，用于定期清理任务）
  async cleanup(callback) {
    try {
      await this.db
        .delete(this.schema)
        .where(lt(this.schema.expiresAt, Date.now()));
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

// Session 插件配置
export const sessionPlugin = fp(async (fastify) => {
  // 注册 Cookie 插件（Session 依赖）
  await fastify.register(fastifyCookie);

  // 创建 SQLite Session Store 实例
  const sessionStore = new SQLiteSessionStore(db, sessions);

  // 注册 Session 插件
  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET || 'replace-with-32-char-random-string-here',
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天（毫秒）
    },
    store: sessionStore,
    saveUninitialized: false, // 不保存未初始化的 Session
    cookieName: 'sessionId', // Cookie 名称
  });
});
