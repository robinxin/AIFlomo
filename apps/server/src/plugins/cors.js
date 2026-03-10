import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

export const corsPlugin = fp(async (fastify) => {
  const rawOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:8081';

  const allowedOrigins = rawOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
});
