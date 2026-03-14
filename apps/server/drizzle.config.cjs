const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'aiflomo.db');

/** @type {import('drizzle-kit').Config} */
module.exports = {
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
};
