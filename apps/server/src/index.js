import Fastify from 'fastify';
import { db } from './db/index.js';

const fastify = Fastify({
  logger: true,
});

fastify.get('/health', async () => {
  return { status: 'ok', message: 'AIFlomo server is running' };
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
