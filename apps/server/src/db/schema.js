/**
 * Drizzle ORM Schema — AIFlomo 数据库表定义
 *
 * 技术方案参考: specs/active/43-feature-account-registration-login-3-design.md §2
 *
 * 表: users
 * - id:            text / UUID / PRIMARY KEY
 * - email:         text / NOT NULL / UNIQUE（登录凭证，全局唯一）
 * - nickname:      text / NOT NULL（显示名称，2-20 字符）
 * - password_hash: text / NOT NULL（bcrypt 哈希，禁止明文）
 * - agreed_at:     integer / NOT NULL（隐私协议同意时间戳，Unix 毫秒）
 * - created_at:    integer / NOT NULL（账号创建时间，Unix 毫秒）
 * - updated_at:    integer / NOT NULL（最后更新时间，Unix 毫秒）
 *
 * Session 表由 @fastify/session 插件自动管理，不在此处定义。
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  // 主键：UUID 字符串，由应用层生成（crypto.randomUUID()）
  id: text('id').primaryKey(),

  // 邮箱：登录凭证，全局唯一，格式经后端验证
  // UNIQUE 约束在数据库层防止并发注册竞态条件（FR-003）
  email: text('email').notNull().unique(),

  // 昵称：显示名称，存储前由后端 trim 并校验长度 2-20 字符
  nickname: text('nickname').notNull(),

  // 密码哈希：使用 bcrypt 哈希存储，saltRounds=10；禁止明文（安全红线）
  passwordHash: text('password_hash').notNull(),

  // 隐私协议同意时间戳（Unix 毫秒），注册时必须提供，满足合规审计要求（FR-004）
  agreedAt: integer('agreed_at').notNull(),

  // 账号创建时间（Unix 毫秒），应用层在 INSERT 时赋值 Date.now()
  createdAt: integer('created_at').notNull(),

  // 最后更新时间（Unix 毫秒），应用层在 UPDATE 时赋值 Date.now()
  updatedAt: integer('updated_at').notNull(),
});
