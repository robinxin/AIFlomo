import { runMigrations } from './src/db/migrate.js';

try {
  await runMigrations();
  console.log('✅ Migration test successful');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
