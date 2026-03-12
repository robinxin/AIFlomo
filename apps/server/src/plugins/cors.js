/**
 * apps/server/src/plugins/cors.js
 *
 * CORS 插件配置。
 *
 * 使用 @fastify/cors 注册 CORS 支持。允许的源由 CORS_ORIGIN 环境变量控制，
 * 格式为逗号分隔的 URL 列表（如 "http://localhost:8082,https://app.example.com"）。
 * 若 CORS_ORIGIN 未设置，则仅允许同源请求（origin: false）。
 *
 * 安全约束：
 * - 仅允许白名单域名（不使用 origin: true 或 '*'）
 * - credentials: true 允许携带 Cookie（配合 Session）
 *
 * 使用 Symbol.for('skip-override') 跳过作用域封装（等价于 fastify-plugin）。
 */

import fastifyCors from '@fastify/cors';

/**
 * corsPlugin — Fastify 插件，注册 CORS 配置
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function corsPlugin(fastify) {
  const corsOriginEnv = process.env.CORS_ORIGIN;

  // 将逗号分隔的白名单解析为数组；未设置时禁止跨域
  let origin;
  if (corsOriginEnv) {
    const origins = corsOriginEnv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    origin = origins.length === 1 ? origins[0] : origins;
  } else {
    origin = false;
  }

  await fastify.register(fastifyCors, {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

// 跳过作用域封装，确保 CORS 在父作用域可见
corsPlugin[Symbol.for('skip-override')] = true;

export default corsPlugin;
