/**
 * apps/server/src/index.js
 *
 * Fastify application entry point.
 *
 * Responsibilities:
 *  1. Create the Fastify instance.
 *  2. Register global plugins: helmet, rate-limit, session, cors, auth.
 *  3. Register route plugins under their API prefixes.
 *  4. Attach the global setErrorHandler that serialises AppError subclasses
 *     and Fastify validation errors into the project's unified response format:
 *       { data: null, error: string, message: string }
 *  5. Export the `app` instance so integration tests can import it.
 *  6. Start the server when this file is the main entry (i.e. not imported).
 */

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { validateEnv } from './lib/validate-env.js';
import sessionPlugin from './plugins/session.js';
import corsPlugin from './plugins/cors.js';
import memoRoutes from './routes/memos.js';
import db from './db/index.js';

// ─── Create Fastify instance ──────────────────────────────────────────────────

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.setErrorHandler((error, _request, reply) => {
  const statusCode = error.statusCode || 500;

  // Fastify validation errors carry a `validation` array and statusCode 400.
  if (error.validation) {
    return reply.status(400).send({
      data: null,
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
  }

  // Log unexpected server errors at error level.
  if (statusCode >= 500) {
    app.log.error(error);
  }

  return reply.status(statusCode).send({
    data: null,
    error: error.name || 'Error',
    message: error.message || 'Internal Server Error',
  });
});

// ─── Plugin registration ──────────────────────────────────────────────────────

// Security headers — reduces exposure to common web vulnerabilities.
// contentSecurityPolicy and crossOriginEmbedderPolicy are disabled because
// the API returns JSON only; CSP headers are the frontend's responsibility.
await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

// Global rate limiting — 100 requests per minute per IP.
// Protects against brute-force, credential stuffing, and DoS attacks.
await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    data: null,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
  }),
});

await app.register(sessionPlugin);
await app.register(corsPlugin);

// ─── Route registration ───────────────────────────────────────────────────────

await app.register(memoRoutes, { prefix: '/api/memos', db });

// ─── Start server ─────────────────────────────────────────────────────────────

const start = async () => {
  validateEnv();

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export default app;
