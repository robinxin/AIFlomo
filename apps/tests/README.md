# Playwright E2E 测试文件说明

本目录包含 AIFlomo 项目的端到端（E2E）测试文件，使用 Playwright 测试框架。

## 测试文件列表

| 文件名 | 测试模块 | 测试用例数 | 说明 |
|--------|---------|-----------|------|
| `auth-register.spec.js` | 用户注册 | 20+ | 包含正常场景、前端校验、后端校验、防重复提交 |
| `auth-login.spec.js` | 用户登录 | 10+ | 包含正常登录、邮箱大小写、异常场景、网络错误 |
| `auth-logout.spec.js` | 用户登出 | 3 | 包含登出成功、未登录访问、Session 过期 |
| `auth-me.spec.js` | 获取用户信息 | 3 | 包含获取成功、未登录访问、Session 过期 |
| `auth-navigation.spec.js` | 页面导航 | 5 | 包含登录/注册页面切换、表单数据清空 |
| `auth-form-validation.spec.js` | 表单验证 | 4 | 包含邮箱格式校验、密码掩码显示 |
| `auth-session-security.spec.js` | Session 安全 | 8 | 包含 Cookie 安全属性、密码加密、XSS 防护 |

## 运行方式

### 运行所有测试

```bash
npm test
```

### 运行特定测试文件

```bash
npx playwright test apps/tests/auth-register.spec.js
```

### 运行 UI 模式（可视化调试）

```bash
npm run test:ui
```

### 查看测试报告

```bash
npm run test:report
```

## 环境变量配置

在根目录的 `test.env` 文件中配置测试环境变量：

```bash
# API 后端地址
API_URL=http://localhost:3000

# 前端 Web 地址
WEB_URL=http://localhost:8082
```

## 测试设计原则

### 1. 测试类型分离

- **UI 测试**：使用 `page` fixture，模拟用户在浏览器中的真实操作
- **API 测试**：使用 `request` fixture，直接测试后端接口

### 2. 测试数据隔离

- 每个测试用例使用独立的测试数据（唯一邮箱）
- 使用 `beforeEach` 钩子准备测试环境
- 避免测试间相互影响

### 3. 等待策略

- 优先使用 `page.waitForURL()` 等待页面跳转
- 使用 `{ timeout: 3000 }` 避免无限等待
- 仅在必要时使用 `page.waitForTimeout()`

### 4. 断言清晰

- 每个测试用例验证一个核心功能点
- 使用 `expect().toBe()` / `toContain()` / `toBeVisible()` 等明确的断言
- 验证 HTTP 状态码、响应体结构、页面元素

## 测试覆盖的用例（来自测试用例文档）

所有测试用例均基于 `specs/active/28-feature-account-registration-login-2-testcases.md`，共覆盖 **52 条测试用例**：

### 用户注册（POST /api/auth/register）
- ✅ 6 条正常场景（有效信息、邮箱大小写、密码边界值、昵称边界值）
- ✅ 14 条异常场景（邮箱格式、未勾选协议、密码长度、昵称长度、字段缺失、重复注册、防重复提交、网络错误、数据库异常）

### 用户登录（POST /api/auth/login）
- ✅ 3 条正常场景（有效登录、邮箱大小写、Session 有效期）
- ✅ 7 条异常场景（邮箱不存在、密码错误、字段为空、防重复提交、网络错误）

### 用户登出（POST /api/auth/logout）
- ✅ 1 条正常场景（登出成功）
- ✅ 2 条异常场景（未登录、Session 过期）

### 获取当前用户信息（GET /api/auth/me）
- ✅ 1 条正常场景（获取信息成功）
- ✅ 2 条异常场景（未登录、Session 过期）

### 前端页面导航
- ✅ 4 条正常场景（登录/注册页面切换、注册成功跳转、登录成功跳转）
- ✅ 1 条异常场景（表单数据不保留）

### 前端表单验证
- ✅ 2 条正常场景（邮箱格式正确、密码长度符合）
- ✅ 2 条异常场景（实时邮箱校验、密码掩码显示）

### Session 安全
- ✅ 3 条 Cookie 安全属性测试（HttpOnly、SameSite、Secure）
- ✅ 1 条密码存储测试（bcrypt）
- ✅ 4 条安全防护测试（XSS、错误信息脱敏）

## 常见问题

### Q1: 测试失败提示"网络错误"

**原因**：后端服务未启动或端口配置错误

**解决**：
```bash
# 启动后端服务
npm run dev -w apps/server

# 检查端口是否正确（默认 3000）
curl http://localhost:3000/health
```

### Q2: UI 测试无法找到页面元素

**原因**：前端页面未启动或元素选择器不正确

**解决**：
```bash
# 启动前端服务
npm run dev -w apps/mobile

# 检查页面是否正常加载
open http://localhost:8082/login
```

### Q3: Session 安全测试在开发环境失败

**原因**：部分安全属性（如 `Secure`）仅在生产环境启用

**解决**：使用 `test.skip()` 跳过生产环境专用测试，或设置 `NODE_ENV=production` 运行

## 下一步

- [ ] 添加数据库状态验证（需后端提供测试 API）
- [ ] 添加性能测试（页面加载时间、API 响应时间）
- [ ] 添加移动端测试（Android、iOS WebView）
- [ ] 集成到 CI/CD 流程（GitHub Actions）
