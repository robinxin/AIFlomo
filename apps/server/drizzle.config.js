import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DB_PATH ?? './data/aiflomo.db',
  },
});
