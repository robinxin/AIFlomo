/**
 * reset.js — 清空数据库（幂等）
 *
 * 用法：node src/db/reset.js
 * 删除并重建数据库文件，适用于测试环境数据重置。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'aiflomo.db');

// 删除主数据库文件及 WAL 日志文件（如存在）
for (const suffix of ['', '-wal', '-shm']) {
  const filePath = dbPath + suffix;
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
    console.log(`Deleted: ${filePath}`);
  }
}

console.log('Database reset completed.');
