# API Contracts: Auth Routes

**前缀**: `/api/auth`
**服务**: Fastify（`apps/server`）

---

## POST /api/auth/login

登录接口，验证账号密码，成功后建立 Session。

### Request

```
POST /api/auth/login
Content-Type: application/json
```

**Body**:
```json
{
  "username": "yixiang",
  "password": "666666"
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "required": ["username", "password"],
  "properties": {
    "username": { "type": "string", "minLength": 1, "maxLength": 50 },
    "password": { "type": "string", "minLength": 1 }
  }
}
```

### Response

**成功 (200)**:
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "username": "yixiang"
  },
  "message": "登录成功"
}
```
响应同时写入 `Set-Cookie: sessionId=...; HttpOnly; SameSite=Strict; Path=/`

**失败 - 凭证错误 (401)**:
```json
{
  "data": null,
  "error": "AUTH_FAILED",
  "message": "用户名或密码错误"
}
```

**失败 - 参数不合法 (400)**:
```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "请求参数不合法"
}
```

---

## POST /api/auth/logout

退出登录，销毁 Session。

### Request

```
POST /api/auth/logout
Cookie: sessionId=...
```

Body: 空（无需 body）

### Response

**成功 (200)**:
```json
{
  "data": null,
  "message": "已退出登录"
}
```

**说明**: 无论 Session 是否存在，均返回 200（幂等设计）。

---

## GET /api/auth/me

获取当前登录用户信息，用于前端 App 启动时恢复 Session 状态。

### Request

```
GET /api/auth/me
Cookie: sessionId=...
```

### Response

**已登录 (200)**:
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "username": "yixiang"
  },
  "message": "ok"
}
```

**未登录 (401)**:
```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "请先登录"
}
```

**注意**: 前端调用此接口失败（401）应静默处理，不显示错误 Toast——仅跳转登录页。

---

## 通用约定

- 所有接口均返回 `{ data, message }` 或 `{ data: null, error, message }`
- HTTP 状态码语义准确：200 成功，201 创建，400 参数错误，401 未认证，403 无权限，500 服务器错误
- Session Cookie 由 `@fastify/session` 自动管理，客户端无需手动处理
- 所有错误统一由全局 `setErrorHandler` 处理，路由内仅 `throw new AppError(...)`
