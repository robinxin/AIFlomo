/**
 * migrate.js — 执行 Drizzle 数据库迁移
 *
 * 用法：node src/db/migrate.js
 * 脚本读取 src/db/migrations/ 下的 SQL 迁移文件，按序执行到目标数据库。
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrationsFolder = path.join(__dirname, 'migrations');

console.log(`Running migrations from: ${migrationsFolder}`);
console.log(`Target database: ${process.env.DB_PATH || 'data/aiflomo.db'}`);

migrate(db, { migrationsFolder });

console.log('Migration completed successfully.');

sqlite.close();
