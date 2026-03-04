import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });
import * as schema from './schema.js';

const sqlite = new Database(process.env.DB_PATH ?? './data/aiflomo.db');
export const db = drizzle(sqlite, { schema });
