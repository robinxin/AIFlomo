# 测试用例文档：账号注册与登录

**关联 Spec**: specs/active/25-feature-user-registration-login.md
**生成日期**: 2026-03-04
**用例总数**: 45 条

---

## API 端点：POST /api/auth/register（用户注册）

### 正常场景

- **有效输入且勾选隐私协议，注册成功并自动登录**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "newuser@example.com", "password": "Password123", "nickname": "小明", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 201
    - 响应体：`{ data: { id, email: "newuser@example.com", nickname: "小明", createdAt }, message: "注册成功" }`
    - 数据库中新增一条 users 记录，email 为小写 "newuser@example.com"
    - passwordHash 字段是 bcrypt 哈希值，不是明文
    - 响应头 Set-Cookie 包含 Session Cookie（httpOnly=true, sameSite=strict）
    - Session 表中新增一条记录，data 字段包含 userId

- **邮箱包含大写字母，系统自动转为小写存储**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "User@Example.COM", "password": "Password123", "nickname": "测试用户", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 201
    - 响应体中 email 为 "user@example.com"（全小写）
    - 数据库中存储的 email 为 "user@example.com"

- **密码为边界值 8 位字符，包含字母和数字，注册成功**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "test8char@example.com", "password": "Pass1234", "nickname": "边界测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 201
    - 响应体：`{ data: { id, email, nickname, createdAt }, message: "注册成功" }`

- **密码为边界值 20 位字符，包含字母和数字，注册成功**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "test20char@example.com", "password": "Pass12345678901234567", "nickname": "边界测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 201
    - 响应体：`{ data: { id, email, nickname, createdAt }, message: "注册成功" }`

- **昵称为边界值 1 个字符，注册成功**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "testnick1@example.com", "password": "Password123", "nickname": "A", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 201
    - 响应体中 nickname 为 "A"

- **昵称为边界值 20 个字符，注册成功**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "testnick20@example.com", "password": "Password123", "nickname": "12345678901234567890", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 201
    - 响应体中 nickname 为 "12345678901234567890"

### 异常场景

- **邮箱已存在，返回 409**
  - 操作步骤：
    1. 先注册一个账号：`{ "email": "existing@example.com", "password": "Password123", "nickname": "已存在", "agreePrivacy": true }`
    2. 再次使用相同邮箱注册：`{ "email": "existing@example.com", "password": "NewPass456", "nickname": "新昵称", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 409
    - 响应体：`{ data: null, error: "EMAIL_EXISTS", message: "该邮箱已注册,请直接登录" }`

- **邮箱为空字符串，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "", "password": "Password123", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **邮箱格式不正确（缺少 @），返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "invalidemailexample.com", "password": "Password123", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **邮箱格式不正确（缺少域名），返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "user@", "password": "Password123", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **缺少 email 字段，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "password": "Password123", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **密码少于 8 位，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "short@example.com", "password": "Pass123", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **密码超过 20 位，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "long@example.com", "password": "Password123456789012345", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **密码只包含字母不包含数字，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "letteronly@example.com", "password": "PasswordOnly", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **密码只包含数字不包含字母，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "numberonly@example.com", "password": "12345678", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **密码为空字符串，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "emptypass@example.com", "password": "", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **缺少 password 字段，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "nopass@example.com", "nickname": "测试", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **昵称为空字符串，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "emptynick@example.com", "password": "Password123", "nickname": "", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **昵称超过 20 字符，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "longnick@example.com", "password": "Password123", "nickname": "123456789012345678901", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **缺少 nickname 字段，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "nonick@example.com", "password": "Password123", "agreePrivacy": true }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **agreePrivacy 为 false，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "disagree@example.com", "password": "Password123", "nickname": "测试", "agreePrivacy": false }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **缺少 agreePrivacy 字段，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/register
    2. Body：`{ "email": "noagree@example.com", "password": "Password123", "nickname": "测试" }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

---

## API 端点：POST /api/auth/login（用户登录）

### 正常场景

