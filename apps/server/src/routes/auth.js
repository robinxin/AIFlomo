/**
 * Authentication Routes — Fastify Plugin
 *
 * Exposes 4 authentication endpoints under a shared prefix (e.g. /api/auth):
 *   POST /register  — Register a new user account
 *   POST /login     — Authenticate with email + password
 *   POST /logout    — Destroy the current session (requires auth)
 *   GET  /me        — Return current user profile (requires auth)
 *
 * All handlers follow the unified API response format:
 *   Success: { data: <value>, message: <string> }
 *   Failure: { data: null, error: <string>, message: <string> }
 *
 * Security notes:
 *   - Passwords are never stored in plaintext; bcrypt (saltRounds=10) is used
 *   - Session writes happen after successful auth operations only
 *   - Login returns a unified 401 for both wrong email and wrong password
 *     (prevents user-enumeration attacks, FR-007)
 *   - passwordHash is excluded from all API responses
 *   - Input validated via JSON Schema (Fastify's built-in AJV integration)
 */

import fp from 'fastify-plugin';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import db from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 10;

// ── JSON Schema definitions ───────────────────────────────────────────────────

/**
 * Request body schema for POST /register
 * Validated by Fastify's built-in AJV instance.
 */
const registerBodySchema = {
  type: 'object',
  required: ['email', 'nickname', 'password', 'agreedToPrivacy'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
      description: '用户邮箱，用于登录唯一标识，必须符合标准邮箱格式',
    },
    nickname: {
      type: 'string',
      minLength: 2,
      maxLength: 20,
      pattern: '^(?!\\s*$).+',
      description: '用户昵称，2-20 字符，不允许纯空格',
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 20,
      description: '账号密码，8-20 字符',
    },
    agreedToPrivacy: {
      type: 'boolean',
      enum: [true],
      description: '是否同意隐私协议，必须为 true',
    },
  },
};

/**
 * Request body schema for POST /login
 */
const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
      description: '用户邮箱',
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 20,
      description: '账号密码',
    },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Strip sensitive fields from a user record before sending to client.
 * Returns only the fields safe for public consumption.
 *
 * @param {object} user - Raw user row from the database
 * @returns {object} Public-safe user object
 */
function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    createdAt: user.createdAt,
  };
}

// ── Route handlers ─────────────────────────────────────────────────────────────

