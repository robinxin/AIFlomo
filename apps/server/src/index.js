/**
 * Fastify server entry point
 *
 * Registration order:
 *   1. Session plugin (must be registered before any routes that use sessions)
 *   2. Authentication routes (/api/auth/*)
 */
import Fastify from 'fastify';
import sessionPlugin from './plugins/session.js';
import authRoutes from './routes/auth.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // 1. Session plugin — must be registered before routes that rely on sessions
  await fastify.register(sessionPlugin);

  // 2. Auth routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });

  // Health check endpoint
  fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: Date.now() });
  });

  return fastify;
}

// Start the server (only when running directly, not during tests)
const fastify = await buildApp();

try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`Server running at http://${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

export { buildApp };
