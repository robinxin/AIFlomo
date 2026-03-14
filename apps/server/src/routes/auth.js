/**
 * auth.js — 认证路由模块（Fastify Plugin）
 *
 * 注册 4 个认证端点（前缀由调用方注册时提供，约定为 /api/auth）：
 *   POST   /register  — 用户注册（公开）
 *   POST   /login     — 用户登录（公开）
 *   POST   /logout    — 用户登出（需鉴权）
 *   GET    /me        — 获取当前登录用户信息（需鉴权）
 *
 * 安全约束：
 *   - 邮箱 UNIQUE 冲突返回 409
 *   - 登录失败统一返回 401，不区分邮箱/密码错误（防信息泄露，符合 FR-007）
 *   - 响应用户信息时不含 passwordHash 字段
 *   - 密码使用 bcryptjs saltRounds=10 哈希存储
 *   - Session 管理通过 @fastify/session 插件完成
 */

import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth } from '../lib/auth.js';

const BCRYPT_SALT_ROUNDS = 10;

// ─── JSON Schema 定义 ─────────────────────────────────────────────────────────

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

// ─── 错误响应构造工具 ─────────────────────────────────────────────────────────

/**
 * 根据 AJV 校验错误的 instancePath / keyword 生成业务友好错误信息
 *
 * @param {object} validationError - Fastify 暴露的校验错误对象（err.validation[0]）
 * @param {'register'|'login'} context - 当前端点上下文，影响 message 文案
 * @returns {{ code: number, error: string, message: string }}
 */
function buildValidationError(validationError, context) {
  const messageMap = {
    register: '注册失败',
    login: '登录失败',
  };
  const failMessage = messageMap[context] || '请求失败';

  if (!validationError) {
    return { code: 400, error: '请求参数格式错误', message: failMessage };
  }

  const { instancePath, keyword } = validationError;

  // email 字段 format 校验失败
  if (instancePath === '/email' && keyword === 'format') {
    return { code: 400, error: '请输入有效的邮箱地址', message: failMessage };
  }

  // nickname 长度校验失败
  if (instancePath === '/nickname' && (keyword === 'minLength' || keyword === 'maxLength')) {
    return { code: 400, error: '昵称长度为 2-20 字符', message: failMessage };
  }

  // nickname pattern 校验失败（纯空格）
  if (instancePath === '/nickname' && keyword === 'pattern') {
    return { code: 400, error: '昵称长度为 2-20 字符', message: failMessage };
  }

  // password 长度校验失败
  if (instancePath === '/password' && (keyword === 'minLength' || keyword === 'maxLength')) {
    return { code: 400, error: '密码长度为 8-20 字符', message: failMessage };
  }

  // agreedToPrivacy enum 校验失败（值为 false）
  if (instancePath === '/agreedToPrivacy' && keyword === 'enum') {
    return { code: 400, error: '请阅读并同意隐私协议', message: failMessage };
  }

  // required 字段缺失、additionalProperties 及其他所有校验失败统一返回
  return { code: 400, error: '请求参数格式错误', message: failMessage };
}

// ─── 路由处理函数 ─────────────────────────────────────────────────────────────

/**
 * POST /register — 用户注册处理器
 *
 * 流程：
 *   1. Fastify JSON Schema 校验（由框架自动执行，校验失败触发 onError）
 *   2. 检查邮箱是否已被注册（UNIQUE 约束），重复则返回 409
 *   3. bcrypt 哈希密码
 *   4. INSERT 用户记录，Session 写入 userId
 *   5. 返回 201 + 用户信息（不含 passwordHash）
 */
async function registerHandler(request, reply) {
  const { email, nickname, password } = request.body;

  try {
    // 1. 检查邮箱唯一性
    const existing = await db.selectByEmail(email);
    if (existing.length > 0) {
      return reply.code(409).send({
        data: null,
        error: '该邮箱已被注册',
        message: '注册失败',
      });
    }

    // 2. 生成用户 ID 和哈希密码
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const trimmedNickname = nickname.trim();
    const now = Date.now();

    // 3. 插入用户记录
    await db.insertUser({
      id,
      email,
      nickname: trimmedNickname,
      passwordHash,
      agreedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // 4. 写入 Session
    request.session.userId = id;

    // 5. 返回成功响应
    return reply.code(201).send({
      data: {
        id,
        email,
        nickname: trimmedNickname,
        createdAt: now,
      },
      message: '注册成功',
    });
  } catch (err) {
    // SQLite UNIQUE constraint violation（并发场景或直接 DB 约束触发）
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || err?.message?.includes('UNIQUE constraint failed')) {
      return reply.code(409).send({
        data: null,
        error: '该邮箱已被注册',
        message: '注册失败',
      });
    }

    request.log.error({ err }, 'registerHandler error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '注册失败',
    });
  }
}

