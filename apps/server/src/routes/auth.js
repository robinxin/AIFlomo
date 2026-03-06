import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';
import { requireAuth } from '../plugins/auth.js';

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'agreePolicy'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      nickname: { type: 'string', minLength: 1, maxLength: 50 },
      password: { type: 'string', minLength: 6, maxLength: 128 },
      agreePolicy: { type: 'boolean', const: true },
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

async function authRoutes(fastify) {
  fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
    const { email, nickname, password } = request.body;

    const emailLower = email.toLowerCase();

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: emailLower,
        nickname,
        passwordHash,
      })
      .returning();

    request.session.userId = newUser.id;

    return reply.status(201).send({
      data: {
        id: newUser.id,
        email: newUser.email,
        nickname: newUser.nickname,
        createdAt: newUser.createdAt,
      },
      message: '注册成功',
    });
  });

  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = request.body;
    const emailLower = email.toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    request.session.userId = user.id;

    return reply.send({
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.createdAt,
      },
      message: '登录成功',
    });
  });

  fastify.get('/me', { preHandler: requireAuth }, async (request) => {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, request.session.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('用户不存在');
    }

    return { data: user, message: '获取用户信息成功' };
  });

  fastify.post('/logout', async (request, reply) => {
    await request.session.destroy();
    return reply.send({ data: null, message: '已退出登录' });
  });
}

export { authRoutes };
