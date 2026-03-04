import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });
import { db } from './index.js';
import { users } from './schema.js';
import { hashPassword } from '../lib/password.js';

async function seed() {
  const passwordHash = await hashPassword('666666');

  try {
    await db.insert(users).values({
      username: 'yixiang',
      passwordHash,
    }).onConflictDoNothing();
    console.log('Seed: yixiang user created (or already exists)');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();
