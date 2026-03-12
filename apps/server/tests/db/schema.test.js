/**
 * T002 数据库 Schema 单元测试（TDD RED 阶段）
 *
 * 验证 apps/server/src/db/schema.js 和 apps/server/src/db/index.js 的实现是否符合
 * 技术方案文档 §2 的完整 Schema 定义。
 *
 * 覆盖范围：
 *   1. 五张表（users / memos / tags / memo_tags / memo_images）均已正确定义并导出
 *   2. 主键字段使用 $defaultFn(() => crypto.randomUUID()) 生成 UUID v4
 *   3. 时间戳字段使用 sql`(CURRENT_TIMESTAMP)` 作为默认值
 *   4. 外键关系及 onDelete: 'cascade' 设置
 *   5. 非空约束、唯一约束、列名（snake_case）、列类型
 *   6. db/index.js 默认导出 Drizzle 数据库实例
 *
 * 这些测试在 RED 阶段应全部失败，因为 schema.js 和 index.js 尚未实现。
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 被测模块的绝对路径
const SCHEMA_PATH = path.resolve(__dirname, '../../src/db/schema.js');
const DB_INDEX_PATH = path.resolve(__dirname, '../../src/db/index.js');

// UUID v4 正则表达式
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/**
 * 断言某个列的 default 值包含 CURRENT_TIMESTAMP SQL 片段。
 * 使用 Drizzle 公开的 toQuery() 方法序列化 SQL 对象，避免依赖内部 queryChunks 结构。
 *
 * @param {object} column - Drizzle 列对象
 */
function assertCurrentTimestampDefault(column) {
  expect(column.hasDefault).toBe(true);
  expect(column.default).toBeDefined();
  // toQuery() 是 SQL 类的稳定公开方法，返回 { sql: string, params: any[] }
  const query = column.default.toQuery({
    escapeName: (name) => name,
    escapeParam: (_i, _v) => '?',
    escapeString: (s) => s,
  });
  expect(query.sql).toMatch(/CURRENT_TIMESTAMP/i);
}

/**
 * 断言某个列的 $defaultFn 生成符合 UUID v4 格式的字符串。
 *
 * @param {object} column - Drizzle 列对象
 */
function assertUuidDefaultFn(column) {
  expect(typeof column.defaultFn).toBe('function');
  const generated = column.defaultFn();
  expect(typeof generated).toBe('string');
  expect(UUID_V4_REGEX.test(generated)).toBe(true);
}

/**
 * 在 getTableConfig(table).foreignKeys 中找到指定列名的外键记录。
 *
 * @param {object} table - Drizzle 表对象
 * @param {string} columnName - 发起外键的列名（SQL 列名，snake_case）
 * @returns {{ fk: object, ref: object }}
 */
function getForeignKey(table, columnName) {
  const { foreignKeys } = getTableConfig(table);
  const fk = foreignKeys.find((k) => {
    const ref = k.reference();
    return ref.columns.some((c) => c.name === columnName);
  });
  expect(fk).toBeDefined();
  const ref = fk.reference();
  return { fk, ref };
}

// ─── 加载模块（所有测试共享同一次 import） ────────────────────────────────────

let schemaModule;
let dbModule;

beforeAll(async () => {
  // 使用内存数据库，避免 index.js 模块加载时在文件系统创建副作用。
  // 必须在 import(DB_INDEX_PATH) 之前设置，因为模块顶层代码在加载时立即执行。
  process.env.DB_PATH = ':memory:';

  // 动态 import 让每次测试运行都能拿到最新的模块导出。
  // 若文件不存在，import() 会抛出 ERR_MODULE_NOT_FOUND，所有后续测试均失败（RED 阶段预期行为）。
  schemaModule = await import(SCHEMA_PATH);
  dbModule = await import(DB_INDEX_PATH);
});

// ─── 1. 模块导出完整性 ────────────────────────────────────────────────────────

