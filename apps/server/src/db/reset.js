import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../aiflomo.db');

const sqlite = new Database(DB_PATH);

// Drop all tables (idempotent reset)
sqlite.exec('DROP TABLE IF EXISTS users;');
sqlite.exec('DROP TABLE IF EXISTS sessions;');

console.log('Database reset completed');
sqlite.close();
