/**
 * T003 环境变量验证单元测试
 *
 * 验证 apps/server/src/lib/validate-env.js 中 validateEnv() 函数的行为：
 *   1. 所有必需变量齐全时不抛出错误
 *   2. 缺少任意一个必需变量时抛出包含变量名的错误
 *   3. SESSION_SECRET 长度不足 64 字符时抛出专用错误
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALIDATE_ENV_PATH = path.resolve(__dirname, '../../src/lib/validate-env.js');

let validateEnv;

// 保存并恢复 process.env，避免测试间污染
let originalEnv;

beforeAll(async () => {
  const mod = await import(VALIDATE_ENV_PATH);
  validateEnv = mod.validateEnv;
});

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  // 恢复所有被测试修改的环境变量
  for (const key of ['SESSION_SECRET', 'DB_PATH', 'CORS_ORIGIN']) {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/**
 * 设置一组合法的环境变量（满足所有校验条件）。
 */
function setValidEnv() {
  process.env.SESSION_SECRET = 'a'.repeat(64); // 恰好 64 字符，满足最低要求
  process.env.DB_PATH = './data/aiflomo.db';
  process.env.CORS_ORIGIN = 'http://localhost:8082';
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

describe('validateEnv()', () => {
  describe('所有必需变量均已设置', () => {
    it('变量齐全且有效时不应抛出错误', () => {
      setValidEnv();
      expect(() => validateEnv()).not.toThrow();
    });

    it('SESSION_SECRET 长度恰好为 64 字符时不应抛出错误', () => {
      setValidEnv();
      process.env.SESSION_SECRET = 'x'.repeat(64);
      expect(() => validateEnv()).not.toThrow();
    });

    it('SESSION_SECRET 长度超过 64 字符时不应抛出错误', () => {
      setValidEnv();
      process.env.SESSION_SECRET = 'x'.repeat(128);
      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('缺少必需变量时应抛出错误', () => {
    it('缺少 SESSION_SECRET 时应抛出含变量名的错误', () => {
      setValidEnv();
      delete process.env.SESSION_SECRET;
      expect(() => validateEnv()).toThrow(/SESSION_SECRET/);
    });

    it('缺少 DB_PATH 时应抛出含变量名的错误', () => {
      setValidEnv();
      delete process.env.DB_PATH;
      expect(() => validateEnv()).toThrow(/DB_PATH/);
    });

    it('缺少 CORS_ORIGIN 时应抛出含变量名的错误', () => {
      setValidEnv();
      delete process.env.CORS_ORIGIN;
      expect(() => validateEnv()).toThrow(/CORS_ORIGIN/);
    });

    it('同时缺少多个变量时错误信息应列出所有缺失变量', () => {
      setValidEnv();
      delete process.env.DB_PATH;
      delete process.env.CORS_ORIGIN;
      expect(() => validateEnv()).toThrow(/DB_PATH/);
      expect(() => validateEnv()).toThrow(/CORS_ORIGIN/);
    });

    it('缺少变量时抛出的应为 Error 实例', () => {
      setValidEnv();
      delete process.env.SESSION_SECRET;
      let thrown;
      try {
        validateEnv();
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(Error);
    });
  });

  describe('SESSION_SECRET 长度校验', () => {
    it('SESSION_SECRET 长度为 1 字符时应抛出长度不足错误', () => {
      setValidEnv();
      process.env.SESSION_SECRET = 'a';
      expect(() => validateEnv()).toThrow(/SESSION_SECRET/);
    });

    it('SESSION_SECRET 长度为 63 字符时应抛出长度不足错误', () => {
      setValidEnv();
      process.env.SESSION_SECRET = 'a'.repeat(63);
      expect(() => validateEnv()).toThrow(/SESSION_SECRET/);
    });

    it('SESSION_SECRET 为空字符串时应被识别为缺失变量', () => {
      setValidEnv();
      process.env.SESSION_SECRET = '';
      // 空字符串被 filter(!process.env[key]) 识别为 missing
      expect(() => validateEnv()).toThrow(/SESSION_SECRET/);
    });
  });
});
