/**
 * migrate.js — 执行数据库迁移（sql.js：启动时 client 已执行 migrations 目录下 SQL）
 *
 * 用法：node src/db/migrate.js
 * 本脚本仅触发 client 初始化（会执行 migrations），然后关闭连接并持久化。
 */
import { getSqlite, closeDb } from './client.js';

console.log('Running migrations (via client init)...');
console.log('Target database:', process.env.DB_PATH || 'data/aiflomo.db');

await getSqlite();
closeDb();

console.log('Migration completed successfully.');
