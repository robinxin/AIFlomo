import Fastify from 'fastify';
import { db } from './db/index.js';
import { corsPlugin } from './plugins/cors.js';
import { sessionPlugin } from './plugins/session.js';
import { authRoutes } from './routes/auth.js';
import { AppError } from './lib/errors.js';

const fastify = Fastify({
  logger: true,
});

// Error handler — AppError 子类映射到正确的 HTTP 状态码
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      data: null,
      error: error.code,
      message: error.message,
    });
  }
  // Fastify schema 校验错误
  if (error.validation) {
    return reply.status(400).send({
      data: null,
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
  }
  fastify.log.error(error);
  return reply.status(500).send({
    data: null,
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误',
  });
});

fastify.register(corsPlugin);
fastify.register(sessionPlugin);
fastify.register(authRoutes, { prefix: '/api/auth' });

fastify.get('/health', async (request, reply) => {
  try {
    // 实际查询 DB，验证迁移已完成且连接正常
    db.$client.prepare('SELECT 1').get();
    return { status: 'ok', message: 'AIFlomo server is running' };
  } catch {
    return reply.status(503).send({ status: 'error', message: 'Database unavailable' });
  }
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
