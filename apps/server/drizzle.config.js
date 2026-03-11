/**
 * Drizzle Kit configuration for AIFlomo server.
 *
 * Used by the following package.json scripts:
 *   pnpm db:generate  →  drizzle-kit generate
 *   pnpm db:migrate   →  node src/db/migrate.js  (uses same DB_PATH)
 *
 * Configuration reference:
 *   specs/active/28-feature-account-registration-login-2-design.md § 2
 *
 * Environment variables:
 *   DB_PATH  — path to the SQLite database file
 *              (default: ./data/aiflomo.db)
 *              Must match the fallback used in src/db/index.js.
 */

/** @type {import('drizzle-kit').Config} */
export default {
  // SQLite dialect — matches the better-sqlite3 driver used in src/db/index.js
  dialect: 'sqlite',

  // Schema source — single file exporting all Drizzle table definitions
  schema: './src/db/schema.js',

  // Output directory for generated migration SQL files
  out: './src/db/migrations',

  dbCredentials: {
    // Honour DB_PATH when set (CI, staging, production); fall back to the
    // same default path that src/db/index.js uses so migrations always
    // target the correct database file.
    url: process.env.DB_PATH ?? './data/aiflomo.db',
  },
};
