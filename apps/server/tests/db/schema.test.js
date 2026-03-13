/**
 * Drizzle Schema 单元测试 — users 表（Jest）
 *
 * 覆盖范围：
 *   - users 表导出是否存在
 *   - 表名是否为 'users'
 *   - 字段完整性与约束：
 *       id          — text, primary key
 *       email       — text, NOT NULL, UNIQUE
 *       nickname    — text, NOT NULL
 *       password_hash — text, NOT NULL
 *       agreed_at   — integer, NOT NULL
 *       created_at  — integer, NOT NULL
 *       updated_at  — integer, NOT NULL
 *
 * 测试在 RED 阶段编写，apps/server/src/db/schema.js 中的 users 表尚未实现，
 * 预期本文件中所有测试均失败。
 *
 * 参考技术方案文档：specs/active/43-feature-account-registration-login-3-design.md §2
 */

import { users } from '../../src/db/schema.js';

// ---------------------------------------------------------------------------
// 辅助：从 Drizzle 表对象中取出列定义映射
//
// Drizzle SQLite 表实例将列信息挂在 [Symbol] 属性上，
// 同时也可通过 table[columnName] 直接访问列对象。
// 为保持稳健性，优先使用 table[columnName] 形式，
// 再结合 getSQL() / columnType 等属性断言约束。
// ---------------------------------------------------------------------------

/**
 * 根据列对象的 columnType 字段返回 Drizzle 内部数据类型标识。
 * text 列 → 'SQLiteText'
 * integer 列 → 'SQLiteInteger'
 */
function getColumnType(col) {
  return col?.columnType ?? col?.constructor?.name ?? null;
}

/**
 * 判断列是否标注为 NOT NULL（notNull: true）。
 */
function isNotNull(col) {
  return col?.notNull === true;
}

/**
 * 判断列是否为主键（primary: true）。
 */
function isPrimaryKey(col) {
  return col?.primary === true || col?.primaryKey === true;
}

/**
 * 判断列是否具有 UNIQUE 约束（isUnique: true）。
 */
function isUnique(col) {
  return col?.isUnique === true;
}

/**
 * 获取列在数据库中的实际列名（snake_case）。
 */
