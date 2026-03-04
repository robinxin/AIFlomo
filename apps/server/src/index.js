import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { sessionPlugin } from './plugins/session.js';
import { authRoutes } from './routes/auth.js';

dotenv.config();

const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:8081',
  credentials: true,
});

await fastify.register(sessionPlugin);

await fastify.register(authRoutes, { prefix: '/api/auth' });

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  if (error.validation) {
    return reply.status(400).send({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '请求参数不合法',
    });
  }

  return reply.status(error.statusCode ?? 500).send({
    data: null,
    error: 'INTERNAL_ERROR',
    message: error.message ?? '服务器内部错误',
  });
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

await fastify.listen({ port: PORT, host: HOST });
console.log(`Server listening on http://${HOST}:${PORT}`);
