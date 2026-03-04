import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

export const corsPlugin = fp(async (fastify) => {
  await fastify.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:8081',
    credentials: true,
  });
});
