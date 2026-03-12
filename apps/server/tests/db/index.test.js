/**
 * T004 数据库 index.js 单元测试
 *
 * 验证 apps/server/src/db/index.js 的安全行为：
 *   1. validateDbPath() 对合法路径不抛出错误
 *   2. validateDbPath() 对路径遍历尝试抛出明确错误
 *   3. 导出的数据库实例（:memory: 模式）具备 Drizzle 查询构建器方法
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_INDEX_PATH = path.resolve(__dirname, '../../src/db/index.js');

let validateDbPath;
let dbModule;

beforeAll(async () => {
  // 使用内存数据库，避免模块加载时在文件系统创建副作用
  process.env.DB_PATH = ':memory:';
  dbModule = await import(DB_INDEX_PATH);
  validateDbPath = dbModule.validateDbPath;
});

// ─── 1. validateDbPath() — 合法路径 ──────────────────────────────────────────

describe('validateDbPath() — 合法路径', () => {
  it(':memory: 应被允许（内存数据库跳过校验）', () => {
    expect(() => validateDbPath(':memory:')).not.toThrow();
  });

  it('./data/aiflomo.db 应被允许', () => {
    expect(() => validateDbPath('./data/aiflomo.db')).not.toThrow();
  });

  it('./data/test.db 应被允许', () => {
    expect(() => validateDbPath('./data/test.db')).not.toThrow();
  });

  it('./data/subdir/db.sqlite 应被允许', () => {
    expect(() => validateDbPath('./data/subdir/db.sqlite')).not.toThrow();
  });
});

// ─── 2. validateDbPath() — 非法路径（路径遍历攻击） ──────────────────────────

describe('validateDbPath() — 非法路径', () => {
  it('../secret.db（上级目录）应被拒绝', () => {
    expect(() => validateDbPath('../secret.db')).toThrow(/DB_PATH must resolve/);
  });

  it('/tmp/evil.db（绝对路径，不在 ./data 内）应被拒绝', () => {
    expect(() => validateDbPath('/tmp/evil.db')).toThrow(/DB_PATH must resolve/);
  });

  it('./data/../outside.db（规范化后逃出 data 目录）应被拒绝', () => {
    expect(() => validateDbPath('./data/../outside.db')).toThrow(/DB_PATH must resolve/);
  });

  it('/etc/passwd（系统文件路径）应被拒绝', () => {
    expect(() => validateDbPath('/etc/passwd')).toThrow(/DB_PATH must resolve/);
  });

  it('错误应为 Error 实例且包含实际解析后路径', () => {
    let thrown;
    try {
      validateDbPath('../secret.db');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toMatch(/DB_PATH must resolve/);
    expect(thrown.message).toMatch(/Got:/);
  });
});

// ─── 3. Drizzle 实例导出（:memory: 模式） ────────────────────────────────────

describe('db/index.js — Drizzle 实例导出（:memory: 模式）', () => {
  it('应有默认导出', () => {
    expect(dbModule.default).toBeDefined();
  });

  it('默认导出应为非 null 对象', () => {
    expect(typeof dbModule.default).toBe('object');
    expect(dbModule.default).not.toBeNull();
  });

  it('数据库实例应具备 select 方法', () => {
    expect(typeof dbModule.default.select).toBe('function');
  });

  it('数据库实例应具备 insert 方法', () => {
    expect(typeof dbModule.default.insert).toBe('function');
  });

  it('数据库实例应具备 update 方法', () => {
    expect(typeof dbModule.default.update).toBe('function');
  });

  it('数据库实例应具备 delete 方法', () => {
    expect(typeof dbModule.default.delete).toBe('function');
  });

  it('validateDbPath 应作为命名导出可用', () => {
    expect(typeof validateDbPath).toBe('function');
  });
});
