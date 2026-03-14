import bcrypt from 'bcrypt';
import { requireAuth } from '../lib/auth.js';
import * as dbModule from '../db/index.js';

const BCRYPT_SALT_ROUNDS = 10;

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

async function registerHandler(request, reply) {
  const { email, nickname, password } = request.body;
  const now = Date.now();

  try {
    // Check if email is already registered
    const existingUsers = await dbModule.select(email);

    if (existingUsers.length > 0) {
      return reply.code(409).send({
        data: null,
        error: '该邮箱已被注册',
        message: '注册失败',
      });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Generate UUID for user ID
    const id = crypto.randomUUID();

    // Insert user into database
    const trimmedNickname = nickname.trim();
    await dbModule.insert({
      id,
      email,
      nickname: trimmedNickname,
      passwordHash,
      agreedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Set session
    request.session.userId = id;

    return reply.code(201).send({
      data: {
        id,
        email,
        nickname: trimmedNickname,
        createdAt: now,
      },
      message: '注册成功',
    });
  } catch (error) {
    request.log.error(error);
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
    // Find user by email
    const foundUsers = await dbModule.select(email);

    if (foundUsers.length === 0) {
      return reply.code(401).send({
        data: null,
        error: '邮箱或密码错误，请重试',
        message: '登录失败',
      });
    }

    const user = foundUsers[0];

    // Verify password (support both camelCase and snake_case field names)
    const storedHash = user.password_hash || user.passwordHash;
    const passwordMatch = await bcrypt.compare(password, storedHash);

    if (!passwordMatch) {
      return reply.code(401).send({
        data: null,
        error: '邮箱或密码错误，请重试',
        message: '登录失败',
      });
    }

    // Set session
    request.session.userId = user.id;

    return reply.code(200).send({
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.created_at || user.createdAt,
      },
      message: '登录成功',
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '登录失败',
    });
  }
}

async function logoutHandler(request, reply) {
  return new Promise((resolve, reject) => {
    request.session.destroy((err) => {
      if (err) {
        request.log.error(err);
        reject(err);
        reply.code(500).send({
          data: null,
          error: '服务器内部错误，请稍后重试',
          message: '登出失败',
        });
        return;
      }
      resolve(
        reply.code(200).send({
          data: null,
          message: '已成功登出',
        })
      );
    });
  });
}

async function getMeHandler(request, reply) {
  const { userId } = request.session;

  try {
    const foundUsers = await dbModule.selectById(userId);

    if (foundUsers.length === 0) {
      return reply.code(401).send({
        data: null,
        error: '用户不存在，请重新登录',
        message: '获取用户信息失败',
      });
    }

    const user = foundUsers[0];

    return reply.code(200).send({
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.created_at || user.createdAt,
      },
      message: '获取用户信息成功',
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '获取用户信息失败',
    });
  }
}

async function authRoutes(fastify) {
  // POST /register
  fastify.post('/register', {
    schema: {
      body: registerBodySchema,
    },
    handler: registerHandler,
  });

  // POST /login
  fastify.post('/login', {
    schema: {
      body: loginBodySchema,
    },
    handler: loginHandler,
  });

  // POST /logout
  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: logoutHandler,
  });

  // GET /me
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: getMeHandler,
  });
}

export default authRoutes;
