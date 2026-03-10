import { requireAuth } from '../plugins/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AppError } from '../lib/errors.js';

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      nickname: { type: 'string', minLength: 1, maxLength: 50 },
    },
  },
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
};

export async function authRoutes(fastify) {
  fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
    const { email, password, nickname } = request.body;

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw new AppError(409, '该邮箱已被注册', 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(password);
    const derivedNickname = nickname ?? email.split('@')[0];

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, nickname: derivedNickname })
      .returning({ id: users.id, email: users.email, nickname: users.nickname, createdAt: users.createdAt });

    request.session.userId = user.id;

    return reply.status(201).send({ data: user, message: '注册成功' });
  });

  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = request.body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new AppError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');
    }

    request.session.userId = user.id;

    return reply.send({
      data: { id: user.id, email: user.email, nickname: user.nickname },
      message: '登录成功',
    });
  });

  fastify.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    await request.session.destroy();
    return reply.send({ data: null, message: '已登出' });
  });

  fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.session.userId;

    const [user] = await db
      .select({ id: users.id, email: users.email, nickname: users.nickname, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND');
    }

    return reply.send({ data: user, message: 'ok' });
  });
}
