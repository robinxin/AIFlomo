/**
 * 配置文件正确性测试
 * 验证项目初始化后的配置文件是否符合规范
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const serverRoot = path.resolve(__dirname, '..');

describe('T001 - Monorepo 根配置及 apps/server 子包骨架', () => {
  describe('根目录配置文件', () => {
    it('pnpm-workspace.yaml 应该存在且包含 apps/server 和 apps/mobile', () => {
      const workspacePath = path.join(projectRoot, 'pnpm-workspace.yaml');
      expect(fs.existsSync(workspacePath)).toBe(true);

      const content = fs.readFileSync(workspacePath, 'utf-8');
      expect(content).toContain('apps/server');
      expect(content).toContain('apps/mobile');
    });

    it('根目录 package.json 应该存在且包含必要脚本', () => {
      const pkgPath = path.join(projectRoot, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      // 验证必要的脚本
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.dev).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.lint).toBeDefined();
    });

    it('.env 文件应该包含必要的环境变量', () => {
      const envPath = path.join(projectRoot, '.env');
      expect(fs.existsSync(envPath)).toBe(true);

      const content = fs.readFileSync(envPath, 'utf-8');

      // 验证新增的四个环境变量
      expect(content).toMatch(/DB_PATH\s*=/);
      expect(content).toMatch(/SESSION_SECRET\s*=/);
      expect(content).toMatch(/CORS_ORIGIN\s*=/);
      expect(content).toMatch(/EXPO_PUBLIC_API_URL\s*=/);
    });
  });

  describe('apps/server 子包配置', () => {
    it('apps/server/package.json 应该存在', () => {
      const pkgPath = path.join(serverRoot, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
    });

    it('apps/server/package.json 应该包含必要的脚本', () => {
      const pkgPath = path.join(serverRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      // 验证六条必要脚本
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.dev).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.lint).toBeDefined();
      expect(pkg.scripts.prod).toBeDefined();
      expect(pkg.scripts['db:generate']).toBeDefined();
      expect(pkg.scripts['db:migrate']).toBeDefined();
    });

    it('apps/server/package.json 应该包含必要的依赖', () => {
      const pkgPath = path.join(serverRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      // 验证核心依赖
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(deps.fastify).toBeDefined();
      expect(deps['drizzle-orm']).toBeDefined();
      expect(deps['better-sqlite3']).toBeDefined();
      expect(deps['@fastify/session']).toBeDefined();
      expect(deps['@fastify/cookie']).toBeDefined();
      expect(deps['@fastify/cors']).toBeDefined();
      expect(deps['@fastify/multipart']).toBeDefined();
    });

    it('apps/server/drizzle.config.js 应该存在', () => {
      const configPath = path.join(serverRoot, 'drizzle.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('apps/server/drizzle.config.js 应该正确配置 SQLite', () => {
      const configPath = path.join(serverRoot, 'drizzle.config.js');
      const content = fs.readFileSync(configPath, 'utf-8');

      // 验证配置内容
      expect(content).toContain('sqlite');
      expect(content).toContain('DB_PATH');
    });
  });

  describe('安全性测试', () => {
    it('.env 中的 SESSION_SECRET 不应该为空或默认值', () => {
      const envPath = path.join(projectRoot, '.env');
      const content = fs.readFileSync(envPath, 'utf-8');

      // 提取 SESSION_SECRET 的值
      const match = content.match(/SESSION_SECRET\s*=\s*["']?([^"\n\r]+)["']?/);
      expect(match).toBeTruthy();

      const secret = match[1].trim();
      expect(secret).toBeTruthy();
      expect(secret.length).toBeGreaterThanOrEqual(32); // 至少 32 字符
      expect(secret).not.toBe('change-me');
      expect(secret).not.toBe('secret');
      expect(secret).not.toBe('your-secret-here');
    });

    it('DB_PATH 应该指向项目目录内的文件', () => {
      const envPath = path.join(projectRoot, '.env');
      const content = fs.readFileSync(envPath, 'utf-8');

      const match = content.match(/DB_PATH\s*=\s*["']?([^"\n\r]+)["']?/);
      expect(match).toBeTruthy();

      const dbPath = match[1].trim();
      expect(dbPath).toBeTruthy();
      expect(dbPath).not.toContain('../'); // 不应该指向项目外部
      expect(dbPath).toMatch(/\.db$/); // 应该是 .db 文件
    });

    it('CORS_ORIGIN 应该有明确的值', () => {
      const envPath = path.join(projectRoot, '.env');
      const content = fs.readFileSync(envPath, 'utf-8');

      const match = content.match(/CORS_ORIGIN\s*=\s*["']?([^"\n\r]+)["']?/);
      expect(match).toBeTruthy();

      const origin = match[1].trim();
      expect(origin).toBeTruthy();
      expect(origin).toMatch(/^https?:\/\//); // 应该是有效的 URL
    });

    it('EXPO_PUBLIC_API_URL 应该是有效的 URL', () => {
      const envPath = path.join(projectRoot, '.env');
      const content = fs.readFileSync(envPath, 'utf-8');

      const match = content.match(/EXPO_PUBLIC_API_URL\s*=\s*["']?([^"\n\r]+)["']?/);
      expect(match).toBeTruthy();

      const apiUrl = match[1].trim();
      expect(apiUrl).toBeTruthy();
      expect(apiUrl).toMatch(/^https?:\/\//); // 应该是有效的 URL
    });
  });

  describe('边界场景测试', () => {
    it('package.json 文件应该是有效的 JSON', () => {
      const rootPkg = path.join(projectRoot, 'package.json');
      const serverPkg = path.join(serverRoot, 'package.json');

      expect(() => JSON.parse(fs.readFileSync(rootPkg, 'utf-8'))).not.toThrow();
      expect(() => JSON.parse(fs.readFileSync(serverPkg, 'utf-8'))).not.toThrow();
    });

    it('.env 文件不应该包含空值变量', () => {
      const envPath = path.join(projectRoot, '.env');
      const content = fs.readFileSync(envPath, 'utf-8');

      // 检查是否有空值
      const emptyVars = content.match(/^[A-Z_]+\s*=\s*$/gm);
      expect(emptyVars).toBeNull();
    });

    it('drizzle.config.js 应该能正确导入', async () => {
      const configPath = path.join(serverRoot, 'drizzle.config.js');

      // 尝试导入配置文件
      await expect(import(configPath)).resolves.toBeDefined();
    });
  });
});
