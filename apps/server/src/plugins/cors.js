import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

export const corsPlugin = fp(async (fastify) => {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:8081';

  await fastify.register(fastifyCors, {
    origin: corsOrigin,
    credentials: true,
  });
});
