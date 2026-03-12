/**
 * apps/server/src/plugins/session.js
 *
 * Session 插件配置。
 *
 * 注册 @fastify/cookie 和 @fastify/session，配置：
 * - httpOnly: true         — Cookie 不可被 JavaScript 读取（防 XSS 窃取）
 * - sameSite: 'strict'    — 仅允许同源请求携带 Cookie（防 CSRF）
 * - secure: true（生产环境）— Cookie 仅通过 HTTPS 传输
 * - secret: SESSION_SECRET 环境变量
 *
 * 使用 Symbol.for('skip-override') 标记（等价于 fastify-plugin），
 * 确保 cookie/session 装饰器在父作用域可用。
 *
 * 安全要求（来自 CLAUDE.md §🔒 安全红线）：
 * - Cookie 必须设置 httpOnly: true、sameSite: 'strict'、生产环境 secure: true
 */

import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';

/** 默认最小 secret（测试用，生产必须使用强密钥） */
const FALLBACK_SECRET = 'aiflomo-default-secret-change-in-production-env';

/**
 * sessionPlugin — Fastify 插件，注册 Cookie + Session
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function sessionPlugin(fastify) {
  const secret = process.env.SESSION_SECRET || FALLBACK_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // @fastify/cookie 必须在 @fastify/session 之前注册
  await fastify.register(fastifyCookie);

  await fastify.register(fastifySession, {
    secret,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      // maxAge: 7 days（毫秒）— 登录态保持 7 天
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    // saveUninitialized: true — 确保 session 对象始终初始化（方便 requireAuth 检查）
    saveUninitialized: true,
  });
}

// 等价于 fastify-plugin：跳过作用域封装，使装饰器在父作用域可见
sessionPlugin[Symbol.for('skip-override')] = true;

export default sessionPlugin;
