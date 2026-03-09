import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePassword } from '../lib/password.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';

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
  // POST /api/auth/register
  fastify.post('/register', {
    schema: registerSchema,
  }, async (request, reply) => {
    const { email, nickname, password } = request.body;

    // Convert email to lowercase to prevent duplicate registrations
    const emailLower = email.toLowerCase();

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictError('该邮箱已被注册');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: emailLower,
        nickname,
        passwordHash,
      })
      .returning();

    // Create session (7 days expiry)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const [session] = await db
      .insert(sessions)
      .values({
        userId: newUser.id,
        expiresAt,
      })
      .returning();

    // Set session cookie
    request.session.userId = newUser.id;
    request.session.sessionId = session.id;

    // Return user data (without passwordHash)
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

  // POST /api/auth/login
  fastify.post('/login', {
    schema: loginSchema,
  }, async (request, reply) => {
    const { email, password } = request.body;

    // Convert email to lowercase
    const emailLower = email.toLowerCase();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    // User not found - return generic error message (don't reveal "email not exists")
    if (!user) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    // Verify password using bcrypt
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    // Password mismatch - return generic error message
    if (!isPasswordValid) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    // Create new session (7 days expiry)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const [session] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        expiresAt,
      })
      .returning();

    // Set session in cookie
    request.session.userId = user.id;
    request.session.sessionId = session.id;

    // Return user data (without passwordHash)
    return reply.status(200).send({
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
      },
      message: '登录成功',
    });
  });
}

export { authRoutes };
