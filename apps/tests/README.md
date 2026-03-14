# E2E 测试文档

## 测试文件说明

本目录包含账号注册与登录功能的端到端（E2E）测试，基于 Playwright 测试框架。

### 测试文件列表

| 文件名 | 测试内容 | 测试用例数 |
|--------|---------|-----------|
| `auth-register.spec.js` | 用户注册功能（UI + API） | ~30 条 |
| `auth-login.spec.js` | 用户登录功能（UI + API） | ~10 条 |
| `auth-logout.spec.js` | 用户登出功能（UI + API） | ~5 条 |
| `auth-me.spec.js` | 获取当前登录用户信息（UI + API） | ~5 条 |
| `auth-global-state.spec.js` | 全局认证状态管理 + 完整用户旅程 | ~8 条 |

**总计**: 约 **58 条测试用例**

### 测试覆盖范围

#### UI 测试（使用 `page` fixture）
- 用户交互流程（表单填写、按钮点击、页面跳转）
- 前端表单验证（失焦验证、提交前验证）
- 错误提示展示（表单顶部错误、字段级错误）
- 加载状态管理（按钮禁用、输入框禁用）
- 路由守卫（未登录重定向、已登录自动跳转）

#### API 测试（使用 `request` fixture）
- 接口参数验证（必填字段、格式校验、长度限制）
- 成功响应格式验证（状态码、响应体结构）
- 失败响应格式验证（错误信息、状态码）
- Session 管理（Cookie 设置、Session 销毁）
- 边界场景（并发注册、数据库异常）

## 运行测试

### 前置条件

1. 安装依赖
   ```bash
   pnpm install
   ```

2. 启动后端服务
   ```bash
   cd apps/server
   pnpm dev
   ```

3. 启动前端服务
   ```bash
   cd apps/mobile
   pnpm dev --web
   ```

### 运行所有测试

```bash
# 在项目根目录运行
pnpm test

# 或使用 Playwright 命令
npx playwright test
```

### 运行特定测试文件

```bash
# 只运行注册功能测试
npx playwright test apps/tests/auth-register.spec.js

# 只运行登录功能测试
npx playwright test apps/tests/auth-login.spec.js

# 只运行完整用户旅程测试
npx playwright test apps/tests/auth-global-state.spec.js
```

### 调试模式

```bash
# 使用 UI 模式运行测试（推荐）
npx playwright test --ui

# 使用 headed 模式（显示浏览器窗口）
npx playwright test --headed

# 调试特定测试
npx playwright test --debug apps/tests/auth-register.spec.js
```

### 查看测试报告

```bash
# 查看 HTML 测试报告
npx playwright show-report
```

## 测试数据说明

### 测试账号

测试用例会自动创建和清理测试账号，无需手动准备测试数据。

每个测试用例使用独立的邮箱地址，避免数据冲突：
- `user@example.com` - 基础测试账号
- `newuser@example.com` - 注册测试
- `trimtest@example.com` - trim 测试
- `min@example.com` / `max@example.com` - 边界值测试
- 等等

### 数据隔离

建议在测试环境中使用独立的测试数据库：

```bash
# 测试前重置数据库
cd apps/server
pnpm db:reset
pnpm db:migrate
```

## testID 映射表

前端组件需要添加以下 `data-testid` 属性以支持测试：

### 注册页面 (`/register`)

| testID | 组件 | 说明 |
|--------|------|------|
| `email-input` | 邮箱输入框 | 用于输入邮箱 |
| `nickname-input` | 昵称输入框 | 用于输入昵称 |
| `password-input` | 密码输入框 | 用于输入密码 |
| `password-toggle` | 密码显示切换按钮 | 眼睛图标按钮 |
| `privacy-checkbox` | 隐私协议勾选框 | 隐私协议勾选 |
| `submit-button` | 提交按钮 | 注册按钮 |
| `login-link` | 返回登录链接 | "返回登录"链接 |
| `email-error` | 邮箱错误提示 | 邮箱字段下方错误文字 |
| `nickname-error` | 昵称错误提示 | 昵称字段下方错误文字 |
| `password-error` | 密码错误提示 | 密码字段下方错误文字 |
| `privacy-error` | 隐私协议错误提示 | 隐私协议错误文字 |
| `form-error` | 表单顶部错误提示 | 服务端错误提示区域 |

### 登录页面 (`/login`)

| testID | 组件 | 说明 |
|--------|------|------|
| `email-input` | 邮箱输入框 | 用于输入邮箱 |
| `password-input` | 密码输入框 | 用于输入密码 |
| `password-toggle` | 密码显示切换按钮 | 眼睛图标按钮 |
| `submit-button` | 提交按钮 | 登录按钮 |
| `register-link` | 立即注册链接 | "立即注册"链接 |
| `form-error` | 表单顶部错误提示 | 服务端错误提示区域 |

### 其他页面

| testID | 组件 | 说明 |
|--------|------|------|
| `logout-button` | 登出按钮 | 个人中心登出按钮（未来实现） |

## CI/CD 集成

在 GitHub Actions 或其他 CI 环境中运行测试：

```yaml
# .github/workflows/e2e.yml 示例
- name: Run E2E tests
  run: |
    pnpm install
    pnpm build
    pnpm test
  env:
    CI: true
```

## 常见问题

### 1. 测试失败：端口已被占用

**问题**：后端或前端服务未启动，或端口被其他服务占用

**解决方案**：
```bash
# 检查端口占用
lsof -i :3000  # 后端端口
lsof -i :8082  # 前端端口

# 终止占用进程或修改配置文件中的端口
```

### 2. 测试失败：Session Cookie 未设置

**问题**：API 响应未包含 `Set-Cookie` 头

**解决方案**：
- 检查后端 Session 插件配置
- 确保 `cookie.httpOnly = true` 和 `cookie.sameSite = 'strict'` 正确设置
- 检查 CORS 配置允许 `credentials: 'include'`

### 3. 测试失败：数据库已存在相同邮箱

**问题**：测试数据未清理，导致邮箱冲突

**解决方案**：
```bash
# 重置测试数据库
cd apps/server
pnpm db:reset
pnpm db:migrate
```

### 4. 测试超时

**问题**：网络请求或页面加载超时

**解决方案**：
- 检查后端服务是否正常运行
- 检查前端服务是否正常运行
- 增加超时时间（在 `playwright.config.js` 中配置）

## 测试最佳实践

1. **测试隔离**：每个测试用例使用独立的测试数据，避免相互影响
2. **数据清理**：测试前清空数据库，确保环境干净
3. **等待策略**：使用 `waitForResponse` 等待 API 响应，而非 `waitForTimeout`
4. **错误验证**：验证错误提示文字和状态码，确保用户体验一致
5. **并发测试**：注意并发注册等场景的测试，验证数据库约束生效

## 参考文档

- [Playwright 官方文档](https://playwright.dev/)
- [测试用例文档](../../specs/active/43-feature-account-registration-login-3-testcases.md)
- [技术方案文档](../../specs/active/43-feature-account-registration-login-3-design.md)
- [项目 CLAUDE.md](../../CLAUDE.md)
