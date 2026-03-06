import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
