/**
 * Fastify Session Plugin
 *
 * Registers @fastify/session with a SQLite-backed session store (connect-sqlite3).
 * The sessions table is automatically created and managed by connect-sqlite3.
 *
 * Cookie configuration:
 *   - httpOnly: true    — prevents XSS cookie theft
 *   - sameSite: strict  — prevents CSRF attacks
 *   - secure: true      — HTTPS only in production
 *   - maxAge: 7 days    — session expiry
 */
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

async function sessionPlugin(fastify) {
  // Build SQLite session store using connect-sqlite3
  let store;
  try {
    const ConnectSQLite3 = (await import('connect-sqlite3')).default;
    // connect-sqlite3 requires a session object with a Store constructor
    const SQLiteStore = ConnectSQLite3({ Store: class Store {} });
    const dbPath = process.env.DB_PATH || './data/aiflomo.db';
    const dbDir = dbPath.split('/').slice(0, -1).join('/') || '.';
    const dbFile = dbPath.split('/').pop();
    store = new SQLiteStore({ db: dbFile, dir: dbDir });
  } catch (err) {
    fastify.log.warn('connect-sqlite3 not available, using in-memory session store:', err.message);
    store = undefined;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'aiflomo-dev-secret-change-in-production',
    cookieName: 'connect.sid',
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: SESSION_MAX_AGE,
    },
    saveUninitialized: false,
  };

  if (store) {
    sessionOptions.store = store;
  }

  // @fastify/cookie must be registered before @fastify/session
  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, sessionOptions);
}

export default fp(sessionPlugin, {
  name: 'session',
});
