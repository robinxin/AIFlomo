/**
 * Session plugin for AIFlomo.
 *
 * Registers @fastify/session backed by a custom SQLite store so that session
 * data survives server restarts without requiring a separate Redis instance
 * (appropriate for the MVP stage described in CLAUDE.md).
 *
 * Responsibilities:
 *   1. Reuse the shared SQLite connection from db/index.js and auto-create the
 *      `_fastify_sessions` table if it does not exist.
 *   2. Register @fastify/session with the SQLite store.
 *   3. Post-process every Set-Cookie response header to:
 *      a. Add `Max-Age=604800` (7 days in seconds) to the session cookie —
 *         @fastify/session v11 stores the lifetime as `originalMaxAge` in the
 *         cookie JSON, which @fastify/cookie does not translate to a Max-Age
 *         attribute, so we insert it directly in the header string.
 *      b. Add the `Secure` flag when running in production mode (NODE_ENV=
 *         'production').  We set `secure: false` in the @fastify/session
 *         options to avoid the plugin's `isInsecureConnection` guard that
 *         drops the cookie on plain HTTP connections used by inject()-based
 *         tests.
 *   4. Patch every Session object with a `delete()` alias for `destroy()` so
 *      the auth route layer can call `request.session.delete()` on logout.
 *
 * Prerequisites:
 *   - none: this plugin registers @fastify/cookie internally if it has not
 *     already been registered by the caller.
 *
 * Environment variables:
 *   SESSION_SECRET  — cookie signing secret (must be ≥ 32 characters)
 *   DB_PATH         — SQLite file path (default: './data/aiflomo.db')
 *   NODE_ENV        — 'production' enables the Secure cookie attribute
 */

import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { sqlite } from '../db/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name used for the session cookie. */
const COOKIE_NAME = 'sessionId';

/** Session lifetime in milliseconds (7 days). */
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Session lifetime in seconds (7 days).
 * This is the value written into the `Max-Age` cookie attribute.
 * HTTP's Max-Age attribute uses seconds, not milliseconds.
 */
const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000; // 604800

// ---------------------------------------------------------------------------
// SQLite session store
// ---------------------------------------------------------------------------

/**
 * Create a session store backed by better-sqlite3.
 *
 * The store satisfies the interface required by @fastify/session:
 *   set(sessionId, session, callback)
 *   get(sessionId, callback)
 *   destroy(sessionId, callback)
 *
 * Sessions are JSON-serialised and stored in `_fastify_sessions`.  Expired
 * rows are removed lazily on `get` and opportunistically on `set`.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ set: Function, get: Function, destroy: Function }}
 */