- **有效邮箱和密码，登录成功**
  - 操作步骤：
    1. 先注册一个账号（邮箱：login@example.com，密码：Password123）
    2. 发送 POST /api/auth/login
    3. Body：`{ "email": "login@example.com", "password": "Password123" }`
  - 预期结果：
    - 接口返回 200
    - 响应体：`{ data: { id, email: "login@example.com", nickname, lastLoginAt }, message: "登录成功" }`
    - lastLoginAt 字段不为 null，是当前时间的 ISO 8601 格式
    - 响应头 Set-Cookie 包含 Session Cookie
    - 数据库中该用户的 lastLoginAt 字段已更新

- **邮箱大小写不敏感，登录成功**
  - 操作步骤：
    1. 先注册一个账号（邮箱：casetest@example.com，密码：Password123）
    2. 发送 POST /api/auth/login
    3. Body：`{ "email": "CaseTest@Example.COM", "password": "Password123" }`
  - 预期结果：
    - 接口返回 200
    - 响应体：`{ data: { id, email: "casetest@example.com", nickname, lastLoginAt }, message: "登录成功" }`

- **Session 有效期内再次访问，无需重新登录**
  - 操作步骤：
    1. 用户已登录（上一步骤中的 Session Cookie 仍有效）
    2. 携带 Cookie 访问需要认证的端点（如 GET /api/auth/me）
  - 预期结果：
    - 接口返回 200
    - 响应体：`{ data: { id, email, nickname, createdAt, lastLoginAt }, message: "ok" }`

### 异常场景

- **邮箱不存在，返回 401**
  - 操作步骤：
    1. 发送 POST /api/auth/login
    2. Body：`{ "email": "notexist@example.com", "password": "Password123" }`
  - 预期结果：
    - 接口返回 401
    - 响应体：`{ data: null, error: "INVALID_CREDENTIALS", message: "邮箱或密码错误" }`
    - 错误提示不暴露"邮箱不存在"信息

- **密码错误，返回 401**
  - 操作步骤：
    1. 先注册一个账号（邮箱：wrongpass@example.com，密码：CorrectPass123）
    2. 发送 POST /api/auth/login
    3. Body：`{ "email": "wrongpass@example.com", "password": "WrongPass456" }`
  - 预期结果：
    - 接口返回 401
    - 响应体：`{ data: null, error: "INVALID_CREDENTIALS", message: "邮箱或密码错误" }`

