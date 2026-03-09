import Fastify from 'fastify';
import { sessionPlugin } from './plugins/session.js';
import { corsPlugin } from './plugins/cors.js';
import { authRoutes } from './routes/auth.js';

const app = Fastify({
  logger: process.env.NODE_ENV !== 'test',
});

// 注册全局插件（顺序重要：CORS → Session）
await app.register(corsPlugin);
await app.register(sessionPlugin);

// 注册业务路由（统一 /api 前缀）
await app.register(authRoutes, { prefix: '/api/auth' });

// 健康检查接口（无需认证）
app.get('/health', async (request, reply) => {
  return reply.send({ status: 'ok' });
});

// 全局错误处理
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  // 处理自定义错误（AppError 及其子类）
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      data: null,
      error: error.code ?? 'ERROR',
      message: error.message,
    });
  }

  // 处理 Fastify 验证错误
  if (error.validation) {
    return reply.status(400).send({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '请求参数不合法',
    });
  }

  // 处理未知错误
  const isProd = process.env.NODE_ENV === 'production';
  return reply.status(500).send({
    data: null,
    error: 'INTERNAL_ERROR',
    message: isProd ? '服务器内部错误' : error.message,
  });
});

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: '0.0.0.0' });

console.log(`✅ Server listening on http://0.0.0.0:${port}`);
