import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import { ConflictError } from '../lib/errors.js';

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

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const [session] = await db
      .insert(sessions)
      .values({
        userId: newUser.id,
        expiresAt,
      })
      .returning();

    request.session.userId = newUser.id;
    request.session.sessionId = session.id;

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
}

export { authRoutes };
