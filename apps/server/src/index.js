import Fastify from 'fastify';
import { sessionPlugin } from './plugins/session.js';
import { corsPlugin } from './plugins/cors.js';
import { authRoutes } from './routes/auth.js';
import { memoRoutes } from './routes/memos.js';

const app = Fastify({
  logger: process.env.NODE_ENV !== 'test',
});

await app.register(corsPlugin);
await app.register(sessionPlugin);

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(memoRoutes, { prefix: '/api/memos' });

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      data: null,
      error: error.code ?? 'ERROR',
      message: error.message,
    });
  }

  if (error.validation) {
    return reply.status(400).send({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '请求参数不合法',
    });
  }

  const isProd = process.env.NODE_ENV === 'production';
  return reply.status(500).send({
    data: null,
    error: 'INTERNAL_ERROR',
    message: isProd ? '服务器内部错误' : error.message,
  });
});

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: '0.0.0.0' });
