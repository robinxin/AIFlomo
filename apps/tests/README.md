# AIFlomo 测试套件

本目录包含 AIFlomo 项目的所有自动化测试代码，基于测试用例文档生成。

## 测试框架

- **测试运行器**: Vitest
- **组件测试**: @testing-library/react
- **覆盖率**: @vitest/coverage-v8
- **环境**: happy-dom（轻量级 DOM 环境）

## 测试文件结构

```
apps/tests/
├── api-auth-register.test.js    # POST /api/auth/register (TC-001 ~ TC-022)
├── api-auth-login.test.js       # POST /api/auth/login (TC-023 ~ TC-033)
├── api-auth-logout.test.js      # POST /api/auth/logout (TC-034 ~ TC-035)
├── api-auth-me.test.js          # GET /api/auth/me (TC-036 ~ TC-037)
├── frontend-login-page.test.js  # 登录页面 /login (TC-038 ~ TC-042)
├── frontend-register-page.test.js # 注册页面 /register (TC-043 ~ TC-049)
├── frontend-auto-login.test.js  # 自动登录检测 (TC-050 ~ TC-051)
├── security.test.js             # 安全场景测试 (TC-052 ~ TC-057)
├── package.json                 # 测试依赖配置
├── vitest.config.js             # Vitest 配置
└── vitest.setup.js              # 全局测试设置
```

## 测试用例映射

所有测试用例 ID (TC-NNN) 均与测试用例文档一一对应：
- **源文档**: `specs/active/25-feature-user-registration-login-testcases.md`
- **总用例数**: 57 条
- **测试文件数**: 8 个

## 运行测试

```bash
# 进入测试目录
cd apps/tests

# 安装依赖
npm install

# 运行所有测试
npm test

# 监听模式（开发时使用）
npm run test:watch

# 查看测试 UI
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

## 注意事项

### API 测试 (TC-001 ~ TC-037)

API 测试目前使用 **模拟实现** (mocks)，因为后端代码尚未实现。当后端实现完成后：

1. 需要将 mock 替换为实际的 API 调用
2. 或使用集成测试框架（如 supertest）测试实际的 Fastify 路由

**当前状态**：测试文件已编写完成，但需要等待后端实现后才能运行通过。

### 前端测试 (TC-038 ~ TC-051)

前端测试包含 **占位符代码** (`expect(true).toBe(true)`)，因为前端组件尚未实现。当前端实现后：

1. 取消注释 TODO 标记的代码
2. 根据实际组件路径调整 import 语句
3. 实现真实的组件交互测试

**当前状态**：测试结构已定义，实际断言需在组件实现后补充。

### 安全测试 (TC-052 ~ TC-057)

安全测试覆盖以下场景：
- 密码 bcrypt 哈希存储
- Session Cookie 安全标志 (httpOnly, sameSite, secure)
- SQL 注入防护（通过 ORM 参数化查询）
- XSS 防护（前端纯文本渲染）

## TDD 工作流

本测试套件按照 TDD (Test-Driven Development) 流程生成：

1. ✅ **测试用例文档** (`testcases.md`) — 已完成
2. ✅ **测试代码生成** (本目录) — 已完成
3. ⏳ **运行测试** → 预期全部失败（红灯）
4. ⏳ **实现代码** → 使测试通过（绿灯）
5. ⏳ **重构优化** → 保持测试通过

## 依赖说明

测试套件新增了 Vitest 相关依赖，这与 CLAUDE.md 中提到的 midscene-pc 不同。原因：

- **midscene-pc**: E2E 测试框架，适合跨端集成测试
- **Vitest**: 单元/集成测试框架，适合 TDD 驱动开发

两者可以共存：
- Vitest 用于快速的单元测试和 API 测试
- midscene 用于完整的用户流程 E2E 测试

## 下一步

1. 安装测试依赖：`npm install`
2. 实现后端 API (`apps/server/`)
3. 实现前端组件 (`apps/mobile/`)
4. 逐步使测试通过
5. 添加 E2E 测试（midscene YAML 文件）

## 相关文档

- 测试用例规格：`specs/active/25-feature-user-registration-login-testcases.md`
- 功能规格：`specs/active/25-feature-user-registration-login.md`
- 技术设计：`specs/active/25-feature-user-registration-login-design.md`
