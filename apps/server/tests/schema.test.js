/**
 * Users Table Schema Test
 *
 * 测试 users 表的 Drizzle schema 定义
 * 验证字段定义、约束、数据类型是否符合技术方案规格
 */

import { describe, it, expect } from '@jest/globals';

describe('Users Table Schema', () => {
  it('应该导出 users 表定义', async () => {
    // 动态导入 schema，预期会失败因为文件尚不存在（TDD RED 阶段）
    const schema = await import('../src/db/schema.js');

    expect(schema.users).toBeDefined();
    expect(typeof schema.users).toBe('object');
  });

  it('users 表应包含所有必需字段', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    // 验证表结构中包含所有字段
    const columns = users[Symbol.for('drizzle:Columns')];
    expect(columns).toBeDefined();

    const columnNames = Object.keys(columns);

    // 验证字段列表（按技术方案 §2）
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('nickname');
    expect(columnNames).toContain('passwordHash');
    expect(columnNames).toContain('agreedAt');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('updatedAt');
  });

  it('id 字段应为 text 类型的主键', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];
    const idColumn = columns.id;

    expect(idColumn).toBeDefined();
    expect(idColumn.dataType).toBe('string'); // Drizzle text() 对应 JS string
    expect(idColumn.primary).toBe(true);
    expect(idColumn.notNull).toBe(true);
  });

  it('email 字段应为 text 类型，NOT NULL 且 UNIQUE', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];
    const emailColumn = columns.email;

    expect(emailColumn).toBeDefined();
    expect(emailColumn.dataType).toBe('string');
    expect(emailColumn.notNull).toBe(true);
    expect(emailColumn.isUnique).toBe(true);
  });

  it('nickname 字段应为 text 类型且 NOT NULL', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];
    const nicknameColumn = columns.nickname;

    expect(nicknameColumn).toBeDefined();
    expect(nicknameColumn.dataType).toBe('string');
    expect(nicknameColumn.notNull).toBe(true);
  });

  it('passwordHash 字段应为 text 类型且 NOT NULL', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];
    const passwordHashColumn = columns.passwordHash;

    expect(passwordHashColumn).toBeDefined();
    expect(passwordHashColumn.dataType).toBe('string');
    expect(passwordHashColumn.notNull).toBe(true);
  });

  it('agreedAt 字段应为 integer 类型且 NOT NULL', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];
    const agreedAtColumn = columns.agreedAt;

    expect(agreedAtColumn).toBeDefined();
    expect(agreedAtColumn.dataType).toBe('number'); // Drizzle integer() 对应 JS number
    expect(agreedAtColumn.notNull).toBe(true);
  });

  it('createdAt 字段应为 integer 类型且 NOT NULL', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];
    const createdAtColumn = columns.createdAt;

    expect(createdAtColumn).toBeDefined();
    expect(createdAtColumn.dataType).toBe('number');
    expect(createdAtColumn.notNull).toBe(true);
  });

  it('updatedAt 字段应为 integer 类型且 NOT NULL', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];
    const updatedAtColumn = columns.updatedAt;

    expect(updatedAtColumn).toBeDefined();
    expect(updatedAtColumn.dataType).toBe('number');
    expect(updatedAtColumn.notNull).toBe(true);
  });

  it('数据库列名应遵循 snake_case 命名规范', async () => {
    const schema = await import('../src/db/schema.js');
    const { users } = schema;

    const columns = users[Symbol.for('drizzle:Columns')];

    // 验证数据库列名（通过 Drizzle 的 name 属性）
    expect(columns.id.name).toBe('id');
    expect(columns.email.name).toBe('email');
    expect(columns.nickname.name).toBe('nickname');
    expect(columns.passwordHash.name).toBe('password_hash');
    expect(columns.agreedAt.name).toBe('agreed_at');
    expect(columns.createdAt.name).toBe('created_at');
    expect(columns.updatedAt.name).toBe('updated_at');
  });
});
