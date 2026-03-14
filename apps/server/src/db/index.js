/**
 * db/index.js — DB 访问层公共入口
 *
 * 职责：
 *   - 将 Drizzle ORM 实例（client.js）作为统一出口暴露给路由层
 *   - 同时导出 schema 中的表定义，便于路由层直接引用
 *   - 保持接口稳定，使路由层单测可通过 jest.mock('../src/db/index.js') 替换整个模块
 *
 * 路由层调用示例：
 *   import { db } from '../db/index.js';
 *   import { users } from '../db/index.js';
 *
 *   // SELECT
 *   const rows = await db.select().from(users).where(eq(users.email, email));
 *
 *   // INSERT
 *   await db.insert(users).values({ id, email, nickname, ... });
 *
 *   // UPDATE
 *   await db.update(users).set({ updatedAt: Date.now() }).where(eq(users.id, id));
 *
 * 单测 mock 约定：
 *   jest.mock('../src/db/index.js', () => ({
 *     db: {
 *       select: jest.fn(),
 *       insert: jest.fn(),
 *       update: jest.fn(),
 *       delete: jest.fn(),
 *     },
 *     users: {},
 *   }));
 */
export { db, getSqlite, closeDb } from './client.js';
export { users } from './schema.js';
