/**
 * T001 配置验证测试
 *
 * 验证 Monorepo 根配置及 apps/server 子包骨架是否正确初始化：
 *   - pnpm-workspace.yaml 包含 apps/server 和 apps/mobile
 *   - 根目录 package.json 包含 dev、build、lint 脚本
 *   - .env 文件包含四个必要环境变量
 *   - apps/server/package.json 包含六条脚本及全部必要依赖
 *   - apps/server/drizzle.config.js 文件存在且是有效的 JS 模块
 *
 * 这些测试在 RED 阶段应全部失败。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径常量：从 apps/server/tests/ 向上三级到达 monorepo 根目录
const ROOT_DIR = path.resolve(__dirname, '../../..');
const SERVER_DIR = path.resolve(__dirname, '..');

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/**
 * 读取并解析 JSON 文件，文件不存在时返回 null。
 */
function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 读取文本文件，文件不存在时返回 null。
 */
function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * 检查文件是否存在（不抛出异常）。
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

// ── 1. pnpm-workspace.yaml ───────────────────────────────────────────────────
describe('pnpm-workspace.yaml', () => {
  const workspaceFilePath = path.join(ROOT_DIR, 'pnpm-workspace.yaml');

  it('文件应存在于 monorepo 根目录', () => {
    expect(fileExists(workspaceFilePath)).toBe(true);
  });

  it('应包含 apps/server workspace', () => {
    const content = readText(workspaceFilePath);
    expect(content).not.toBeNull();
    // YAML 列表项格式：`- 'apps/server'` 或 `- "apps/server"` 或 `- apps/server`
    expect(content).toMatch(/apps\/server/);
  });

  it('应包含 apps/mobile workspace', () => {
    const content = readText(workspaceFilePath);
    expect(content).not.toBeNull();
    expect(content).toMatch(/apps\/mobile/);
  });
});

// ── 2. 根目录 package.json ───────────────────────────────────────────────────
describe('根目录 package.json', () => {
  const rootPkgPath = path.join(ROOT_DIR, 'package.json');

  it('文件应存在于 monorepo 根目录', () => {
    expect(fileExists(rootPkgPath)).toBe(true);
  });

  it('应包含 dev 脚本', () => {
    const pkg = readJson(rootPkgPath);
    expect(pkg).not.toBeNull();
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts).toHaveProperty('dev');
  });

  it('应包含 build 脚本', () => {
    const pkg = readJson(rootPkgPath);
    expect(pkg).not.toBeNull();
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts).toHaveProperty('build');
  });

  it('应包含 lint 脚本', () => {
    const pkg = readJson(rootPkgPath);
    expect(pkg).not.toBeNull();
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts).toHaveProperty('lint');
  });
});

// ── 3. 根目录 .env ───────────────────────────────────────────────────────────
describe('根目录 .env', () => {
  const envFilePath = path.join(ROOT_DIR, '.env');

  it('文件应存在于 monorepo 根目录', () => {
    expect(fileExists(envFilePath)).toBe(true);
  });

  it('应包含 DB_PATH 环境变量', () => {
    const content = readText(envFilePath);
    expect(content).not.toBeNull();
    // 匹配 KEY=value 形式，允许行首有任意空白
    expect(content).toMatch(/^\s*DB_PATH\s*=/m);
  });

  it('应包含 SESSION_SECRET 环境变量', () => {
    const content = readText(envFilePath);
    expect(content).not.toBeNull();
    expect(content).toMatch(/^\s*SESSION_SECRET\s*=/m);
  });

  it('应包含 CORS_ORIGIN 环境变量', () => {
    const content = readText(envFilePath);
    expect(content).not.toBeNull();
    expect(content).toMatch(/^\s*CORS_ORIGIN\s*=/m);
  });

  it('应包含 EXPO_PUBLIC_API_URL 环境变量', () => {
    const content = readText(envFilePath);
    expect(content).not.toBeNull();
    expect(content).toMatch(/^\s*EXPO_PUBLIC_API_URL\s*=/m);
  });
});

