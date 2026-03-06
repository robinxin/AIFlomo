import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

class SQLiteSessionStore {
  constructor(database) {
    this.db = database;
  }

  async set(sessionId, session, callback) {
    try {
      const expiresAt = Date.now() + (session.cookie?.maxAge || 7 * 24 * 60 * 60 * 1000);
      const userId = session.userId || null;

      if (!userId) {
        return callback();
      }

      await this.db
        .insert(sessions)
        .values({
          id: sessionId,
          userId,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: sessions.id,
          set: {
            userId,
            expiresAt,
          },
        });

      callback();
    } catch (error) {
      callback(error);
    }
  }

  async get(sessionId, callback) {
    try {
      const [session] = await this.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (!session) {
        return callback(null, null);
      }

      if (session.expiresAt < Date.now()) {
        await this.destroy(sessionId, () => {});
        return callback(null, null);
      }

      callback(null, { userId: session.userId });
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sessionId, callback) {
    try {
      await this.db
        .delete(sessions)
        .where(eq(sessions.id, sessionId));

      callback();
    } catch (error) {
      callback(error);
    }
  }
}

export const sessionPlugin = fp(async (fastify) => {
  await fastify.register(fastifyCookie);

  const sessionStore = new SQLiteSessionStore(db);
  const sessionSecret = process.env.SESSION_SECRET || 'aiflomo-default-secret-change-in-production-32-chars';

  await fastify.register(fastifySession, {
    secret: sessionSecret,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    store: sessionStore,
    saveUninitialized: false,
  });
});
