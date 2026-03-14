import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { users } from './schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../aiflomo.db');

const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);

/**
 * Select user(s) by email.
 * @param {string} email - The email to search for
 * @returns {Promise<Array>} Array of matching user records
 */
export async function select(email) {
  return db.select().from(users).where(eq(users.email, email));
}

/**
 * Select user(s) by id.
 * @param {string} id - The user ID to search for
 * @returns {Promise<Array>} Array of matching user records
 */
export async function selectById(id) {
  return db.select().from(users).where(eq(users.id, id));
}

/**
 * Insert a new user into the database.
 * @param {object} userData - User data to insert
 * @returns {Promise<Array>} The inserted user record(s)
 */
export async function insert(userData) {
  return db.insert(users).values(userData);
}

/**
 * Update a user record.
 * @param {string} id - User ID to update
 * @param {object} data - Fields to update
 * @returns {Promise<Array>} Updated record(s)
 */
export async function update(id, data) {
  return db.update(users).set(data).where(eq(users.id, id));
}

export { db as drizzleDb, users, eq };
