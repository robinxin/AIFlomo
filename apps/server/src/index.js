/**
 * Fastify server entry point
 *
 * Registration order:
 *   1. Session plugin (must be registered before any routes that use sessions)
 *   2. Authentication routes (/api/auth/*)
 *
 * The server startup (fastify.listen) is isolated inside `startServer()` and
 * guarded so that `buildApp` can be imported by unit tests without triggering
 * a real network bind. Jest sets JEST_WORKER_ID in all test processes, which
 * acts as the test-environment sentinel.
 */
import Fastify from 'fastify';
import sessionPlugin from './plugins/session.js';
import authRoutes from './routes/auth.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * buildApp — constructs and configures the Fastify instance.
 *
 * Exported separately so integration tests can import it without starting
 * the server. The caller is responsible for calling `fastify.ready()` and
 * `fastify.close()` around each test.
 *
 * Registration order is significant:
 *   1. Session plugin — decorates request.session; must exist before any
 *      route handler that reads or writes session data.
 *   2. Auth routes — depend on request.session being available.
 */
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

  // Health check endpoint (no auth required)
  fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: Date.now() });
  });

  return fastify;
}

/**
 * startServer — starts the HTTP listener.
 *
 * Only called when running directly (not imported by tests).
 * JEST_WORKER_ID is automatically set by Jest in all test worker processes,
 * so this block is skipped during test execution.
 */
async function startServer() {
  const fastify = await buildApp();

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry-point guard — skip server startup when imported by Jest test processes
// ---------------------------------------------------------------------------
if (!process.env.JEST_WORKER_ID) {
  startServer();
}

export { buildApp };
