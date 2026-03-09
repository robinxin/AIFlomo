import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password using bcrypt
 * @param {string} plainPassword - The plain text password to hash
 * @returns {Promise<string>} The hashed password
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} plainPassword - The plain text password
 * @param {string} passwordHash - The hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
export async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
