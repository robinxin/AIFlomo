import { requireAuth } from '../plugins/auth.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function authRoutes(fastify) {
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'nickname', 'agreePrivacy'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 20,
            pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*?&]+$',
          },
          nickname: { type: 'string', minLength: 1, maxLength: 20 },
          agreePrivacy: { type: 'boolean', const: true },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, nickname } = request.body;
    const normalizedEmail = email.toLowerCase();

    try {
      const passwordHash = await hashPassword(password);
      const [newUser] = await db.insert(users)
        .values({ email: normalizedEmail, passwordHash, nickname })
        .returning();

      request.session.userId = newUser.id;

      const { passwordHash: _, ...userData } = newUser;
      return reply.status(201).send({ data: userData, message: '注册成功' });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT' || err.message.includes('UNIQUE constraint failed')) {
        return reply.status(409).send({
          data: null,
          error: 'EMAIL_EXISTS',
          message: '该邮箱已注册,请直接登录',
        });
      }
      throw err;
    }
  });

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;
    const normalizedEmail = email.toLowerCase();

    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return reply.status(401).send({
        data: null,
        error: 'INVALID_CREDENTIALS',
        message: '邮箱或密码错误',
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        data: null,
        error: 'INVALID_CREDENTIALS',
        message: '邮箱或密码错误',
      });
    }

    const now = new Date().toISOString();
    await db.update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, user.id));

    request.session.userId = user.id;

    const { passwordHash: _, ...userData } = { ...user, lastLoginAt: now };
    return reply.send({ data: userData, message: '登录成功' });
  });

  fastify.post('/logout', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    request.session.destroy();
    return reply.status(204).send();
  });

  fastify.get('/me', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, request.session.userId))
      .limit(1);

    if (!user) {
      return reply.status(401).send({
        data: null,
        error: 'Unauthorized',
        message: '请先登录',
      });
    }

    const { passwordHash: _, ...userData } = user;
    return reply.send({ data: userData, message: 'ok' });
  });
}
