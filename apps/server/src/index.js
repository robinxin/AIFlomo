/**
 * Fastify Application Entry Point — Application Factory
 *
 * This module exports `buildApp`, a factory function that creates and configures
 * a Fastify instance. Importing this module does NOT start the HTTP server.
 * To start the server, see `src/main.js`.
 *
 * Plugin registration order (critical — session MUST precede auth routes):
 *   1. @fastify/cors
 *   2. Session plugin (src/plugins/session.js)  ← must be first
 *   3. Auth routes   (src/routes/auth.js)        ← depends on session
 *   4. Health-check route GET /
 *
 * Environment variables consumed by plugins/routes (not by this file):
 *   SESSION_SECRET  - Session signing secret (min 32 chars)
 *   DATABASE_PATH   - SQLite database file path (used by session plugin)
 *   NODE_ENV        - 'production' enables secure cookies
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sessionPlugin from './plugins/session.js';
import authRoutes from './routes/auth.js';

// ── Application factory ───────────────────────────────────────────────────────

/**
 * Build and configure a Fastify application instance.
 *
 * Accepting options makes this function testable without binding to a real port:
 * in tests, pass an in-memory better-sqlite3 Database and a test secret;
 * in production the defaults read from environment variables are used.
 *
 * @param {object}  [options={}]           - Configuration overrides
 * @param {string}  [options.secret]       - Session secret (falls back to SESSION_SECRET env var)
 * @param {import('better-sqlite3').Database} [options.db]
 *                                         - SQLite db for sessions (tests only; production uses file DB)
 * @param {boolean|object} [options.logger] - Fastify logger config (default: true)
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function buildApp(options = {}) {
  const {
    secret,
    db,
    logger = true,
  } = options;

  // ── Create Fastify instance ───────────────────────────────────────────────

  const fastify = Fastify({ logger });

  // ── Register CORS ─────────────────────────────────────────────────────────
  // Allows all origins with credentials in development.
  // Production deployments should restrict this to an allowlist.

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // ── Register Session plugin ───────────────────────────────────────────────
  // Session plugin MUST be registered before auth routes so that
  // request.session is decorated on the Fastify instance before route handlers run.

  const sessionOptions = { secret };
  if (db) {
    sessionOptions.db = db;
  }

  await fastify.register(sessionPlugin, sessionOptions);

  // ── Register Auth routes ──────────────────────────────────────────────────
  // authRoutes is wrapped with fastify-plugin (skip-override = true), which causes
  // Fastify to ignore the prefix option when registering the plugin directly.
  // Wrapping in a plain async function (no fp()) ensures the prefix is applied.

  await fastify.register(async (prefixedScope) => {
    await prefixedScope.register(authRoutes);
  }, { prefix: '/api/auth' });

  // ── Health check endpoint ─────────────────────────────────────────────────

  fastify.get('/', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  return fastify;
}
