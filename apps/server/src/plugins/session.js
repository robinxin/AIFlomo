import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { createSqlJsStore } from '../db/session-store.js';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * sessionPlugin — 配置 Fastify Session 与 Cookie
 *
 * Session 存储：使用 sql.js 同库 sessions 表（与 db/client.js 一致，无需原生 better-sqlite3）
 */
async function sessionPlugin(fastify) {
  await fastify.register(fastifyCookie);

  const store = createSqlJsStore();

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable must be set and at least 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  await fastify.register(fastifySession, {
    secret,
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE_MS,
    },
    saveUninitialized: false,
  });
}

export default fp(sessionPlugin, {
  name: 'session-plugin',
});
