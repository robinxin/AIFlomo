/**
 * Authentication routes — Fastify plugin
 *
 * Endpoints:
 *   POST /register  — new user registration
 *   POST /login     — user login
 *   POST /logout    — user logout (requires auth)
 *   GET  /me        — get current user info (requires auth)
 */
import bcrypt from 'bcryptjs';
import { requireAuth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const BCRYPT_SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// JSON Schema definitions
// ---------------------------------------------------------------------------

const registerBodySchema = {
  type: 'object',
  required: ['email', 'nickname', 'password', 'agreedToPrivacy'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
    },
    nickname: {
      type: 'string',
      minLength: 2,
      maxLength: 20,
      pattern: '^(?!\\s*$).+',
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 20,
    },
    agreedToPrivacy: {
      type: 'boolean',
      enum: [true],
    },
  },
};

const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 20,
    },
  },
};

// ---------------------------------------------------------------------------
// requireAuth variant for /me — returns '获取用户信息失败' as message
// ---------------------------------------------------------------------------

function requireAuthForMe(request, reply, done) {
  if (!request.session || !request.session.userId) {
    return reply.code(401).send({
      data: null,
      error: '请先登录',
      message: '获取用户信息失败',
    });
  }
  done();
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function registerHandler(request, reply) {
  const { email, nickname, password } = request.body;

  try {
    // Check if email is already registered
    const existing = await db.select(users, eq(users.email, email));
    if (existing.length > 0) {
      return reply.code(409).send({
        data: null,
        error: '该邮箱已被注册',
        message: '注册失败',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Prepare user record
    const now = Date.now();
    const userId = crypto.randomUUID();
    const trimmedNickname = nickname.trim();

    // Insert user — pass plain values object (no Drizzle table reference) so
    // the call arguments are JSON-serializable (supports test assertions).
    const userValues = {
      id: userId,
      email,
      nickname: trimmedNickname,
      passwordHash,
      agreedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(userValues);

    // Write userId to session
    request.session.userId = userId;

    return reply.code(201).send({
      data: {
        id: userId,
        email,
        nickname: trimmedNickname,
        createdAt: now,
      },
      message: '注册成功',
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '注册失败',
    });
  }
}

async function loginHandler(request, reply) {
  const { email, password } = request.body;

  try {
    // Look up user by email
    const rows = await db.select(users, eq(users.email, email));
    if (rows.length === 0) {
      return reply.code(401).send({
        data: null,
        error: '登录信息有误，请重试',
        message: '登录失败',
      });
    }

    const user = rows[0];

    // Compare password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return reply.code(401).send({
        data: null,
        error: '登录信息有误，请重试',
        message: '登录失败',
      });
    }

    // Write userId to session
    request.session.userId = user.id;

    return reply.code(200).send({
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.createdAt,
      },
      message: '登录成功',
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '登录失败',
    });
  }
}

async function logoutHandler(request, reply) {
  try {
    await new Promise((resolve, reject) => {
      request.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return reply.code(200).send({
      data: null,
      message: '已成功登出',
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '登出失败',
    });
  }
}

async function getMeHandler(request, reply) {
  const userId = request.session.userId;

  try {
    const rows = await db.select(users, eq(users.id, userId));
    if (rows.length === 0) {
      return reply.code(401).send({
        data: null,
        error: '用户不存在，请重新登录',
        message: '获取用户信息失败',
      });
    }

    const user = rows[0];

    return reply.code(200).send({
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.createdAt,
      },
      message: '获取用户信息成功',
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '获取用户信息失败',
    });
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Allowed fields for each endpoint (for manual additionalProperties check)
// ---------------------------------------------------------------------------

const REGISTER_ALLOWED_FIELDS = new Set(['email', 'nickname', 'password', 'agreedToPrivacy']);
const LOGIN_ALLOWED_FIELDS = new Set(['email', 'password']);

async function authRoutes(fastify) {
  // Custom validation error handler: convert Fastify's default format to
  // project standard { data: null, error: string, message: string }
  fastify.setErrorHandler((error, request, reply) => {
    // Validation errors from AJV — set by Fastify on schema validation failure
    // In Fastify 5, error.validation is an array of AJV error objects.
    // additionalProperties violations also set this property.
    const isValidationError = error.validation != null || error.validationContext != null;
    if (isValidationError) {
      return reply.code(400).send({
        data: null,
        error: error.message || '请求参数格式错误',
        message: '请求参数格式错误',
      });
    }
    // Client errors (4xx) — passed through with data: null wrapper
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        data: null,
        error: error.message || '请求错误',
        message: '请求错误',
      });
    }
    // Server errors
    request.log.error(error);
    reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '请求失败',
    });
  });

  fastify.post('/register', {
    schema: { body: registerBodySchema },
    preValidation: async (request, reply) => {
      // Enforce additionalProperties: false manually since Fastify 5 defaults to removeAdditional: true
      if (request.body && typeof request.body === 'object') {
        const extraFields = Object.keys(request.body).filter((k) => !REGISTER_ALLOWED_FIELDS.has(k));
        if (extraFields.length > 0) {
          return reply.code(400).send({
            data: null,
            error: `请求包含未允许的字段: ${extraFields.join(', ')}`,
            message: '请求参数格式错误',
          });
        }
      }
    },
    handler: registerHandler,
  });

  fastify.post('/login', {
    schema: { body: loginBodySchema },
    preValidation: async (request, reply) => {
      // Enforce additionalProperties: false manually since Fastify 5 defaults to removeAdditional: true
      if (request.body && typeof request.body === 'object') {
        const extraFields = Object.keys(request.body).filter((k) => !LOGIN_ALLOWED_FIELDS.has(k));
        if (extraFields.length > 0) {
          return reply.code(400).send({
            data: null,
            error: `请求包含未允许的字段: ${extraFields.join(', ')}`,
            message: '请求参数格式错误',
          });
        }
      }
    },
    handler: loginHandler,
  });

  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: logoutHandler,
  });

  fastify.get('/me', {
    preHandler: [requireAuthForMe],
    handler: getMeHandler,
  });
}

export default authRoutes;
