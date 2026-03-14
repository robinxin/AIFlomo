import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import SQLiteStore from 'connect-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Session store backed by SQLite (same database as app data)
const SqliteSessionStore = SQLiteStore(fastifySession);

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Register Fastify cookie and session plugins.
 * Session is stored in SQLite for persistence across server restarts.
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function registerSession(fastify) {
  const isProduction = process.env.NODE_ENV === 'production';

  const store = new SqliteSessionStore({
    db: 'sessions.db',
    dir: path.join(__dirname, '../../../'),
  });

  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET || 'aiflomo-super-secret-key-change-in-production-min-32chars',
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
    saveUninitialized: false,
  });
}
