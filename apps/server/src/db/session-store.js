/**
 * session-store.js — 基于 sql.js 的 Session 存储（供 @fastify/session 使用）
 * 实现 connect session store 接口：get(sid, cb), set(sid, session, cb), destroy(sid, cb)
 */
import { getSqlite, persistDb } from './client.js';

export function createSqlJsStore() {
  return {
    get(sid, callback) {
      getSqlite().then((sqlite) => {
        try {
          const stmt = sqlite.prepare('SELECT session FROM sessions WHERE sid = ? AND (expires IS NULL OR expires > ?)');
          stmt.bind([sid, Date.now()]);
          const row = stmt.step() ? stmt.getAsObject() : null;
          stmt.free();
          const session = row?.session ? JSON.parse(row.session) : null;
          callback(null, session);
        } catch (e) {
          callback(e, null);
        }
      }).catch((e) => callback(e, null));
    },

    set(sid, session, callback) {
      const data = JSON.stringify(session);
      const expires = session?.cookie?.expires ? new Date(session.cookie.expires).getTime() : null;
      getSqlite().then((sqlite) => {
        try {
          sqlite.run('INSERT OR REPLACE INTO sessions (sid, session, expires) VALUES (?, ?, ?)', [sid, data, expires]);
          persistDb();
          callback(null);
        } catch (e) {
          callback(e);
        }
      }).catch(callback);
    },

    destroy(sid, callback) {
      getSqlite().then((sqlite) => {
        try {
          sqlite.run('DELETE FROM sessions WHERE sid = ?', [sid]);
          persistDb();
          callback(null);
        } catch (e) {
          callback(e);
        }
      }).catch(callback);
    },
  };
}
