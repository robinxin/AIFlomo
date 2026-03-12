import 'dotenv/config';
import Fastify from 'fastify';

/**
 * AIFlomo 后端服务器入口文件
 * 使用 Fastify 框架
 */

const app = Fastify({
  logger: true,
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export default app;
