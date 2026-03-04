import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { comparePassword } from '../lib/password.js';

const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 1, maxLength: 50 },
      password: { type: 'string', minLength: 1 },
    },
  },
};

export async function authRoutes(fastify) {
  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { username, password } = request.body;

    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .then((rows) => rows[0]);

    const isValid = user && await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        data: null,
        error: 'AUTH_FAILED',
        message: '用户名或密码错误',
      });
    }

    request.session.userId = user.id;
    request.session.username = user.username;

    return reply.send({
      data: { id: user.id, username: user.username },
      message: '登录成功',
    });
  });

  fastify.post('/logout', async (request, reply) => {
    await request.session.destroy();
    return reply.send({ data: null, message: '已退出登录' });
  });

  fastify.get('/me', async (request, reply) => {
    if (!request.session.userId) {
      return reply.status(401).send({
        data: null,
        error: 'UNAUTHORIZED',
        message: '请先登录',
      });
    }
    return reply.send({
      data: {
        id: request.session.userId,
        username: request.session.username,
      },
      message: 'ok',
    });
  });
}
