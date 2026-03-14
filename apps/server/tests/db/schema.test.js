/**
 * TDD: T001 — Drizzle Schema users 表定义验证
 *
 * 测试策略：
 * - 验证 users 表导出存在
 * - 验证所有字段名称和列名（SQL column name）正确
 * - 验证字段类型（text / integer）正确
 * - 验证约束（primaryKey / notNull / unique）正确
 * - 测试覆盖所有 7 个字段（id、email、nickname、password_hash、agreed_at、created_at、updated_at）
 * - 测试边界：确保不存在多余字段
 */

const { users } = require('../../src/db/schema.js');

describe('Drizzle Schema — users 表定义', () => {
  describe('表对象基础结构', () => {
    test('users 表导出不为 undefined', () => {
      expect(users).toBeDefined();
    });

    test('users 表是一个对象', () => {
      expect(typeof users).toBe('object');
      expect(users).not.toBeNull();
    });

    test('users 表名称为 "users"', () => {
      // Drizzle ORM 的表对象通过 Symbol.for('drizzle:Name') 或 _.name 暴露表名
      const tableName =
        users[Symbol.for('drizzle:Name')] ||
        users['_.name'] ||
        (users._ && users._.name);
      expect(tableName).toBe('users');
    });
  });

  describe('字段定义 — 完整性检查（7 个字段）', () => {
    let columns;

    beforeEach(() => {
      // Drizzle ORM 通过 Symbol.for('drizzle:Columns') 暴露列定义
      columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
    });

    test('columns 对象存在', () => {
      expect(columns).toBeDefined();
      expect(typeof columns).toBe('object');
    });

    test('共有 7 个字段，不多不少', () => {
      const columnKeys = Object.keys(columns);
      expect(columnKeys).toHaveLength(7);
    });

    test('包含所有必需的字段名', () => {
      const columnKeys = Object.keys(columns);
      expect(columnKeys).toContain('id');
      expect(columnKeys).toContain('email');
      expect(columnKeys).toContain('nickname');
      expect(columnKeys).toContain('passwordHash');
      expect(columnKeys).toContain('agreedAt');
      expect(columnKeys).toContain('createdAt');
      expect(columnKeys).toContain('updatedAt');
    });
  });

  describe('字段定义 — id 字段', () => {
    let idCol;

    beforeEach(() => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      idCol = columns.id;
    });

    test('id 字段存在', () => {
      expect(idCol).toBeDefined();
    });

    test('id 字段的 SQL 列名为 "id"', () => {
      expect(idCol.name).toBe('id');
    });

    test('id 字段类型为 text（SQLiteText）', () => {
      // Drizzle SQLite text 列的 dataType 为 'string'
      expect(idCol.dataType).toBe('string');
    });

    test('id 字段是主键（primary key）', () => {
      expect(idCol.primary).toBe(true);
    });

    test('id 字段不允许为空（notNull 隐含在 PK 中）', () => {
      // 主键字段在 SQLite 中隐含 NOT NULL
      expect(idCol.notNull).toBe(true);
    });
  });

  describe('字段定义 — email 字段', () => {
    let emailCol;

    beforeEach(() => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      emailCol = columns.email;
    });

    test('email 字段存在', () => {
      expect(emailCol).toBeDefined();
    });

    test('email 字段的 SQL 列名为 "email"', () => {
      expect(emailCol.name).toBe('email');
    });

    test('email 字段类型为 text（SQLiteText）', () => {
      expect(emailCol.dataType).toBe('string');
    });

    test('email 字段 NOT NULL 约束', () => {
      expect(emailCol.notNull).toBe(true);
    });

    test('email 字段 UNIQUE 约束', () => {
      expect(emailCol.isUnique).toBe(true);
    });
  });

  describe('字段定义 — nickname 字段', () => {
    let nicknameCol;

    beforeEach(() => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      nicknameCol = columns.nickname;
    });

    test('nickname 字段存在', () => {
      expect(nicknameCol).toBeDefined();
    });

    test('nickname 字段的 SQL 列名为 "nickname"', () => {
      expect(nicknameCol.name).toBe('nickname');
    });

    test('nickname 字段类型为 text（SQLiteText）', () => {
      expect(nicknameCol.dataType).toBe('string');
    });

    test('nickname 字段 NOT NULL 约束', () => {
      expect(nicknameCol.notNull).toBe(true);
    });

    test('nickname 字段无 UNIQUE 约束', () => {
      // 昵称允许重复
      expect(nicknameCol.isUnique).toBeFalsy();
    });
  });

  describe('字段定义 — passwordHash 字段', () => {
    let passwordHashCol;

    beforeEach(() => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      passwordHashCol = columns.passwordHash;
    });

    test('passwordHash 字段存在', () => {
      expect(passwordHashCol).toBeDefined();
    });

    test('passwordHash 字段的 SQL 列名为 "password_hash"（snake_case）', () => {
      expect(passwordHashCol.name).toBe('password_hash');
    });

    test('passwordHash 字段类型为 text（SQLiteText）', () => {
      expect(passwordHashCol.dataType).toBe('string');
    });

    test('passwordHash 字段 NOT NULL 约束', () => {
      expect(passwordHashCol.notNull).toBe(true);
    });

    test('passwordHash 字段无 UNIQUE 约束', () => {
      expect(passwordHashCol.isUnique).toBeFalsy();
    });
  });

  describe('字段定义 — agreedAt 字段', () => {
    let agreedAtCol;

    beforeEach(() => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      agreedAtCol = columns.agreedAt;
    });

    test('agreedAt 字段存在', () => {
      expect(agreedAtCol).toBeDefined();
    });

    test('agreedAt 字段的 SQL 列名为 "agreed_at"（snake_case）', () => {
      expect(agreedAtCol.name).toBe('agreed_at');
    });

    test('agreedAt 字段类型为 integer（SQLiteInteger）', () => {
      expect(agreedAtCol.dataType).toBe('number');
    });

    test('agreedAt 字段 NOT NULL 约束', () => {
      expect(agreedAtCol.notNull).toBe(true);
    });
  });

  describe('字段定义 — createdAt 字段', () => {
    let createdAtCol;

    beforeEach(() => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      createdAtCol = columns.createdAt;
    });

    test('createdAt 字段存在', () => {
      expect(createdAtCol).toBeDefined();
    });

    test('createdAt 字段的 SQL 列名为 "created_at"（snake_case）', () => {
      expect(createdAtCol.name).toBe('created_at');
    });

    test('createdAt 字段类型为 integer（SQLiteInteger）', () => {
      expect(createdAtCol.dataType).toBe('number');
    });

    test('createdAt 字段 NOT NULL 约束', () => {
      expect(createdAtCol.notNull).toBe(true);
    });
  });

  describe('字段定义 — updatedAt 字段', () => {
    let updatedAtCol;

    beforeEach(() => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      updatedAtCol = columns.updatedAt;
    });

    test('updatedAt 字段存在', () => {
      expect(updatedAtCol).toBeDefined();
    });

    test('updatedAt 字段的 SQL 列名为 "updated_at"（snake_case）', () => {
      expect(updatedAtCol.name).toBe('updated_at');
    });

    test('updatedAt 字段类型为 integer（SQLiteInteger）', () => {
      expect(updatedAtCol.dataType).toBe('number');
    });

    test('updatedAt 字段 NOT NULL 约束', () => {
      expect(updatedAtCol.notNull).toBe(true);
    });
  });

  describe('边界场景 — 不应存在未定义字段', () => {
    test('不包含 password 明文字段（安全红线）', () => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      expect(Object.keys(columns)).not.toContain('password');
    });

    test('不包含 role / admin 等权限字段（超出当前 scope）', () => {
      const columns =
        users[Symbol.for('drizzle:Columns')] ||
        (users._ && users._.columns);
      expect(Object.keys(columns)).not.toContain('role');
      expect(Object.keys(columns)).not.toContain('admin');
    });
  });
});
