/**
 * Auth plugin for AIFlomo.
 *
 * Decorates the Fastify instance with a `requireAuth` preHandler that validates
 * the session cookie against the application's own `sessions` table and injects
 * authenticated context into `request.user`.
 *
 * Validation steps performed on every protected request:
 *   1. Read the `sessionId` cookie from the incoming request.
 *   2. Validate the cookie value matches UUID v4 format.
 *   3. Query the `sessions` table INNER JOIN `users` in a single round-trip.
 *   4. Reject the request if no matching session + user row exists.
 *   5. Reject the request if `expiresAt < Date.now()` (session expired).
 *   6. On success, write `{ userId, sessionId }` to `request.user` so that
 *      downstream route handlers can read the authenticated identity.
 *
 * Error response format (all 401 responses):
 *   { data: null, error: 'UNAUTHORIZED', message: '请先登录' }
 *
 * Design reference:
 *   specs/active/28-feature-account-registration-login-2-design.md
 */

import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the session cookie set by the session plugin. */
const COOKIE_NAME = 'sessionId';

/** Standard 401 error code returned in every auth failure response. */
const ERROR_CODE = 'UNAUTHORIZED';

/**
 * UUID v4 format regex.
 *
 * Validates that the cookie value is a well-formed UUID v4 before issuing any
 * database query.  This prevents trivially malformed values (e.g. SQL
 * metacharacters, empty strings, path-traversal sequences) from ever reaching
 * the persistence layer.
 *
 * Pattern breakdown:
 *   [0-9a-f]{8}   — 8 hex chars
 *   -             — literal hyphen
 *   [0-9a-f]{4}   — 4 hex chars
 *   -4            — version nibble must be '4'
 *   [0-9a-f]{3}   — 3 more hex chars
 *   -[89ab]       — variant nibble must be 8, 9, a or b  (RFC 4122 variant)
 *   [0-9a-f]{3}   — 3 more hex chars
 *   -[0-9a-f]{12} — final 12 hex chars
 */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Send a 401 Unauthorized response and stop request processing.
 *
 * All 401 responses use the same message ("请先登录") to prevent timing-based
 * side-channel leaks that would otherwise allow callers to distinguish between
 * "session not found", "session expired", and "user deleted" states.
 *
 * @param {import('fastify').FastifyReply} reply
 */
function replyUnauthorized(reply) {
  return reply.status(401).send({
    data: null,
    error: ERROR_CODE,
    message: '请先登录',
  });
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} _opts
 */
async function authPlugin(fastify, _opts) {
  /**
   * Fastify preHandler: validate the session cookie and inject auth context.
   *
   * Attach to any route that requires an authenticated user:
   *
   *   fastify.get('/protected', {
   *     preHandler: [fastify.requireAuth],
   *     handler: async (request, reply) => {
   *       const { userId, sessionId } = request.user;
   *       // …
   *     },
   *   });
   *
   * @param {import('fastify').FastifyRequest} request
   * @param {import('fastify').FastifyReply}   reply
   */
  fastify.decorate('requireAuth', async (request, reply) => {
    // -----------------------------------------------------------------------
    // 1. Read the sessionId cookie.
    //
    //    `request.cookies` is populated by @fastify/cookie (a peer dependency
    //    of the session plugin, which must be registered before this plugin).
    //    An absent or empty cookie value means the client is not authenticated.
    // -----------------------------------------------------------------------
    const sessionId = request.cookies?.[COOKIE_NAME];

    if (!sessionId) {
      return replyUnauthorized(reply);
    }

    // -----------------------------------------------------------------------
    // 2. Validate UUID v4 format.
    //
    //    Reject cookie values that are not well-formed UUID v4 strings before
    //    issuing any database query.  This closes a timing side-channel (the
    //    DB round-trip would only occur for structurally valid IDs) and acts
    //    as an input sanitation layer against malformed or adversarial values.
    // -----------------------------------------------------------------------
    if (!UUID_V4_RE.test(sessionId)) {
      return replyUnauthorized(reply);
    }

    // -----------------------------------------------------------------------
    // 3. Look up the session and user in a single INNER JOIN query.
    //
    //    Combining the two former sequential queries (sessions → users) into
    //    one JOIN eliminates the N+1 round-trip pattern and ensures atomicity:
    //    if either the session or the linked user is missing the row is simply
    //    absent from the result set and we return 401 without further checks.
    //
    //    The INNER JOIN also replaces the explicit "orphaned session" check —
    //    a session whose userId references a deleted user will produce no rows
    //    because the join condition `sessions.userId = users.id` fails.
    // -----------------------------------------------------------------------
    let row;
    try {
      const rows = await db
        .select({
          sessionId: sessions.id,
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      row = rows[0];
    } catch (err) {
      request.log.error({ err }, 'requireAuth: database query failed');
      return replyUnauthorized(reply);
    }

    if (!row) {
      return replyUnauthorized(reply);
    }

    // -----------------------------------------------------------------------
    // 4. Check session expiry.
    //
    //    `expiresAt` is stored as a Unix timestamp in milliseconds.
    //    Any session whose expiry has passed is treated as invalid.
    //    We use the same generic message as all other 401 paths to avoid
    //    leaking timing information to the caller.
    // -----------------------------------------------------------------------
    if (row.expiresAt < Date.now()) {
      return replyUnauthorized(reply);
    }

    // -----------------------------------------------------------------------
    // 5. Inject authenticated context into request.user.
    //
    //    We write to `request.user` (a dedicated auth context property) rather
    //    than overwriting `request.session` (which is managed by the
    //    @fastify/session plugin and may contain unrelated session state).
    //    Downstream route handlers read identity from `request.user.userId`
    //    and `request.user.sessionId`.
    // -----------------------------------------------------------------------
    request.user = { userId: row.userId, sessionId: row.sessionId };
  });
}

export default fp(authPlugin, {
  name: 'auth',
});