// ── 4. apps/server/package.json 脚本 ────────────────────────────────────────
describe('apps/server/package.json — scripts', () => {
  const serverPkgPath = path.join(SERVER_DIR, 'package.json');

  it('文件应存在于 apps/server 目录', () => {
    expect(fileExists(serverPkgPath)).toBe(true);
  });

  const REQUIRED_SCRIPTS = ['dev', 'build', 'lint', 'prod', 'db:generate', 'db:migrate'];

  REQUIRED_SCRIPTS.forEach((script) => {
    it(`应包含 "${script}" 脚本`, () => {
      const pkg = readJson(serverPkgPath);
      expect(pkg).not.toBeNull();
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts).toHaveProperty(script);
      // 脚本值不能为空字符串
      expect(typeof pkg.scripts[script]).toBe('string');
      expect(pkg.scripts[script].trim().length).toBeGreaterThan(0);
    });
  });
});

// ── 5. apps/server/package.json 依赖 ────────────────────────────────────────
describe('apps/server/package.json — dependencies', () => {
  const serverPkgPath = path.join(SERVER_DIR, 'package.json');

  const REQUIRED_DEPENDENCIES = [
    'fastify',
    'drizzle-orm',
    'better-sqlite3',
    '@fastify/session',
    '@fastify/cookie',
    '@fastify/cors',
    '@fastify/multipart',
  ];

  REQUIRED_DEPENDENCIES.forEach((dep) => {
    it(`应在 dependencies 中声明 "${dep}"`, () => {
      const pkg = readJson(serverPkgPath);
      expect(pkg).not.toBeNull();

      // 依赖可能在 dependencies 或 devDependencies 中声明
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };

      expect(allDeps).toHaveProperty(dep);
      // 版本号不能为空字符串
      expect(typeof allDeps[dep]).toBe('string');
      expect(allDeps[dep].trim().length).toBeGreaterThan(0);
    });
  });
});

// ── 6. apps/server/drizzle.config.js ────────────────────────────────────────
describe('apps/server/drizzle.config.js', () => {
  const drizzleConfigPath = path.join(SERVER_DIR, 'drizzle.config.js');

  it('文件应存在于 apps/server 目录', () => {
    expect(fileExists(drizzleConfigPath)).toBe(true);
  });

  it('文件内容应为非空的 JavaScript 模块', () => {
    const content = readText(drizzleConfigPath);
    expect(content).not.toBeNull();
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it('应通过 import() 动态导入（有效的 ES 模块）', async () => {
    // 如果文件不存在或存在语法错误，import() 会抛出异常，测试失败
    const mod = await import(drizzleConfigPath);
    // 默认导出或命名导出均可，只要模块可以成功加载即为合法 JS 模块
    expect(mod).toBeDefined();
  });

  it('导出的配置对象应包含 dialect 字段（值为 "sqlite"）', async () => {
    const mod = await import(drizzleConfigPath);
    // Drizzle Kit 配置支持默认导出
    const config = mod.default ?? mod;
    expect(config).toBeDefined();
    expect(config.dialect).toBe('sqlite');
  });

  it('导出的配置对象应包含 dbCredentials.url 字段（指向 DB_PATH）', async () => {
    const mod = await import(drizzleConfigPath);
    const config = mod.default ?? mod;
    expect(config).toBeDefined();
    expect(config.dbCredentials).toBeDefined();
    // url 字段不能为空，代表实际的 SQLite 文件路径
    expect(typeof config.dbCredentials.url).toBe('string');
    expect(config.dbCredentials.url.trim().length).toBeGreaterThan(0);
  });

  it('导出的配置对象应包含 schema 字段（指向 schema 文件）', async () => {
    const mod = await import(drizzleConfigPath);
    const config = mod.default ?? mod;
    expect(config).toBeDefined();
    expect(typeof config.schema).toBe('string');
    expect(config.schema.trim().length).toBeGreaterThan(0);
  });

  it('导出的配置对象应包含 out 字段（迁移产物输出目录）', async () => {
    const mod = await import(drizzleConfigPath);
    const config = mod.default ?? mod;
    expect(config).toBeDefined();
    expect(typeof config.out).toBe('string');
    expect(config.out.trim().length).toBeGreaterThan(0);
  });
});
