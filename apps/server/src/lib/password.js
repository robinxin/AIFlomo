/**
 * Password hashing and comparison utilities using bcrypt.
 *
 * Security notes:
 *   - bcrypt silently truncates input to 72 bytes. To prevent authentication
 *     bypass via long passwords with a shared 72-byte prefix, all passwords are
 *     pre-hashed with SHA-256 before being passed to bcrypt. SHA-256 produces a
 *     64-character hex digest, well within bcrypt's 72-byte limit.
 *   - This also neutralises the UTF-16 length measurement bypass: regardless of
 *     how many bytes a Unicode password occupies, the digest is always 64 bytes.
 *
 * ARCHITECTURAL DECISION — SHA-256 prehash strategy
 * --------------------------------------------------
 * Introduced: 2026-03-12 (feat/tdd-codegen-28)
 *
 * All passwords are run through SHA-256 before being passed to bcrypt.
 * This means the bcrypt hash stored in the database is computed over the
 * SHA-256 hex digest of the plaintext password, NOT over the plaintext itself.
 *
 * MIGRATION INCOMPATIBILITY WARNING:
 *   Any bcrypt hashes created WITHOUT this SHA-256 prehash step (i.e. hashes
 *   produced by calling bcrypt directly on the plaintext password) are
 *   INCOMPATIBLE with this module. If you have existing users whose password
 *   hashes were stored without prehashing, they will be unable to log in until
 *   their passwords are re-hashed. In that scenario you must:
 *     1. Force a password-reset flow for affected users, OR
 *     2. Detect the old hash format and run a one-time re-hash on next
 *        successful login (re-hash-on-verify migration pattern).
 *
 *   For the current project this is not an issue because the SHA-256 prehash
 *   strategy was introduced before any user data was persisted.
 *
 * Exported functions:
 *   - hashPassword(password)          — hash a plaintext password (salt rounds = 10)
 *   - comparePassword(password, hash) — verify a plaintext password against a bcrypt hash
 */

import { createHash } from 'crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;

/**
 * Pre-hash a plaintext password with SHA-256 so that bcrypt always receives a
 * fixed-length 64-character hex string, preventing the 72-byte truncation issue.
 *
 * @param {string} password - The plaintext password.
 * @returns {string} The SHA-256 hex digest.
 */
function prehash(password) {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

/**
 * Hash a plaintext password with bcrypt (after SHA-256 pre-hashing).
 *
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} The bcrypt hash string.
 * @throws {Error} If the password is not a string or fails length validation.
 */
export async function hashPassword(password) {
  if (typeof password !== 'string') {
    throw new Error(
      `Password must be a string, received: ${typeof password}`,
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters long`,
    );
  }

  return bcrypt.hash(prehash(password), SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 *
 * An oversized password returns `false` rather than throwing to avoid leaking
 * information about whether the input was rejected for length or for mismatch.
 *
 * @param {string} password - The plaintext password to verify.
 * @param {string} hash     - The bcrypt hash to compare against.
 * @returns {Promise<boolean>} True if the password matches the hash, false otherwise.
 * @throws {Error} If either argument is missing, not a string, or the hash format is invalid.
 */
export async function comparePassword(password, hash) {
  if (typeof password !== 'string') {
    throw new Error(
      `Password must be a string, received: ${typeof password}`,
    );
  }

  if (password.length === 0) {
    throw new Error('Password must not be empty');
  }

  if (typeof hash !== 'string') {
    throw new Error(
      `Hash must be a string, received: ${typeof hash}`,
    );
  }

  if (hash.length === 0) {
    throw new Error('Hash must not be an empty string');
  }

  // Validate that the hash has a recognisable bcrypt format ($2a$, $2b$, or $2y$).
  // bcrypt.compare() throws an opaque "data and salt arguments required" error for
  // non-bcrypt strings, so we surface a clearer message proactively.
  const BCRYPT_PREFIX = /^\$2[aby]\$/;
  if (!BCRYPT_PREFIX.test(hash)) {
    throw new Error(
      'Hash does not appear to be a valid bcrypt hash (expected format: $2a$, $2b$, or $2y$)',
    );
  }

  // Length guard: silently return false for oversized passwords instead of
  // throwing, so attackers cannot distinguish "too long" from "wrong password".
  if (password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  return bcrypt.compare(prehash(password), hash);
}
