import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

function buildSqliteSessionStore() {
  return {
    get(sid, callback) {
      try {
        const rows = db
          .select()
          .from(sessions)
          .where(eq(sessions.sid, sid))
          .all();

        if (!rows || rows.length === 0) {
          return callback(null, null);
        }

        const row = rows[0];

        if (row.expired && new Date(row.expired) < new Date()) {
          db.delete(sessions).where(eq(sessions.sid, sid)).run();
          return callback(null, null);
        }

        try {
          const sess = JSON.parse(row.sess);
          return callback(null, sess);
        } catch {
          return callback(null, null);
        }
      } catch (err) {
        return callback(err);
      }
    },

    set(sid, sess, callback) {
      try {
        const maxAge = sess.cookie && sess.cookie.maxAge
          ? sess.cookie.maxAge
          : 7 * 24 * 60 * 60 * 1000;

        const expired = new Date(Date.now() + maxAge).toISOString();
        const sessStr = JSON.stringify(sess);

        const existing = db
          .select({ sid: sessions.sid })
          .from(sessions)
          .where(eq(sessions.sid, sid))
          .all();

        if (existing && existing.length > 0) {
          db.update(sessions)
            .set({ sess: sessStr, expired })
            .where(eq(sessions.sid, sid))
            .run();
        } else {
          db.insert(sessions)
            .values({ sid, sess: sessStr, expired })
            .run();
        }

        return callback(null);
      } catch (err) {
        return callback(err);
      }
    },

    destroy(sid, callback) {
      try {
        db.delete(sessions).where(eq(sessions.sid, sid)).run();
        return callback(null);
      } catch (err) {
        return callback(err);
      }
    },
  };
}

export const sessionPlugin = fp(async (fastify) => {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    store: buildSqliteSessionStore(),
    saveUninitialized: false,
  });
});
