import 'dotenv/config';

/**
 * Drizzle Kit 配置
 * 用于生成迁移文件和执行数据库迁移
 */
export default {
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './aiflomo.db',
  },
  verbose: true,
  strict: true,
};
