export default {
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './data/aiflomo.db',
  },
};
