import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import { SqliteStore } from '@mgcrea/fastify-session-sqlite-store';
import Database from 'better-sqlite3';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export async function sessionPlugin(fastify) {
  const sessionDb = new Database(process.env.DB_PATH ?? './data/aiflomo.db');
  const store = new SqliteStore({ database: sessionDb });

  await fastify.register(fastifyCookie);

  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET,
    store,
    cookie: {
      maxAge: SEVEN_DAYS,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    saveUninitialized: false,
  });
}
