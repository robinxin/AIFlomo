import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
import Fastify from 'fastify';
import { corsPlugin } from './plugins/cors.js';
import { sessionPlugin } from './plugins/session.js';
import { authRoutes } from './routes/auth.js';

const app = Fastify({
  logger: process.env.NODE_ENV !== 'test',
  schemaErrorFormatter: () => {
    const err = new Error('请求参数不合法');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    return err;
  },
});

await app.register(corsPlugin);
await app.register(sessionPlugin);

await app.register(authRoutes, { prefix: '/api/auth' });

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.validation) {
    return reply.status(400).send({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '请求参数不合法',
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      data: null,
      error: error.code ?? 'ERROR',
      message: error.message,
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
