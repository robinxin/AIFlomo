import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * users — AIFlomo 注册用户表
 *
 * 字段设计说明：
 *   id           — UUID 字符串主键，由应用层 crypto.randomUUID() 生成，避免整数自增 ID 的可预测性
 *   email        — 邮箱，唯一登录标识，UNIQUE 约束防止并发注册竞态条件
 *   nickname     — 用户显示名，存储前由后端 trim() 并校验 2-20 字符
 *   password_hash — bcrypt 哈希值（saltRounds=10），禁止明文存储
 *   agreed_at    — 隐私协议同意时间戳（Unix 毫秒），满足合规审计需求
 *   created_at   — 账号创建时间（Unix 毫秒），由应用层 INSERT 时 Date.now() 赋值
 *   updated_at   — 最后更新时间（Unix 毫秒），由应用层 UPDATE 时 Date.now() 赋值
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),

  email: text('email').notNull().unique(),

  nickname: text('nickname').notNull(),

  passwordHash: text('password_hash').notNull(),

  agreedAt: integer('agreed_at').notNull(),

  createdAt: integer('created_at').notNull(),

  updatedAt: integer('updated_at').notNull(),
});
