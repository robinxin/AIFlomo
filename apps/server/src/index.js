import Fastify from 'fastify';
import { registerSession } from './plugins/session.js';
import authRoutes from './routes/auth.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register plugins (order matters: session must come before routes)
await registerSession(fastify);

// Register CORS for development
if (process.env.NODE_ENV !== 'production') {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8082,http://localhost:5173').split(',');

  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      reply.header('Access-Control-Allow-Credentials', 'true');
    }
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });
}

// Register auth routes (session plugin must be registered before routes)
await fastify.register(authRoutes, { prefix: '/api/auth' });

// Health check route
fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// Custom error handler for validation errors
fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.code(400).send({
      data: null,
      error: '请求参数格式错误',
      message: '参数验证失败',
    });
  }

  request.log.error(error);
  return reply.code(500).send({
    data: null,
    error: '服务器内部错误，请稍后重试',
    message: '服务器错误',
  });
});

try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`Server listening on ${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
