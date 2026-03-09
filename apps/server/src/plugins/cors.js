import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

// CORS 插件配置
export const corsPlugin = fp(async (fastify) => {
  await fastify.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8082',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
});
