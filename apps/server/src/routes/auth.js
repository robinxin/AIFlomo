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
// Register validation error message mapper
// Maps AJV error instancePath + keyword to user-friendly Chinese messages.
// ---------------------------------------------------------------------------

function getRegisterValidationError(validationErrors) {
  if (!validationErrors || validationErrors.length === 0) {
    return '请求参数格式错误';
  }
  for (const err of validationErrors) {
    const path = err.instancePath || '';
    const keyword = err.keyword;
    const params = err.params || {};

    // Missing required fields
    if (keyword === 'required') {
      return '请求参数格式错误';
    }

    // email field
    if (path === '/email') {
      return '请输入有效的邮箱地址';
    }

    // nickname field — minLength, maxLength, pattern
    if (path === '/nickname') {
      return '昵称长度为 2-20 字符';
    }

    // password field — minLength, maxLength
    if (path === '/password') {
      return '密码长度为 8-20 字符';
    }

    // agreedToPrivacy field — enum (must be true)
    if (path === '/agreedToPrivacy') {
      return '请阅读并同意隐私协议';
    }

    // additionalProperties
    if (keyword === 'additionalProperties') {
      return '请求参数格式错误';
    }
  }
  return '请求参数格式错误';
}

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
// requireAuth variant for /logout — returns '登出失败' as message
// ---------------------------------------------------------------------------

function requireAuthForLogout(request, reply, done) {
  if (!request.session || !request.session.userId) {
    return reply.code(401).send({
      data: null,
      error: '请先登录',
      message: '登出失败',
    });
  }
  done();
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function registerHandler(request, reply) {
  // Handle schema validation errors with field-specific messages
  if (request.validationError) {
    const errorMsg = getRegisterValidationError(request.validationError.validation);
    return reply.code(400).send({
      data: null,
      error: errorMsg,
      message: '注册失败',
    });
  }

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
  // Handle schema validation errors
  if (request.validationError) {
    return reply.code(400).send({
      data: null,
      error: '请求参数格式错误',
      message: '登录失败',
    });
  }

  const { email, password } = request.body;

  try {
    // Look up user by email
    const rows = await db.select(users, eq(users.email, email));
    if (rows.length === 0) {
      return reply.code(401).send({
        data: null,
        error: '邮箱或密码错误，请重试',
        message: '登录失败',
      });
    }

    const user = rows[0];

    // Compare password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return reply.code(401).send({
        data: null,
        error: '邮箱或密码错误，请重试',
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

    // Explicitly clear the session cookie so the browser removes it.
    // @fastify/cookie's clearCookie sets Max-Age=0 and Expires to the past.
    // Guard against test environments where @fastify/cookie is not registered.
    if (typeof reply.clearCookie === 'function') {
      reply.clearCookie('connect.sid', { path: '/' });
    }

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
// Allowed fields for each endpoint (for manual additionalProperties check)
// ---------------------------------------------------------------------------

const REGISTER_ALLOWED_FIELDS = new Set(['email', 'nickname', 'password', 'agreedToPrivacy']);
const LOGIN_ALLOWED_FIELDS = new Set(['email', 'password']);

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

async function authRoutes(fastify) {
  fastify.post('/register', {
    schema: { body: registerBodySchema },
    attachValidation: true,
    preValidation: async (request, reply) => {
      // Enforce additionalProperties: false manually since Fastify 5 defaults to removeAdditional: true
      if (request.body && typeof request.body === 'object') {
        const extraFields = Object.keys(request.body).filter((k) => !REGISTER_ALLOWED_FIELDS.has(k));
        if (extraFields.length > 0) {
          return reply.code(400).send({
            data: null,
            error: '请求参数格式错误',
            message: '注册失败',
          });
        }
      }
    },
    handler: registerHandler,
  });

  fastify.post('/login', {
    schema: { body: loginBodySchema },
    attachValidation: true,
    preValidation: async (request, reply) => {
      // Enforce additionalProperties: false manually since Fastify 5 defaults to removeAdditional: true
      if (request.body && typeof request.body === 'object') {
        const extraFields = Object.keys(request.body).filter((k) => !LOGIN_ALLOWED_FIELDS.has(k));
        if (extraFields.length > 0) {
          return reply.code(400).send({
            data: null,
            error: '请求参数格式错误',
            message: '登录失败',
          });
        }
      }
    },
    handler: loginHandler,
  });

  fastify.post('/logout', {
    preHandler: [requireAuthForLogout],
    handler: logoutHandler,
  });

  fastify.get('/me', {
    preHandler: [requireAuthForMe],
    handler: getMeHandler,
  });
}

export default authRoutes;
