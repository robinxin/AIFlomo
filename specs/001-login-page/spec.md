# Feature Spec: 账号密码登录

**作者**: AI Agent
**日期**: 2026-03-04
**状态**: 已批准
**关联 Issue**: N/A
**分支**: `001-login-page`

---

## 1. 背景

AIFlomo 是一个复刻 Flomo 体验的全栈 MVP，目标是打通"输入→存储→回看"闭环。
登录功能是使用任何受保护功能的前提，因此需要先实现账号密码认证。

MVP 阶段使用预置账号，无需开放注册，降低实现复杂度。

---

## 2. 需求

### 2.1 核心需求

- 实现一个登录页面，支持账号 + 密码输入
- 后端校验通过后建立 Session，写入 Cookie
- 登录成功后跳转到主应用页（暂时是占位页）
- 已登录用户访问登录页时自动跳转到主应用页
- 未登录用户访问受保护页时自动重定向到登录页

### 2.2 预置账号

| 字段 | 值 |
|------|-----|
| 用户名 | `yixiang` |
| 密码   | `666666` |

密码存储为 bcrypt hash（saltRounds = 10）。

### 2.3 UI 要求

- 输入框：用户名、密码
- 提交按钮：加载中显示 ActivityIndicator，禁止重复提交
- 错误提示：登录失败时展示错误信息（前端校验 + 后端返回）
- 简洁风格，参考 Flomo 绿色主题（`#4caf50`）

---

## 3. 范围

### 3.1 本期实现（001-login-page）

- [x] 后端：Fastify 服务器基础框架（monorepo 启动）
- [x] 后端：SQLite + Drizzle ORM 基础设置（users 表）
- [x] 后端：`POST /api/auth/login` 接口
- [x] 后端：`POST /api/auth/logout` 接口
- [x] 后端：`GET /api/auth/me` 接口（session 校验）
- [x] 后端：DB 种子脚本（写入 yixiang 账号）
- [x] 前端：Expo 项目基础框架（monorepo 启动）
- [x] 前端：`app/(auth)/login.jsx` 登录页
- [x] 前端：`context/AuthContext.jsx` 认证状态管理
- [x] 前端：`lib/api-client.js` API 客户端
- [x] 前端：路由保护（未登录跳 login，已登录跳 app）
- [x] 前端：主应用占位页（`app/(app)/index.jsx`）

### 3.2 本期不实现

- 用户注册功能
- 忘记密码 / 重置密码
- 多用户管理
- 记住我 / 持久化 Session Store（MVP 用内存 store）

---

## 4. 验收标准

1. 使用 `yixiang` / `666666` 登录成功，页面跳转到主应用占位页
2. 使用错误账号密码登录，显示"用户名或密码错误"
3. 空字段提交，显示前端校验错误
4. 刷新页面后，已登录用户保持登录状态（Session Cookie）
5. 访问 `/login` 时已登录用户自动跳转
6. 访问受保护路由时未登录用户自动跳转到 `/login`
