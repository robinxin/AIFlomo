import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';

export const sessionPlugin = fp(async (fastify) => {
  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
});
