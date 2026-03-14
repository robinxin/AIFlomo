import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return await bcrypt.compare(plainPassword, passwordHash);
}