describe('schema.js — 模块导出', () => {
  it('应导出 users 表', () => {
    expect(schemaModule.users).toBeDefined();
  });

  it('应导出 memos 表', () => {
    expect(schemaModule.memos).toBeDefined();
  });

  it('应导出 tags 表', () => {
    expect(schemaModule.tags).toBeDefined();
  });

  it('应导出 memoTags 表', () => {
    expect(schemaModule.memoTags).toBeDefined();
  });

  it('应导出 memoImages 表', () => {
    expect(schemaModule.memoImages).toBeDefined();
  });
});

// ─── 2. users 表 ─────────────────────────────────────────────────────────────

describe('users 表', () => {
  let users;

  beforeAll(() => {
    users = schemaModule.users;
  });

  it('表名应为 "users"', () => {
    const config = getTableConfig(users);
    expect(config.name).toBe('users');
  });

  describe('id 列', () => {
    it('列名应为 "id"', () => {
      expect(users.id.name).toBe('id');
    });

    it('类型应为 SQLiteText（text 列）', () => {
      expect(users.id.columnType).toBe('SQLiteText');
    });

    it('应为主键（primary: true）', () => {
      expect(users.id.primary).toBe(true);
    });

    it('不应为空（notNull: true）', () => {
      expect(users.id.notNull).toBe(true);
    });

    it('$defaultFn 应生成符合 UUID v4 格式的字符串', () => {
      assertUuidDefaultFn(users.id);
    });
  });

  describe('username 列', () => {
    it('列名应为 "username"', () => {
      expect(users.username.name).toBe('username');
    });

    it('类型应为 SQLiteText', () => {
      expect(users.username.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(users.username.notNull).toBe(true);
    });

    it('应有唯一约束（isUnique: true）', () => {
      expect(users.username.isUnique).toBe(true);
    });
  });

  describe('passwordHash 列', () => {
    it('列名应为 "password_hash"', () => {
      expect(users.passwordHash.name).toBe('password_hash');
    });

    it('类型应为 SQLiteText', () => {
      expect(users.passwordHash.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(users.passwordHash.notNull).toBe(true);
    });
  });

  describe('createdAt 列', () => {
    it('列名应为 "created_at"', () => {
      expect(users.createdAt.name).toBe('created_at');
    });

    it('类型应为 SQLiteText', () => {
      expect(users.createdAt.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(users.createdAt.notNull).toBe(true);
    });

    it('默认值应使用 sql`(CURRENT_TIMESTAMP)`', () => {
      assertCurrentTimestampDefault(users.createdAt);
    });
  });

  it('表中不应存在 updatedAt 列（users 表不需要此字段）', () => {
    expect(users.updatedAt).toBeUndefined();
  });
});

// ─── 3. memos 表 ─────────────────────────────────────────────────────────────

describe('memos 表', () => {
  let memos;

  beforeAll(() => {
    memos = schemaModule.memos;
  });

  it('表名应为 "memos"', () => {
    const config = getTableConfig(memos);
    expect(config.name).toBe('memos');
  });

  describe('id 列', () => {
    it('列名应为 "id"', () => {
      expect(memos.id.name).toBe('id');
    });

    it('类型应为 SQLiteText', () => {
      expect(memos.id.columnType).toBe('SQLiteText');
    });

    it('应为主键（primary: true）', () => {
      expect(memos.id.primary).toBe(true);
    });

    it('不应为空（notNull: true）', () => {
      expect(memos.id.notNull).toBe(true);
    });

    it('$defaultFn 应生成符合 UUID v4 格式的字符串', () => {
      assertUuidDefaultFn(memos.id);
    });
  });

  describe('content 列', () => {
    it('列名应为 "content"', () => {
      expect(memos.content.name).toBe('content');
    });

    it('类型应为 SQLiteText', () => {
      expect(memos.content.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memos.content.notNull).toBe(true);
    });
  });

  describe('userId 列', () => {
    it('列名应为 "user_id"', () => {
      expect(memos.userId.name).toBe('user_id');
    });

    it('类型应为 SQLiteText', () => {
      expect(memos.userId.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memos.userId.notNull).toBe(true);
    });
  });

  describe('createdAt 列', () => {
    it('列名应为 "created_at"', () => {
      expect(memos.createdAt.name).toBe('created_at');
    });

    it('类型应为 SQLiteText', () => {
      expect(memos.createdAt.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memos.createdAt.notNull).toBe(true);
    });

    it('默认值应使用 sql`(CURRENT_TIMESTAMP)`', () => {
      assertCurrentTimestampDefault(memos.createdAt);
    });
  });

  describe('updatedAt 列', () => {
    it('列名应为 "updated_at"', () => {
      expect(memos.updatedAt.name).toBe('updated_at');
    });

    it('类型应为 SQLiteText', () => {
      expect(memos.updatedAt.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memos.updatedAt.notNull).toBe(true);
    });

    it('默认值应使用 sql`(CURRENT_TIMESTAMP)`', () => {
      assertCurrentTimestampDefault(memos.updatedAt);
    });
  });

  describe('外键：userId → users.id', () => {
    it('应存在指向 users.id 的外键', () => {
      const { ref } = getForeignKey(memos, 'user_id');
      const foreignTableName = getTableConfig(ref.foreignTable).name;
      expect(foreignTableName).toBe('users');
      expect(ref.foreignColumns[0].name).toBe('id');
    });

    it('外键 onDelete 策略应为 "cascade"', () => {
      const { fk } = getForeignKey(memos, 'user_id');
      expect(fk.onDelete).toBe('cascade');
    });
  });
});

// ─── 4. tags 表 ──────────────────────────────────────────────────────────────

describe('tags 表', () => {
  let tags;

  beforeAll(() => {
    tags = schemaModule.tags;
  });

  it('表名应为 "tags"', () => {
    const config = getTableConfig(tags);
    expect(config.name).toBe('tags');
  });

  describe('id 列', () => {
    it('列名应为 "id"', () => {
      expect(tags.id.name).toBe('id');
    });

    it('类型应为 SQLiteText', () => {
      expect(tags.id.columnType).toBe('SQLiteText');
    });

    it('应为主键（primary: true）', () => {
      expect(tags.id.primary).toBe(true);
    });

    it('不应为空（notNull: true）', () => {
      expect(tags.id.notNull).toBe(true);
    });

    it('$defaultFn 应生成符合 UUID v4 格式的字符串', () => {
      assertUuidDefaultFn(tags.id);
    });
  });

  describe('name 列', () => {
    it('列名应为 "name"', () => {
      expect(tags.name.name).toBe('name');
    });

    it('类型应为 SQLiteText', () => {
      expect(tags.name.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(tags.name.notNull).toBe(true);
    });
  });

  describe('userId 列', () => {
    it('列名应为 "user_id"', () => {
      expect(tags.userId.name).toBe('user_id');
    });

    it('类型应为 SQLiteText', () => {
      expect(tags.userId.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(tags.userId.notNull).toBe(true);
    });
  });

  describe('createdAt 列', () => {
    it('列名应为 "created_at"', () => {
      expect(tags.createdAt.name).toBe('created_at');
    });

    it('类型应为 SQLiteText', () => {
      expect(tags.createdAt.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(tags.createdAt.notNull).toBe(true);
    });

    it('默认值应使用 sql`(CURRENT_TIMESTAMP)`', () => {
      assertCurrentTimestampDefault(tags.createdAt);
    });
  });

  it('表中不应存在 updatedAt 列（tags 表无需此字段）', () => {
    expect(tags.updatedAt).toBeUndefined();
  });

  it('表中不应存在 memoCount 列（计数通过聚合查询实时计算）', () => {
    expect(tags.memoCount).toBeUndefined();
  });

  describe('外键：userId → users.id', () => {
    it('应存在指向 users.id 的外键', () => {
      const { ref } = getForeignKey(tags, 'user_id');
      const foreignTableName = getTableConfig(ref.foreignTable).name;
      expect(foreignTableName).toBe('users');
      expect(ref.foreignColumns[0].name).toBe('id');
    });

    it('外键 onDelete 策略应为 "cascade"', () => {
      const { fk } = getForeignKey(tags, 'user_id');
      expect(fk.onDelete).toBe('cascade');
    });
  });
});

// ─── 5. memo_tags 表 ─────────────────────────────────────────────────────────

describe('memo_tags 表', () => {
  let memoTags;

  beforeAll(() => {
    memoTags = schemaModule.memoTags;
  });

  it('表名应为 "memo_tags"', () => {
    const config = getTableConfig(memoTags);
    expect(config.name).toBe('memo_tags');
  });

  describe('memoId 列', () => {
    it('列名应为 "memo_id"', () => {
      expect(memoTags.memoId.name).toBe('memo_id');
    });

    it('类型应为 SQLiteText', () => {
      expect(memoTags.memoId.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memoTags.memoId.notNull).toBe(true);
    });

    it('不应为主键（关联表无独立主键）', () => {
      expect(memoTags.memoId.primary).toBe(false);
    });
  });

  describe('tagId 列', () => {
    it('列名应为 "tag_id"', () => {
      expect(memoTags.tagId.name).toBe('tag_id');
    });

    it('类型应为 SQLiteText', () => {
      expect(memoTags.tagId.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memoTags.tagId.notNull).toBe(true);
    });

    it('不应为主键（关联表无独立主键）', () => {
      expect(memoTags.tagId.primary).toBe(false);
    });
  });

  it('表中不应存在 id 主键列（多对多关联表无独立主键）', () => {
    expect(memoTags.id).toBeUndefined();
  });

  describe('外键：memoId → memos.id', () => {
    it('应存在指向 memos.id 的外键', () => {
      const { ref } = getForeignKey(memoTags, 'memo_id');
      const foreignTableName = getTableConfig(ref.foreignTable).name;
      expect(foreignTableName).toBe('memos');
      expect(ref.foreignColumns[0].name).toBe('id');
    });

    it('外键 onDelete 策略应为 "cascade"', () => {
      const { fk } = getForeignKey(memoTags, 'memo_id');
      expect(fk.onDelete).toBe('cascade');
    });
  });

  describe('外键：tagId → tags.id', () => {
    it('应存在指向 tags.id 的外键', () => {
      const { ref } = getForeignKey(memoTags, 'tag_id');
      const foreignTableName = getTableConfig(ref.foreignTable).name;
      expect(foreignTableName).toBe('tags');
      expect(ref.foreignColumns[0].name).toBe('id');
    });

    it('外键 onDelete 策略应为 "cascade"', () => {
      const { fk } = getForeignKey(memoTags, 'tag_id');
      expect(fk.onDelete).toBe('cascade');
    });
  });

  it('表应具有恰好 2 个外键约束', () => {
    const { foreignKeys } = getTableConfig(memoTags);
    expect(foreignKeys).toHaveLength(2);
  });
});

// ─── 6. memo_images 表 ───────────────────────────────────────────────────────

describe('memo_images 表', () => {
  let memoImages;

  beforeAll(() => {
    memoImages = schemaModule.memoImages;
  });

  it('表名应为 "memo_images"', () => {
    const config = getTableConfig(memoImages);
    expect(config.name).toBe('memo_images');
  });

  describe('id 列', () => {
    it('列名应为 "id"', () => {
      expect(memoImages.id.name).toBe('id');
    });

    it('类型应为 SQLiteText', () => {
      expect(memoImages.id.columnType).toBe('SQLiteText');
    });

    it('应为主键（primary: true）', () => {
      expect(memoImages.id.primary).toBe(true);
    });

    it('不应为空（notNull: true）', () => {
      expect(memoImages.id.notNull).toBe(true);
    });

    it('$defaultFn 应生成符合 UUID v4 格式的字符串', () => {
      assertUuidDefaultFn(memoImages.id);
    });
  });

  describe('memoId 列', () => {
    it('列名应为 "memo_id"', () => {
      expect(memoImages.memoId.name).toBe('memo_id');
    });

    it('类型应为 SQLiteText', () => {
      expect(memoImages.memoId.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memoImages.memoId.notNull).toBe(true);
    });
  });

  describe('url 列', () => {
    it('列名应为 "url"', () => {
      expect(memoImages.url.name).toBe('url');
    });

    it('类型应为 SQLiteText', () => {
      expect(memoImages.url.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memoImages.url.notNull).toBe(true);
    });
  });

  describe('fileSize 列', () => {
    it('列名应为 "file_size"', () => {
      expect(memoImages.fileSize.name).toBe('file_size');
    });

    it('类型应为 SQLiteInteger（integer 列）', () => {
      expect(memoImages.fileSize.columnType).toBe('SQLiteInteger');
    });

    it('不应为空（notNull: true）', () => {
      expect(memoImages.fileSize.notNull).toBe(true);
    });
  });

  describe('mimeType 列', () => {
    it('列名应为 "mime_type"', () => {
      expect(memoImages.mimeType.name).toBe('mime_type');
    });

    it('类型应为 SQLiteText', () => {
      expect(memoImages.mimeType.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memoImages.mimeType.notNull).toBe(true);
    });
  });

  describe('uploadedAt 列', () => {
    it('列名应为 "uploaded_at"', () => {
      expect(memoImages.uploadedAt.name).toBe('uploaded_at');
    });

    it('类型应为 SQLiteText', () => {
      expect(memoImages.uploadedAt.columnType).toBe('SQLiteText');
    });

    it('不应为空（notNull: true）', () => {
      expect(memoImages.uploadedAt.notNull).toBe(true);
    });

    it('默认值应使用 sql`(CURRENT_TIMESTAMP)`', () => {
      assertCurrentTimestampDefault(memoImages.uploadedAt);
    });
  });

  describe('外键：memoId → memos.id', () => {
    it('应存在指向 memos.id 的外键', () => {
      const { ref } = getForeignKey(memoImages, 'memo_id');
      const foreignTableName = getTableConfig(ref.foreignTable).name;
      expect(foreignTableName).toBe('memos');
      expect(ref.foreignColumns[0].name).toBe('id');
    });

    it('外键 onDelete 策略应为 "cascade"', () => {
      const { fk } = getForeignKey(memoImages, 'memo_id');
      expect(fk.onDelete).toBe('cascade');
    });
  });

  it('表应具有恰好 1 个外键约束', () => {
    const { foreignKeys } = getTableConfig(memoImages);
    expect(foreignKeys).toHaveLength(1);
  });
});

// ─── 7. UUID 生成唯一性验证 ───────────────────────────────────────────────────

describe('UUID 生成唯一性', () => {
  it('users.id 的 $defaultFn 每次调用应生成不同的 UUID', () => {
    const { users } = schemaModule;
    const id1 = users.id.defaultFn();
    const id2 = users.id.defaultFn();
    expect(id1).not.toBe(id2);
  });

  it('memos.id 的 $defaultFn 每次调用应生成不同的 UUID', () => {
    const { memos } = schemaModule;
    const id1 = memos.id.defaultFn();
    const id2 = memos.id.defaultFn();
    expect(id1).not.toBe(id2);
  });

  it('tags.id 的 $defaultFn 每次调用应生成不同的 UUID', () => {
    const { tags } = schemaModule;
    const id1 = tags.id.defaultFn();
    const id2 = tags.id.defaultFn();
    expect(id1).not.toBe(id2);
  });

  it('memoImages.id 的 $defaultFn 每次调用应生成不同的 UUID', () => {
    const { memoImages } = schemaModule;
    const id1 = memoImages.id.defaultFn();
    const id2 = memoImages.id.defaultFn();
    expect(id1).not.toBe(id2);
  });
});

// ─── 8. db/index.js — 数据库实例导出 ─────────────────────────────────────────

describe('db/index.js — 数据库实例导出', () => {
  it('应有默认导出', () => {
    expect(dbModule.default).toBeDefined();
  });

  it('默认导出应为对象（Drizzle 数据库实例）', () => {
    expect(typeof dbModule.default).toBe('object');
    expect(dbModule.default).not.toBeNull();
  });

  it('数据库实例应具备 select 方法（Drizzle 查询构建器）', () => {
    const db = dbModule.default;
    expect(typeof db.select).toBe('function');
  });

  it('数据库实例应具备 insert 方法', () => {
    const db = dbModule.default;
    expect(typeof db.insert).toBe('function');
  });

  it('数据库实例应具备 update 方法', () => {
    const db = dbModule.default;
    expect(typeof db.update).toBe('function');
  });

  it('数据库实例应具备 delete 方法', () => {
    const db = dbModule.default;
    expect(typeof db.delete).toBe('function');
  });
});