- **邮箱为空字符串，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/login
    2. Body：`{ "email": "", "password": "Password123" }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **密码为空字符串，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/login
    2. Body：`{ "email": "test@example.com", "password": "" }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **缺少 email 字段，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/login
    2. Body：`{ "password": "Password123" }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **缺少 password 字段，返回 400**
  - 操作步骤：
    1. 发送 POST /api/auth/login
    2. Body：`{ "email": "test@example.com" }`
  - 预期结果：
    - 接口返回 400
    - 响应体：`{ data: null, error: "VALIDATION_ERROR", message: "请求参数不合法" }`

- **未携带 Cookie，访问受保护端点，返回 401**
  - 操作步骤：
    1. 不携带 Session Cookie
    2. 发送 GET /api/auth/me
  - 预期结果：
    - 接口返回 401
    - 响应体：`{ data: null, error: "Unauthorized", message: "请先登录" }`

- **Session 过期后访问受保护端点，返回 401**
  - 操作步骤：
    1. 用户登录后获得 Session Cookie
    2. 等待 Session 过期（7 天后，或手动修改数据库中 sessions 表的 expires 字段为过去时间）
    3. 携带过期的 Cookie 访问 GET /api/auth/me
  - 预期结果：
    - 接口返回 401
    - 响应体：`{ data: null, error: "Unauthorized", message: "请先登录" }`

---

## API 端点：POST /api/auth/logout（用户登出）

### 正常场景

- **已登录用户登出成功**
  - 操作步骤：
    1. 用户已登录（携带有效 Session Cookie）
    2. 发送 POST /api/auth/logout
  - 预期结果：
    - 接口返回 204
    - 无响应 Body
    - 响应头 Set-Cookie 清除 Session Cookie（maxAge=0 或 expires=过去时间）
    - 数据库中对应 Session 记录被删除

### 异常场景

- **未登录时调用登出接口，返回 401**
  - 操作步骤：
    1. 不携带 Session Cookie
    2. 发送 POST /api/auth/logout
  - 预期结果：
    - 接口返回 401
    - 响应体：`{ data: null, error: "Unauthorized", message: "请先登录" }`

---

## API 端点：GET /api/auth/me（获取当前用户信息）

### 正常场景

- **已登录用户获取当前用户信息成功**
  - 操作步骤：
    1. 用户已登录（携带有效 Session Cookie）
    2. 发送 GET /api/auth/me
  - 预期结果：
    - 接口返回 200
    - 响应体：`{ data: { id, email, nickname, createdAt, lastLoginAt }, message: "ok" }`
    - 响应体中不包含 passwordHash 字段

### 异常场景

- **未登录时访问，返回 401**
  - 操作步骤：
    1. 不携带 Session Cookie
    2. 发送 GET /api/auth/me
  - 预期结果：
    - 接口返回 401
    - 响应体：`{ data: null, error: "Unauthorized", message: "请先登录" }`

---

## 前端功能：登录页面（/login）

### 正常场景

- **输入有效邮箱和密码，点击登录，跳转到笔记列表页**
  - 操作步骤：
    1. 访问 /login 页面
    2. 在邮箱输入框输入 "test@example.com"
    3. 在密码输入框输入 "Password123"
    4. 点击"登录"按钮
  - 预期结果：
    - 发起 POST /api/auth/login 请求
    - 接口返回 200
    - AuthContext 更新为已登录状态（isAuthenticated: true, user: {...}）
    - 页面自动跳转到 /memo（笔记列表页）

- **点击"立即注册"链接，跳转到注册页**
  - 操作步骤：
    1. 访问 /login 页面
    2. 点击"立即注册"链接
  - 预期结果：
    - 页面跳转到 /register（注册页）

### 异常场景

- **邮箱格式错误，提交前前端拦截并提示**
  - 操作步骤：
    1. 访问 /login 页面
    2. 在邮箱输入框输入 "invalidemail"
    3. 在密码输入框输入 "Password123"
    4. 点击"登录"按钮
  - 预期结果：
    - 页面显示错误提示："请输入有效邮箱地址"
    - 不发起 API 请求

- **密码为空，提交前前端拦截并提示**
  - 操作步骤：
    1. 访问 /login 页面
    2. 在邮箱输入框输入 "test@example.com"
    3. 密码输入框留空
    4. 点击"登录"按钮
  - 预期结果：
    - 页面显示错误提示："请填写邮箱和密码"
    - 不发起 API 请求

- **后端返回邮箱或密码错误，显示错误提示**
  - 操作步骤：
    1. 访问 /login 页面
    2. 输入错误的邮箱或密码
    3. 点击"登录"按钮
  - 预期结果：
    - 发起 POST /api/auth/login 请求
    - 接口返回 401
    - 页面显示错误提示："邮箱或密码错误"
    - 页面不跳转，用户停留在登录页

---

## 前端功能：注册页面（/register）

### 正常场景

- **输入有效数据并勾选协议，注册成功并自动登录跳转**
  - 操作步骤：
    1. 访问 /register 页面
    2. 在邮箱输入框输入 "newuser@example.com"
    3. 在昵称输入框输入 "小明"
    4. 在密码输入框输入 "Password123"
    5. 勾选隐私协议
    6. 点击"注册"按钮
  - 预期结果：
    - 发起 POST /api/auth/register 请求
    - 接口返回 201
    - AuthContext 更新为已登录状态（isAuthenticated: true, user: {...}）
    - 页面自动跳转到 /memo（笔记列表页）

- **点击"返回登录"链接，跳转到登录页**
  - 操作步骤：
    1. 访问 /register 页面
    2. 点击"返回登录"链接
  - 预期结果：
    - 页面跳转到 /login（登录页）

### 异常场景

- **未勾选隐私协议，点击注册时前端拦截并提示**
  - 操作步骤：
    1. 访问 /register 页面
    2. 填写所有必填字段（邮箱、昵称、密码）
    3. 不勾选隐私协议
    4. 点击"注册"按钮
  - 预期结果：
    - 页面显示错误提示："请先同意隐私协议"
    - 不发起 API 请求

- **邮箱格式错误，提交前前端拦截并提示**
  - 操作步骤：
    1. 访问 /register 页面
    2. 在邮箱输入框输入 "invalidemail"
    3. 填写其他字段并勾选协议
    4. 点击"注册"按钮
  - 预期结果：
    - 页面显示错误提示："请输入有效邮箱地址"
    - 不发起 API 请求

- **密码少于 8 位，提交前前端拦截并提示**
  - 操作步骤：
    1. 访问 /register 页面
    2. 在密码输入框输入 "Pass123"（7 位）
    3. 填写其他字段并勾选协议
    4. 点击"注册"按钮
  - 预期结果：
    - 页面显示错误提示："密码需为 8-20 位，包含字母和数字"
    - 不发起 API 请求

- **密码不包含数字，提交前前端拦截并提示**
  - 操作步骤：
    1. 访问 /register 页面
    2. 在密码输入框输入 "PasswordOnly"（无数字）
    3. 填写其他字段并勾选协议
    4. 点击"注册"按钮
  - 预期结果：
    - 页面显示错误提示："密码需为 8-20 位，包含字母和数字"
    - 不发起 API 请求

- **后端返回邮箱已注册，显示错误提示**
  - 操作步骤：
    1. 访问 /register 页面
    2. 输入已注册的邮箱（如 "existing@example.com"）
    3. 填写其他字段并勾选协议
    4. 点击"注册"按钮
  - 预期结果：
    - 发起 POST /api/auth/register 请求
    - 接口返回 409
    - 页面显示错误提示："该邮箱已注册,请直接登录"
    - 页面不跳转，用户停留在注册页

---

## 全局功能：自动登录检测

### 正常场景

- **Session 未过期时，应用启动自动识别登录状态并跳过登录页**
  - 操作步骤：
    1. 用户已登录（Session Cookie 仍在有效期内）
    2. 关闭并重新打开应用
    3. 应用启动时调用 GET /api/auth/me
  - 预期结果：
    - 接口返回 200
    - AuthContext 更新为已登录状态（isAuthenticated: true, user: {...}）
    - 页面直接进入 /memo（笔记列表页），不显示登录页

### 异常场景

- **Session 过期或不存在时，应用启动跳转到登录页**
  - 操作步骤：
    1. 用户未登录或 Session 已过期
    2. 打开应用
    3. 应用启动时调用 GET /api/auth/me
  - 预期结果：
    - 接口返回 401
    - AuthContext 更新为未登录状态（isAuthenticated: false）
    - 页面自动跳转到 /login（登录页）

---

## 安全场景

### 密码存储

- **密码以 bcrypt 哈希存储，不明文保存**
  - 操作步骤：
    1. 注册一个新账号（密码："Password123"）
    2. 直接查询数据库中 users 表的 password_hash 字段
  - 预期结果：
    - password_hash 字段是以 `$2b$10$` 开头的哈希字符串
    - password_hash 字段不等于 "Password123"

### Session 安全

- **Session Cookie 设置 httpOnly 防止 XSS 读取**
  - 操作步骤：
    1. 用户登录成功
    2. 检查响应头 Set-Cookie
  - 预期结果：
    - Set-Cookie 包含 `HttpOnly` 标志

- **Session Cookie 设置 sameSite=strict 防止 CSRF**
  - 操作步骤：
    1. 用户登录成功
    2. 检查响应头 Set-Cookie
  - 预期结果：
    - Set-Cookie 包含 `SameSite=Strict` 标志

- **生产环境下 Session Cookie 设置 secure 标志**
  - 操作步骤：
    1. 在生产环境（HTTPS）下用户登录成功
    2. 检查响应头 Set-Cookie
  - 预期结果：
    - Set-Cookie 包含 `Secure` 标志

### SQL 注入防护

- **邮箱字段包含 SQL 注入语句，系统正确处理**
  - 操作步骤：
    1. 发送 POST /api/auth/login
    2. Body：`{ "email": "'; DROP TABLE users; --", "password": "Password123" }`
  - 预期结果：
    - 接口返回 401（邮箱不存在）
    - 数据库中 users 表未被删除或修改
    - 系统日志无 SQL 错误

### XSS 防护

- **昵称包含 HTML 标签，前端纯文本渲染不解析**
  - 操作步骤：
    1. 注册账号，昵称为 `<script>alert('XSS')</script>`
    2. 登录后在前端页面查看昵称显示
  - 预期结果：
    - 页面显示纯文本 `<script>alert('XSS')</script>`
    - 浏览器不执行 JavaScript 代码

---

**文档结束**
