/**
 * Fastify Session Plugin
 *
 * Registers @fastify/session with a custom SQLite-backed session store.
 * The sessions table is auto-created and managed by SQLiteSessionStore —
 * it is NOT part of the Drizzle schema.
 *
 * Cookie settings:
 *   httpOnly   : true
 *   sameSite   : 'strict'
 *   secure     : true only when NODE_ENV === 'production'
 *   maxAge     : 7 days (in milliseconds)
 */

import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_TABLE = 'sessions';

// ── SQLiteSessionStore ────────────────────────────────────────────────────────

/**
 * A synchronous (blocking) SQLite session store compatible with
 * the @fastify/session store interface:
 *   set(sessionId, session, callback)
 *   get(sessionId, callback)
 *   destroy(sessionId, callback)
 *   touch(sessionId, session, callback)  [optional]
 */
export class SQLiteSessionStore {
  /**
   * @param {object} options
   * @param {import('better-sqlite3').Database} options.db  - An open better-sqlite3 instance
   * @param {string} [options.table='sessions']             - Table name for sessions
   * @param {number} [options.ttl]                          - Default TTL in ms (fallback when cookie.maxAge is absent)
   */
  constructor(options = {}) {
    if (!options.db) {
      throw new Error('SQLiteSessionStore requires a "db" option (better-sqlite3 instance)');
    }

    this.db = options.db;
    this.table = options.table ?? DEFAULT_TABLE;
    this.ttl = options.ttl ?? SEVEN_DAYS_MS;

    this._init();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Create the sessions table if it does not already exist.
   * Schema:
   *   sid        TEXT PRIMARY KEY  - session identifier
   *   sess       TEXT NOT NULL     - JSON-serialised session payload
   *   expired_at INTEGER NOT NULL  - Unix millisecond expiry timestamp
   */
  _init() {
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${this.table} (
          sid        TEXT    PRIMARY KEY,
          sess       TEXT    NOT NULL,
          expired_at INTEGER NOT NULL
        )`
      )
      .run();
  }

  /**
   * Calculate expiry timestamp from session cookie.maxAge or fallback TTL.
   * @param {object} session
   * @returns {number} Unix ms timestamp
   */
  _expiryFor(session) {
    const maxAge =
      session?.cookie?.maxAge ??
      session?.cookie?.originalMaxAge ??
      this.ttl;
    return Date.now() + maxAge;
  }

  // ── Store interface ────────────────────────────────────────────────────────

  /**
   * Persist (insert or replace) a session.
   * @param {string}   sessionId
   * @param {object}   session
   * @param {Function} callback  (err?) => void
   */
  set(sessionId, session, callback) {
    try {
      const expiredAt = this._expiryFor(session);
      this.db
        .prepare(
          `INSERT INTO ${this.table} (sid, sess, expired_at)
           VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired_at = excluded.expired_at`
        )
        .run(sessionId, JSON.stringify(session), expiredAt);
      callback(undefined);
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Retrieve a session by its ID.
   * Returns null when the session is not found or has expired.
   * @param {string}   sessionId
   * @param {Function} callback  (err, session|null) => void
   */
  get(sessionId, callback) {
    try {
      const row = this.db
        .prepare(
          `SELECT sess, expired_at FROM ${this.table} WHERE sid = ?`
        )
        .get(sessionId);

      if (!row) {
        return callback(null, null);
      }

      // Treat expired sessions as non-existent
      if (row.expired_at <= Date.now()) {
        return callback(null, null);
      }

      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err, null);
    }
  }

  /**
   * Delete a session by its ID.
   * @param {string}   sessionId
   * @param {Function} callback  (err?) => void
   */
  destroy(sessionId, callback) {
    try {
      this.db
        .prepare(`DELETE FROM ${this.table} WHERE sid = ?`)
        .run(sessionId);
      callback(undefined);
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Reset the TTL on an existing session (keep-alive on activity).
   * @param {string}   sessionId
   * @param {object}   session
   * @param {Function} callback  (err?) => void
   */
  touch(sessionId, session, callback) {
    try {
      const expiredAt = this._expiryFor(session);
      this.db
        .prepare(
          `UPDATE ${this.table} SET expired_at = ? WHERE sid = ?`
        )
        .run(expiredAt, sessionId);
      callback(undefined);
    } catch (err) {
      callback(err);
    }
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} options
 * @param {string} options.secret              - Session signing secret (min 32 chars)
 * @param {import('better-sqlite3').Database} [options.db]  - SQLite db instance; if omitted a file-based DB is opened
 * @param {object} [options.cookieOptions]     - Override cookie options (for testing)
 */
async function sessionPlugin(fastify, options) {
  const {
    secret = process.env.SESSION_SECRET,
    db,
    cookieOptions = {},
  } = options;

  if (!secret) {
    throw new Error(
      'Session plugin requires a "secret" option or SESSION_SECRET environment variable'
    );
  }

  // Resolve or create the SQLite database instance.
  // If the caller provides an open better-sqlite3 Database, use it directly
  // (common in tests). Otherwise open the application database file.
  const database = db ?? new Database(process.env.DATABASE_PATH ?? 'aiflomo.db');

  // Build the SQLite-backed session store
  const store = new SQLiteSessionStore({ db: database });

  // Register @fastify/cookie (required by @fastify/session)
  await fastify.register(fastifyCookie);

  // Determine secure flag from environment
  const isProduction = process.env.NODE_ENV === 'production';

  // Register @fastify/session
  await fastify.register(fastifySession, {
    secret,
    store,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: cookieOptions.secure ?? isProduction,
      maxAge: SEVEN_DAYS_MS,
      ...cookieOptions,
    },
  });
}

export default fp(sessionPlugin, {
  name: 'session',
  fastify: '>=4.0.0',
});
