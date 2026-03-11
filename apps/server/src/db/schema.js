/**
 * Drizzle ORM schema definitions for AIFlomo
 *
 * Tables:
 *   users    — registered user accounts (email + bcrypt password hash)
 *   sessions — active login sessions linked to a user (expires after 7 days)
 *
 * Design reference:
 *   specs/active/28-feature-account-registration-login-2-design.md § 2.1
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

/**
 * Stores registered user accounts.
 *
 * - id          : UUID v4 primary key, auto-generated on insert
 * - email       : unique email address (stored lower-case before insert)
 * - nickname    : display name, 1–50 characters
 * - passwordHash: bcrypt hash of the user's password (never plain-text)
 * - createdAt   : row creation timestamp (SQLite CURRENT_TIMESTAMP)
 * - updatedAt   : last update timestamp  (SQLite CURRENT_TIMESTAMP)
 */
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  email: text('email').notNull().unique(),

  nickname: text('nickname').notNull(),

  passwordHash: text('password_hash').notNull(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),

  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

/**
 * Stores active login sessions.
 *
 * - id        : UUID v4 primary key; used as the Cookie value
 * - userId    : foreign key → users.id (cascade delete removes sessions when
 *               the linked user account is removed)
 * - expiresAt : Unix timestamp in milliseconds; default 7 days from creation
 * - createdAt : row creation timestamp (SQLite CURRENT_TIMESTAMP)
 */
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Unix timestamp (milliseconds); auth middleware rejects expired sessions
  expiresAt: integer('expires_at').notNull(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