export function createSQLiteStore(db) {
  // Create the table if it does not already exist.
  db.exec(`
    CREATE TABLE IF NOT EXISTS _fastify_sessions (
      id         TEXT    PRIMARY KEY,
      data       TEXT    NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // Index to speed up expiry-based cleanup queries.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fastify_sessions_expires_at
    ON _fastify_sessions (expires_at)
  `);

  const stmtUpsert = db.prepare(`
    INSERT INTO _fastify_sessions (id, data, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      data       = excluded.data,
      expires_at = excluded.expires_at
  `);

  const stmtGet = db.prepare(
    'SELECT data, expires_at FROM _fastify_sessions WHERE id = ?',
  );

  const stmtDelete = db.prepare(
    'DELETE FROM _fastify_sessions WHERE id = ?',
  );

  const stmtDeleteExpired = db.prepare(
    'DELETE FROM _fastify_sessions WHERE expires_at <= ?',
  );

  return {
    /**
     * Persist a session to SQLite.
     *
     * @param {string}   sessionId
     * @param {object}   session   - Session object from @fastify/session.
     * @param {Function} callback  - Node-style (err) callback.
     */
    set(sessionId, session, callback) {
      try {
        // Compute the expiry timestamp from the session cookie metadata.
        // @fastify/session stores originalMaxAge in milliseconds internally,
        // so we add it directly to Date.now().
        const cookieExpires = session.cookie && session.cookie.expires;
        const cookieMaxAge = session.cookie && session.cookie.originalMaxAge;

        let expiresAt;
        if (cookieExpires instanceof Date) {
          expiresAt = cookieExpires.getTime();
        } else if (typeof cookieMaxAge === 'number') {
          expiresAt = Date.now() + cookieMaxAge;
        } else {
          expiresAt = Date.now() + SESSION_MAX_AGE_MS;
        }

        stmtUpsert.run(sessionId, JSON.stringify(session), expiresAt);

        // Best-effort pruning of expired rows (non-fatal).
        try {
          stmtDeleteExpired.run(Date.now());
        } catch (_) { /* ignore */ }

        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    /**
     * Retrieve a session from SQLite.
     *
     * Returns `null` for missing or expired sessions.  @fastify/session
     * treats `null` as "no session found" and creates a new one.
     *
     * Corrupted (non-parseable) JSON data is treated as a missing session:
     * the row is deleted and the callback is called with null.
     *
     * @param {string}   sessionId
     * @param {Function} callback  - Node-style (err, session|null) callback.
     */
    get(sessionId, callback) {
      try {
        const row = stmtGet.get(sessionId);

        if (!row) {
          return callback(null, null);
        }

        if (row.expires_at <= Date.now()) {
          stmtDelete.run(sessionId);
          return callback(null, null);
        }

        let sessionData;
        try {
          sessionData = JSON.parse(row.data);
        } catch (_) {
          // Corrupted data — treat as a missing session and remove the row.
          stmtDelete.run(sessionId);
          return callback(null, null);
        }

        callback(null, sessionData);
      } catch (err) {
        callback(err);
      }
    },

    /**
     * Delete a session from SQLite.
     *
     * @param {string}   sessionId
     * @param {Function} callback  - Node-style (err) callback.
     */
    destroy(sessionId, callback) {
      try {
        stmtDelete.run(sessionId);
        callback(null);
      } catch (err) {
        callback(err);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Cookie header post-processor
// ---------------------------------------------------------------------------

/**
 * Transform a single `Set-Cookie` header value.
 *
 * - Inserts `Max-Age=<SESSION_MAX_AGE_SECONDS>` if the cookie is the session
 *   cookie and `Max-Age` is not already present.
 * - Appends `; Secure` if `addSecure` is true and the attribute is absent.
 *
 * @param {string}  cookieStr - Raw Set-Cookie header string.
 * @param {boolean} addSecure - Whether to add the Secure attribute.
 * @returns {string}
 */
export function transformSessionCookie(cookieStr, addSecure) {
  // Only transform session cookies.
  if (!cookieStr.includes(`${COOKIE_NAME}=`)) {
    return cookieStr;
  }

  let result = cookieStr;

  // Add Max-Age if absent.
  if (!/;\s*Max-Age=/i.test(result)) {
    result = `${result}; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
  }

  // Add Secure flag in production if absent.
  if (addSecure && !/;\s*Secure/i.test(result)) {
    result = `${result}; Secure`;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} _options
 */
async function sessionPlugin(fastify, _options) {
  // -------------------------------------------------------------------------
  // 0a. Register @fastify/cookie if the caller has not already done so.
  //
  //     @fastify/session depends on @fastify/cookie for cookie parsing and
  //     signing.  By registering it here (guarded by a hasDecorator check) we
  //     allow callers — including tests — to omit the explicit registration
  //     step while still supporting setups where the caller already registered
  //     the cookie plugin (the guard prevents duplicate-decoration errors).
  // -------------------------------------------------------------------------
  if (!fastify.hasDecorator('parseCookie')) {
    await fastify.register(fastifyCookie);
  }

  // -------------------------------------------------------------------------
  // 0b. Validate SESSION_SECRET before doing anything else.
  //
  //    An absent or short secret would allow session cookie forgery, so we
  //    fail fast at startup rather than silently continuing with a weak key.
  // -------------------------------------------------------------------------
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable must be set and at least 32 characters long.',
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // -------------------------------------------------------------------------
  // 1. Reuse the shared SQLite connection from db/index.js.
  //
  //    Using a single connection avoids write-locking conflicts that can occur
  //    when two Database instances open the same file concurrently.
  // -------------------------------------------------------------------------
  const store = createSQLiteStore(sqlite);

  // -------------------------------------------------------------------------
  // 2. Register @fastify/session.
  //
  //    `secure: false` is intentional: we add the `Secure` flag ourselves in
  //    the onSend hook so that it appears in the Set-Cookie header regardless
  //    of the transport protocol (important for tests that use app.inject()
  //    over plain HTTP).  Setting `secure: true` here causes @fastify/session
  //    to suppress the cookie entirely on non-HTTPS connections.
  //
  //    `maxAge` is set in milliseconds as required by @fastify/session v11
  //    (it stores the value internally as ms and converts to an Expires date).
  //    The `Max-Age` attribute (in seconds) is added separately in the onSend
  //    hook because @fastify/session's Cookie.toJSON() does not include a
  //    `maxAge` key that @fastify/cookie could forward to cookie.serialize().
  // -------------------------------------------------------------------------
  await fastify.register(fastifySession, {
    secret,
    cookieName: COOKIE_NAME,
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      maxAge: SESSION_MAX_AGE_MS, // ms — used for internal Expires calculation
      path: '/',
    },
    saveUninitialized: false,
  });

  // -------------------------------------------------------------------------
  // 3. Post-process Set-Cookie headers.
  //
  //    Add `Max-Age=604800` (always) and `Secure` (production only) to any
  //    Set-Cookie header that carries the session cookie.
  //
  //    We must removeHeader() first and then re-set, because reply.header()
  //    for `set-cookie` appends instead of replacing.
  // -------------------------------------------------------------------------
  fastify.addHook('onSend', async (_request, reply, payload) => {
    const rawHeader = reply.getHeader('set-cookie');
    if (!rawHeader) {
      return payload;
    }

    reply.removeHeader('set-cookie');

    if (Array.isArray(rawHeader)) {
      for (const val of rawHeader) {
        reply.header('set-cookie', transformSessionCookie(val, isProduction));
      }
    } else {
      reply.header(
        'set-cookie',
        transformSessionCookie(rawHeader, isProduction),
      );
    }

    return payload;
  });

  // -------------------------------------------------------------------------
  // 4. Add `delete()` alias for `destroy()` on every session object.
  //
  //    The auth route layer calls `request.session.delete()` on logout.
  //    @fastify/session only provides `destroy()`, so we add the alias via
  //    a preHandler hook (which runs after session hydration in onRequest).
  // -------------------------------------------------------------------------
  fastify.addHook('preHandler', (request, _reply, done) => {
    if (request.session && typeof request.session.delete !== 'function') {
      request.session.delete = function deleteAlias(callback) {
        return this.destroy(callback);
      };
    }
    done();
  });
}

export default fp(sessionPlugin, {
  name: 'session',
  // @fastify/cookie is now registered internally — no external dependency
  // declaration needed.
});
