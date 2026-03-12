/**
 * Auth routes for AIFlomo.
 *
 * Registers all /api/auth/* endpoints.  The route prefix (/api/auth) is
 * provided by the caller (src/index.js or the test harness) via Fastify's
 * `prefix` option — route paths inside this plugin are relative paths only.
 *
 * Currently implemented endpoints:
 *   POST /register  — create a new user account and open a session
 *
 * Request validation:
 *   Two-phase validation strategy:
 *     Phase 1 (preValidation hook): Strict type check on the raw parsed body
 *       before AJV runs.  Rejects non-boolean agreePolicy values (e.g. "true",
 *       1) that Fastify's default AJV would silently coerce to boolean true.
 *     Phase 2 (Fastify JSON Schema): Standard structural validation — missing
 *       fields, wrong formats, length constraints, etc.
 *   A custom setErrorHandler translates validation errors into the project's
 *   standard envelope: { data: null, error, message }.
 *
 * Error codes returned by this plugin:
 *   VALIDATION_ERROR      — 400 — malformed or missing request fields
 *   EMAIL_ALREADY_EXISTS  — 409 — the supplied email is already registered
 *   INTERNAL_ERROR        — 500 — unexpected server-side failure
 *   RATE_LIMIT_EXCEEDED   — 429 — too many requests within the time window
 *
 * Response envelope (success):
 *   { data: { id, email, nickname, createdAt }, message }
 *
 * Response envelope (failure):
 *   { data: null, error: <code>, message }
 *
 * Design reference:
 *   specs/active/28-feature-account-registration-login-2-design.md
 */