/**
 * POST /register
 *
 * 1. Validate email uniqueness
 * 2. Hash password with bcrypt (saltRounds=10)
 * 3. Insert user into database
 * 4. Write userId to session
 * 5. Return 201 with public user data
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function registerHandler(request, reply) {
  const { email, nickname, password, agreedToPrivacy } = request.body;

  // agreedToPrivacy is guaranteed true by JSON Schema enum: [true],
  // but we validate it defensively here as well (belt and suspenders).
  if (!agreedToPrivacy) {
    return reply.code(400).send({
      data: null,
      error: '请阅读并同意隐私协议',
      message: '注册失败',
    });
  }

  try {
    // 1. Check email uniqueness
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return reply.code(409).send({
        data: null,
        error: '该邮箱已被注册',
        message: '注册失败',
      });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 3. Build new user record
    const nowMs = Date.now();
    const newUser = {
      id: crypto.randomUUID(),
      email,
      nickname: nickname.trim(),
      passwordHash,
      agreedAt: nowMs,
      createdAt: nowMs,
      updatedAt: nowMs,
    };

    // 4. Insert into database
    await db.insert(users).values(newUser);

    // 5. Write userId to session
    request.session.userId = newUser.id;

    // 6. Return 201 with public user data
    return reply.code(201).send({
      data: toPublicUser(newUser),
      message: '注册成功',
    });
  } catch (err) {
    request.log?.error({ err }, 'register: unexpected error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '注册失败',
    });
  }
}

/**
 * POST /login
 *
 * 1. Find user by email
 * 2. Compare password with bcrypt
 * 3. Write userId to session
 * 4. Return 200 with public user data
 *
 * Returns unified 401 for both "user not found" and "wrong password"
 * to prevent user-enumeration attacks (FR-007).
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function loginHandler(request, reply) {
  const { email, password } = request.body;

  try {
    // 1. Find user by email
    const rows = await db.select().from(users).where(eq(users.email, email));
    const user = rows[0];

    if (!user) {
      return reply.code(401).send({
        data: null,
        error: '邮箱或密码错误，请重试',
        message: '登录失败',
      });
    }

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return reply.code(401).send({
        data: null,
        error: '邮箱或密码错误，请重试',
        message: '登录失败',
      });
    }

    // 3. Write userId to session
    request.session.userId = user.id;

    // 4. Return 200 with public user data
    return reply.code(200).send({
      data: toPublicUser(user),
      message: '登录成功',
    });
  } catch (err) {
    request.log?.error({ err }, 'login: unexpected error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '登录失败',
    });
  }
}

/**
 * POST /logout
 * preHandler: [requireAuth]
 *
 * Destroys the current session so the user is no longer authenticated.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function logoutHandler(request, reply) {
  try {
    await request.session.destroy();
    return reply.code(200).send({
      data: null,
      message: '已成功登出',
    });
  } catch (err) {
    request.log?.error({ err }, 'logout: session destroy error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '登出失败',
    });
  }
}

/**
 * GET /me
 * preHandler: [requireAuth]
 *
 * 1. Read userId from session
 * 2. Query user from database
 * 3. Return 200 with public user data
 *
 * If the userId in the session does not correspond to any user record
 * (e.g. account was deleted), the session is destroyed and 401 is returned.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function getMeHandler(request, reply) {
  const { userId } = request.session;

  try {
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const user = rows[0];

    if (!user) {
      // Stale session: destroy it so the client gets a clean state
      await request.session.destroy();
      return reply.code(401).send({
        data: null,
        error: '用户不存在，请重新登录',
        message: '获取用户信息失败',
      });
    }

    return reply.code(200).send({
      data: toPublicUser(user),
      message: '获取用户信息成功',
    });
  } catch (err) {
    request.log?.error({ err }, 'me: unexpected error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '获取用户信息失败',
    });
  }
}

// ── Plugin registration ────────────────────────────────────────────────────────

/**
 * Fastify plugin that registers all authentication routes.
 *
 * Register in your main Fastify instance with a prefix:
 *   fastify.register(authRoutes, { prefix: '/api/auth' })
 *
 * Routes exposed (relative to prefix):
 *   POST /register
 *   POST /login
 *   POST /logout  (requires auth)
 *   GET  /me      (requires auth)
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function authRoutes(fastify) {
  // Custom error handler — normalises all errors (including JSON Schema validation
  // errors from Fastify's AJV integration) into the unified API response format:
  //   { data: null, error: <string>, message: <string> }
  fastify.setErrorHandler((err, request, reply) => {
    // JSON Schema validation error (Fastify AJV)
    if (err.validation) {
      return reply.code(400).send({
        data: null,
        error: '请求参数格式错误',
        message: err.message,
      });
    }

    // Propagate errors with an explicit statusCode set by the handler
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({
        data: null,
        error: err.message,
        message: err.message,
      });
    }

    // Fallback: unexpected server error
    request.log?.error({ err }, 'unhandled error in auth routes');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '服务器内部错误',
    });
  });

  // POST /register — new user registration
  fastify.post('/register', {
    schema: { body: registerBodySchema },
    handler: registerHandler,
  });

  // POST /login — authenticate existing user
  fastify.post('/login', {
    schema: { body: loginBodySchema },
    handler: loginHandler,
  });

  // POST /logout — destroy session (authentication required)
  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: logoutHandler,
  });

  // GET /me — get current user profile (authentication required)
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: getMeHandler,
  });
}

export default fp(authRoutes, {
  name: 'auth-routes',
  fastify: '>=4.0.0',
});
