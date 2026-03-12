/**
 * Authentication preHandler.
 *
 * Attach `requireAuth` to any route that must be accessed only by
 * authenticated users:
 *
 *   fastify.get('/api/memos', { preHandler: [requireAuth] }, handler);
 *
 * The function inspects `request.session.userId` (populated by the
 * session plugin after a successful login).  If the value is absent the
 * handler throws an UnauthorizedError which is caught by the global
 * setErrorHandler and serialised into the project's unified error format:
 *
 *   { data: null, error: 'Unauthorized', message: 'Unauthorized' }
 *
 * No Fastify plugin registration is needed — `requireAuth` is a plain
 * async function that matches Fastify's preHandler signature.
 */

import { UnauthorizedError } from '../lib/errors.js';

/**
 * Fastify preHandler that enforces authentication via session cookie.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function requireAuth(request, _reply) {
  if (!request.session.userId) {
    throw new UnauthorizedError();
  }
}