/**
 * POST /login — 用户登录处理器
 *
 * 流程：
 *   1. Fastify JSON Schema 校验
 *   2. 查询 email 对应用户，不存在返回 401（不泄露具体原因，符合 FR-007）
 *   3. bcrypt.compare 验证密码，不匹配返回 401
 *   4. Session 写入 userId
 *   5. 返回 200 + 用户信息（不含 passwordHash）
 */
async function loginHandler(request, reply) {
  const { email, password } = request.body;

  try {
    // 1. 查询用户
    const rows = await db.selectByEmail(email);
    if (rows.length === 0) {
      return reply.code(401).send({
        data: null,
        error: '登录信息有误，请重试',
        message: '登录失败',
      });
    }

    const user = rows[0];

    // 2. 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.code(401).send({
        data: null,
        error: '登录信息有误，请重试',
        message: '登录失败',
      });
    }

    // 3. 写入 Session
    request.session.userId = user.id;

    // 4. 更新 updatedAt（记录最后活跃时间）
    await db.updateUserUpdatedAt(user.id, Date.now());

    // 5. 返回成功响应
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
    request.log.error({ err }, 'loginHandler error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '登录失败',
    });
  }
}

/**
 * POST /logout — 用户登出处理器
 *
 * 流程：
 *   1. requireAuth preHandler 确保已登录（未登录直接返回 401）
 *   2. 销毁 Session（服务端删除 Session 记录，客户端 Cookie 失效）
 *   3. 返回 200
 */
async function logoutHandler(request, reply) {
  try {
    await request.session.destroy();
    return reply.code(200).send({
      data: null,
      message: '已成功登出',
    });
  } catch (err) {
    request.log.error({ err }, 'logoutHandler error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '登出失败',
    });
  }
}

/**
 * GET /me — 获取当前登录用户信息处理器
 *
 * 流程：
 *   1. requireAuth preHandler 确保已登录
 *   2. 根据 session.userId 查询用户记录
 *   3. 用户不存在（异常情况，如账号已删除）→ 销毁 Session，返回 401
 *   4. 返回 200 + 用户信息（不含 passwordHash）
 */
async function getMeHandler(request, reply) {
  const { userId } = request.session;

  try {
    const rows = await db.getUserById(userId);
    if (rows.length === 0) {
      // 异常情况：Session 有效但用户已被删除
      try {
        await request.session.destroy();
      } catch {
        // Session 销毁失败不影响响应
      }
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
    request.log.error({ err }, 'getMeHandler error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '获取用户信息失败',
    });
  }
}

// ─── Fastify Plugin ───────────────────────────────────────────────────────────

/**
 * authRoutes — Fastify 认证路由插件
 *
 * 注册时添加前缀：
 *   fastify.register(authRoutes, { prefix: '/api/auth' })
 *
 * 校验错误处理：
 *   重写 setErrorHandler 以将 Fastify 默认的 400 校验错误转换为业务格式
 */
async function authRoutes(fastify) {
  // 覆盖本作用域的错误处理器，将 JSON Schema 校验错误转为业务响应格式
  fastify.setErrorHandler(function (err, request, reply) {
    if (err.validation) {
      // 根据请求路径判断端点上下文
      const url = request.url || '';
      const context = url.includes('/login') ? 'login' : 'register';
      const { code, error, message } = buildValidationError(err.validation[0], context);
      return reply.code(code).send({ data: null, error, message });
    }

    // 非校验错误：记录日志并返回通用 500
    request.log.error({ err }, 'authRoutes unhandled error');
    return reply.code(500).send({
      data: null,
      error: '服务器内部错误，请稍后重试',
      message: '请求失败',
    });
  });

  // POST /register — 用户注册（公开）
  fastify.post('/register', {
    schema: { body: registerBodySchema },
    handler: registerHandler,
  });

  // POST /login — 用户登录（公开）
  fastify.post('/login', {
    schema: { body: loginBodySchema },
    handler: loginHandler,
  });

  // POST /logout — 用户登出（需鉴权）
  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: logoutHandler,
  });

  // GET /me — 获取当前登录用户信息（需鉴权）
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: getMeHandler,
  });
}

export default fp(authRoutes, {
  name: 'auth-routes',
});