function getDbName(col) {
  return col?.name ?? null;
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------

describe('Drizzle Schema — users 表', () => {
  // -------------------------------------------------------------------------
  // 1. 导出检查
  // -------------------------------------------------------------------------

  describe('导出', () => {
    test('schema.js 应导出 users 表对象', () => {
      expect(users).toBeDefined();
      expect(users).not.toBeNull();
    });

    test('users 导出值应为对象（Drizzle 表实例）', () => {
      expect(typeof users).toBe('object');
    });
  });

  // -------------------------------------------------------------------------
  // 2. 表名检查
  // -------------------------------------------------------------------------

  describe('表名', () => {
    test('users 表的数据库表名应为 "users"', () => {
      // Drizzle 表实例将表名存储在 _.name 或直接的 Symbol 属性中。
      // 最通用的访问路径：SQLiteTable[Symbol('drizzle:Name')] 或 table[_.name]
      // 以下多路径覆盖不同 Drizzle 版本的实现差异。
      const tableName =
        users?._.name ??         // drizzle-orm >= 0.28 常见路径
        users?.[Symbol.for('drizzle:Name')] ?? // 部分版本使用 Symbol
        users?.tableName ??       // 备用属性名
        null;

      expect(tableName).toBe('users');
    });
  });

  // -------------------------------------------------------------------------
  // 3. 字段存在性检查
  //
  // Drizzle 表对象的列可通过 table[columnKey] 访问，
  // columnKey 为 JavaScript 属性名（camelCase），对应 schema.js 中的定义键。
  // -------------------------------------------------------------------------

  describe('字段存在性', () => {
    const EXPECTED_COLUMNS = [
      'id',
      'email',
      'nickname',
      'passwordHash',   // JS 属性名（camelCase），数据库列名为 password_hash
      'agreedAt',       // JS 属性名（camelCase），数据库列名为 agreed_at
      'createdAt',      // JS 属性名（camelCase），数据库列名为 created_at
      'updatedAt',      // JS 属性名（camelCase），数据库列名为 updated_at
    ];

    EXPECTED_COLUMNS.forEach((colKey) => {
      test(`users 表应包含 "${colKey}" 字段`, () => {
        expect(users[colKey]).toBeDefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. id 字段约束
  // -------------------------------------------------------------------------

  describe('id 字段', () => {
    test('id 应为 text 类型', () => {
      expect(getColumnType(users.id)).toMatch(/text/i);
    });

    test('id 应为 primary key', () => {
      expect(isPrimaryKey(users.id)).toBe(true);
    });

    test('id 的数据库列名应为 "id"', () => {
      expect(getDbName(users.id)).toBe('id');
    });
  });

  // -------------------------------------------------------------------------
  // 5. email 字段约束
  // -------------------------------------------------------------------------

  describe('email 字段', () => {
    test('email 应为 text 类型', () => {
      expect(getColumnType(users.email)).toMatch(/text/i);
    });

    test('email 应为 NOT NULL', () => {
      expect(isNotNull(users.email)).toBe(true);
    });

    test('email 应具有 UNIQUE 约束', () => {
      expect(isUnique(users.email)).toBe(true);
    });

    test('email 的数据库列名应为 "email"', () => {
      expect(getDbName(users.email)).toBe('email');
    });
  });

  // -------------------------------------------------------------------------
  // 6. nickname 字段约束
  // -------------------------------------------------------------------------

  describe('nickname 字段', () => {
    test('nickname 应为 text 类型', () => {
      expect(getColumnType(users.nickname)).toMatch(/text/i);
    });

    test('nickname 应为 NOT NULL', () => {
      expect(isNotNull(users.nickname)).toBe(true);
    });

    test('nickname 的数据库列名应为 "nickname"', () => {
      expect(getDbName(users.nickname)).toBe('nickname');
    });
  });

  // -------------------------------------------------------------------------
  // 7. passwordHash 字段约束（数据库列名：password_hash）
  // -------------------------------------------------------------------------

  describe('passwordHash 字段', () => {
    test('passwordHash 应为 text 类型', () => {
      expect(getColumnType(users.passwordHash)).toMatch(/text/i);
    });

    test('passwordHash 应为 NOT NULL', () => {
      expect(isNotNull(users.passwordHash)).toBe(true);
    });

    test('passwordHash 的数据库列名应为 "password_hash"', () => {
      expect(getDbName(users.passwordHash)).toBe('password_hash');
    });
  });

  // -------------------------------------------------------------------------
  // 8. agreedAt 字段约束（数据库列名：agreed_at）
  // -------------------------------------------------------------------------

  describe('agreedAt 字段', () => {
    test('agreedAt 应为 integer 类型', () => {
      expect(getColumnType(users.agreedAt)).toMatch(/integer/i);
    });

    test('agreedAt 应为 NOT NULL', () => {
      expect(isNotNull(users.agreedAt)).toBe(true);
    });

    test('agreedAt 的数据库列名应为 "agreed_at"', () => {
      expect(getDbName(users.agreedAt)).toBe('agreed_at');
    });
  });

  // -------------------------------------------------------------------------
  // 9. createdAt 字段约束（数据库列名：created_at）
  // -------------------------------------------------------------------------

  describe('createdAt 字段', () => {
    test('createdAt 应为 integer 类型', () => {
      expect(getColumnType(users.createdAt)).toMatch(/integer/i);
    });

    test('createdAt 应为 NOT NULL', () => {
      expect(isNotNull(users.createdAt)).toBe(true);
    });

    test('createdAt 的数据库列名应为 "created_at"', () => {
      expect(getDbName(users.createdAt)).toBe('created_at');
    });
  });

  // -------------------------------------------------------------------------
  // 10. updatedAt 字段约束（数据库列名：updated_at）
  // -------------------------------------------------------------------------

  describe('updatedAt 字段', () => {
    test('updatedAt 应为 integer 类型', () => {
      expect(getColumnType(users.updatedAt)).toMatch(/integer/i);
    });

    test('updatedAt 应为 NOT NULL', () => {
      expect(isNotNull(users.updatedAt)).toBe(true);
    });

    test('updatedAt 的数据库列名应为 "updated_at"', () => {
      expect(getDbName(users.updatedAt)).toBe('updated_at');
    });
  });

  // -------------------------------------------------------------------------
  // 11. 全局约束：无意外字段泄露
  //
  // 验证 users 表的列定义键集合与预期精确匹配（不多也不少）。
  // 使用 Drizzle 内部 `_.columns` 属性枚举所有列。
  // -------------------------------------------------------------------------

  describe('字段完整性（无多余字段）', () => {
    test('users 表应仅包含规范定义的 7 个字段', () => {
      const expectedKeys = new Set([
        'id',
        'email',
        'nickname',
        'passwordHash',
        'agreedAt',
        'createdAt',
        'updatedAt',
      ]);

      // 从 Drizzle 表实例读取所有列的 JS 属性名
      const actualColumns = users?._.columns ?? {};
      const actualKeys = new Set(Object.keys(actualColumns));

      expect(actualKeys).toEqual(expectedKeys);
    });
  });
});
