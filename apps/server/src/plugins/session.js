/**
 * Session plugin.
 *
 * Registers @fastify/cookie and @fastify/session so that every request
 * has a `request.session` object backed by an in-memory store (suitable
 * for MVP / single-process deployments with SQLite).
 *
 * Security settings enforced:
 *   - httpOnly: true    — cookie is inaccessible to client-side JavaScript
 *   - sameSite: strict  — cookie is not sent on cross-site requests (CSRF mitigation)
 *   - secure: true      — cookie is only sent over HTTPS in production;
 *                         false in development/test to allow plaintext HTTP
 *   - maxAge: 7 days    — session expires after one week of inactivity
 *
 * SESSION_SECRET must be set in the environment and must be at least 64
 * characters long. The plugin validates this invariant on registration so
 * it fails fast with a clear error rather than propagating a silent
 * misconfiguration.
 *
 * After registration the following are available:
 *   - `app.session`          — instance-level marker (true) so callers can
 *                              test plugin presence via `app.hasDecorator('session')`
 *   - `request.session`      — the per-request Session object (request decorator,
 *                              registered by @fastify/session)
 */

import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_SECRET_LENGTH = 64;

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function sessionPlugin(fastify) {
  const secret = process.env.SESSION_SECRET;

  // Validate SESSION_SECRET before attempting to register the session plugin.
  // Failing here produces a clear startup error instead of a cryptic library
  // error or a silently insecure deployment.
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is required. ' +
        'Generate one with: node -e "const c=require(\'crypto\');console.log(c.randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
        'Generate one with: node -e "const c=require(\'crypto\');console.log(c.randomBytes(32).toString(\'hex\'))"'
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';

  await fastify.register(cookie);

  await fastify.register(session, {
    secret,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      // In production the Secure attribute restricts the cookie to HTTPS only.
      // In development and test environments (NODE_ENV !== 'production') it is
      // set to false so the server works over plain HTTP (including inject() in tests).
      secure: isProduction,
      // Expire the session after 7 days so stale sessions are cleaned up
      // automatically rather than persisting indefinitely.
      maxAge: SESSION_MAX_AGE_MS,
    },
    // Do not save an uninitialised session to keep storage clean.
    saveUninitialized: false,
  });

  // Add an instance-level marker so consumers can verify the plugin is
  // registered via `app.hasDecorator('session')`.
  fastify.decorate('session', true);
}

export default fp(sessionPlugin, {
  name: 'session-plugin',
  fastify: '5.x',
});
