import { unlinkSync, existsSync } from 'fs';

const DB_PATH = process.env.DB_PATH ?? './data/aiflomo.db';

function resetDatabase() {
  const files = [DB_PATH, `${DB_PATH}-shm`, `${DB_PATH}-wal`];
  for (const file of files) {
    if (existsSync(file)) {
      unlinkSync(file);
      console.log(`Deleted: ${file}`);
    }
  }
  console.log('Database reset complete.');
}

resetDatabase();