import { eq } from 'drizzle-orm';
import rateLimit from '@fastify/rate-limit';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { ConflictError, AppError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Session lifetime in milliseconds (7 days). */
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Rate-limit window in milliseconds (1 minute). */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Maximum registration requests per window per IP. */
const RATE_LIMIT_MAX = 10;

// ---------------------------------------------------------------------------
// JSON Schema — POST /register request body
// ---------------------------------------------------------------------------

const registerBodySchema = {
  type: 'object',
  required: ['email', 'nickname', 'password', 'agreePolicy'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
    },
    nickname: {
      type: 'string',
      minLength: 1,
      maxLength: 50,
    },
    password: {
      type: 'string',
      minLength: 6,
      maxLength: 128,
    },
    agreePolicy: {
      type: 'boolean',
      const: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Strict type pre-check for agreePolicy
//
// Fastify's AJV is configured with coerceTypes: 'array' by default, which
// silently converts the JSON string "true" and the integer 1 to boolean true
// BEFORE the handler runs.  To enforce that only the boolean literal `true`
// is accepted, we check the raw parsed body in a preValidation hook, which
// executes BEFORE AJV schema validation and coercion.
// ---------------------------------------------------------------------------

/**
 * Validate that agreePolicy is strictly a boolean (not a coerced value).
 *
 * Returns null if the body is missing or agreePolicy is not present yet
 * (those cases are caught by the JSON schema validation).
 *
 * @param {object|undefined} body - The raw parsed JSON body.
 * @returns {string|null} Error message string, or null if valid.
 */
function checkAgreePolicyType(body) {
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'agreePolicy')) {
    return null; // Missing field caught by JSON schema (required: [...])
  }
  if (typeof body.agreePolicy !== 'boolean') {
    return 'agreePolicy must be a boolean';
  }
  if (body.agreePolicy !== true) {
    return 'agreePolicy must be true';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

/**
 * Fastify plugin that registers auth-related routes.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} _opts - Plugin options (unused).
 */
export default async function authRoutes(fastify, _opts) {
  // -------------------------------------------------------------------------
  // Rate limiting — protect the auth endpoints from brute-force abuse.
  //
  // Scope: registered within this encapsulated plugin context so that the
  // limits apply only to /api/auth/* routes, not the entire application.
  //
  // Configuration:
  //   - 10 requests per 60-second window per client IP.
  //   - Error response follows the project's standard envelope format.
  //   - `addHeaders` is set to false for all headers so that implementation
  //     details (retry-after, rate-limit totals) are not leaked to clients.
  // -------------------------------------------------------------------------
  await fastify.register(rateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_request, context) => ({
      data: null,
      error: 'RATE_LIMIT_EXCEEDED',
      message: `请求过于频繁，请在 ${Math.ceil(context.ttl / 1000)} 秒后重试`,
    }),
    addHeaders: {
      'x-ratelimit-limit': false,
      'x-ratelimit-remaining': false,
      'x-ratelimit-reset': false,
      'retry-after': false,
    },
  });

  // -------------------------------------------------------------------------
  // Error handler — translate Fastify validation errors and custom AppErrors
  // into the project's standard error envelope.
  //
  // Scope: this handler is scoped to the encapsulated context of this plugin,
  // so it only affects routes registered within authRoutes.  It does NOT
  // override any global error handler registered on the parent Fastify instance.
  // -------------------------------------------------------------------------
  fastify.setErrorHandler((err, request, reply) => {
    // Fastify JSON Schema validation failures carry a `validation` array and
    // a statusCode of 400.  Map these to VALIDATION_ERROR.
    if (err.validation || err.statusCode === 400) {
      return reply.status(400).send({
        data: null,
        error: 'VALIDATION_ERROR',
        message: err.message || '请求参数不合法',
      });
    }

    // Custom application errors (ConflictError, UnauthorizedError, AppError).
    // The `code` property carries the machine-readable error code (e.g.
    // 'EMAIL_ALREADY_EXISTS'); fall back to the constructor name when absent.
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        data: null,
        error: err.code || err.name,
        message: err.message,
      });
    }

    // Unexpected errors — log and return a generic 500.
    request.log.error({ err }, 'Unhandled error in authRoutes');
    return reply.status(500).send({
      data: null,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  });

  // -------------------------------------------------------------------------
  // POST /register
  //
  // Create a new user account.
  //
  // Flow:
  //   1. preValidation hook: strict agreePolicy type check (before AJV).
  //   2. Fastify JSON Schema validation: missing fields, format, length.
  //   3. Normalise email to lowercase.
  //   4. Check for duplicate email — throw ConflictError(409) if found.
  //   5. Hash the password with bcrypt (via hashPassword helper).
  //   6. Insert the user row into `users`.
  //   7. Attach the user identity to the @fastify/session session object and
  //      call save() so the session plugin serialises it and writes the
  //      Set-Cookie: sessionId header.
  //   8. Insert a corresponding row into our application's `sessions` table
  //      using the session ID that @fastify/session auto-assigned.
  //   9. Return 201 with the user data envelope.
  // -------------------------------------------------------------------------
  fastify.post(
    '/register',
    {
      schema: {
        body: registerBodySchema,
      },
      preValidation: async (request, reply) => {
        // Phase 1: Strict agreePolicy type check.
        //
        // This runs BEFORE Fastify's AJV schema validation coerces types.
        // At this point, request.body contains the raw JSON-parsed values
        // (strings are strings, numbers are numbers — not yet coerced).
        const typeError = checkAgreePolicyType(request.body);
        if (typeError !== null) {
          return reply.status(400).send({
            data: null,
            error: 'VALIDATION_ERROR',
            message: typeError,
          });
        }
      },
    },
    async (request, reply) => {
      const { email: rawEmail, nickname, password } = request.body;

      // Step 3: Normalise email.
      const email = rawEmail.toLowerCase();

      // Step 4: Check email uniqueness.
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError('该邮箱已被注册', 'EMAIL_ALREADY_EXISTS');
      }

      // Step 5: Hash the password.
      const passwordHash = await hashPassword(password);

      // Step 6: Insert the user.
      //
      // We use .returning() to get the auto-generated UUID and the
      // server-side timestamp in a single round-trip.
      let user;
      try {
        const insertedUsers = await db
          .insert(users)
          .values({ email, nickname, passwordHash })
          .returning({
            id: users.id,
            email: users.email,
            nickname: users.nickname,
            createdAt: users.createdAt,
          });
        user = insertedUsers[0];
      } catch (insertErr) {
        // SQLite unique constraint violation (SQLITE_CONSTRAINT_UNIQUE) occurs
        // when two concurrent registrations race past the SELECT check above
        // and both attempt to INSERT the same email.  We surface this as a
        // 409 ConflictError to match the non-race-condition duplicate path.
        if (
          insertErr?.message?.includes('UNIQUE constraint failed') ||
          insertErr?.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
          throw new ConflictError('该邮箱已被注册', 'EMAIL_ALREADY_EXISTS');
        }
        throw insertErr;
      }

      // Step 7: Attach user identity to the session object.
      //
      // We write the userId into the session data so that future requests can
      // recover the authenticated identity from the session store.
      //
      // `request.session.sessionId` is a read-only getter on the @fastify/session
      // Session object — we must NOT attempt to assign to it.  Its value is the
      // auto-generated UUID that @fastify/session stores in the cookie.
      request.session.userId = user.id;

      // Retrieve the session ID before saving — it is already assigned by
      // @fastify/session when the session object is created.
      const sessionId = request.session.sessionId;
      const expiresAt = Date.now() + SESSION_MAX_AGE_MS;

      // Step 8: Insert into our application's `sessions` table FIRST.
      //
      // Atomicity: we insert the `sessions` row before calling session.save()
      // to avoid the partial-failure scenario where the cookie is written to
      // the client but the database record is never created.  If the INSERT
      // fails, session.save() is never called and no cookie is sent.
      //
      // This table is used by the `requireAuth` middleware (plugins/auth.js)
      // to validate requests on protected endpoints.
      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        expiresAt,
      });

      // Step 9: Persist the session and write the Set-Cookie header.
      //
      // Executed after the DB insert succeeds so the cookie is only sent
      // when both the user row and the session row are safely stored.
      await request.session.save();

      // Step 10: Return 201 with the user data.
      return reply.code(201).send({
        data: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          createdAt: user.createdAt,
        },
        message: '注册成功',
      });
    },
  );
}
