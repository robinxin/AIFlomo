# 测试用例文档：账号注册与登录

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**生成日期**: 2026-03-13
**用例总数**: 62 条（UI: 32 条 / API: 30 条）

---

## 用户注册功能

### UI 测试场景

#### 正常场景

- 输入有效邮箱、昵称、密码并勾选隐私协议，注册成功并跳转到首页
  - 前置条件：用户未登录，访问 `/register` 页面
  - 操作步骤：
    1. 在"邮箱"输入框中输入 `user@example.com`
    2. 在"昵称"输入框中输入 `小明`
    3. 在"密码"输入框中输入 `password123`（8 字符）
    4. 勾选"我已阅读并同意隐私协议"勾选框
    5. 点击"注册"按钮
  - 预期结果：
    - 按钮文字变为"注册中..."且禁用
    - 所有输入框变为不可编辑状态
    - 接口返回成功后，页面自动跳转到 Memo 列表页 `/`
    - 显示成功提示（Toast："注册成功"或等效）

- 密码输入框点击眼睛图标可切换明文/密文显示
  - 前置条件：用户停留在注册页面
  - 操作步骤：
    1. 在"密码"输入框中输入 `password123`
    2. 点击密码输入框右侧眼睛图标
    3. 再次点击眼睛图标
  - 预期结果：
    - 第一次点击后，密码以明文显示（可看到 `password123`）
    - 第二次点击后，密码恢复密文显示（显示为圆点或星号）

- 注册页面点击"返回登录"链接跳转到登录页
  - 前置条件：用户停留在注册页面，已输入部分内容
  - 操作步骤：
    1. 在注册表单中输入任意内容（邮箱、昵称、密码）
    2. 点击页面下方"返回登录"链接
  - 预期结果：
    - 页面跳转到 `/login` 登录页面
    - 注册页面已输入的内容全部清空（不保留）

- 昵称输入 20 字符后无法继续输入
  - 前置条件：用户停留在注册页面
  - 操作步骤：
    1. 在"昵称"输入框中输入 20 个字符（如 `12345678901234567890`）
    2. 尝试继续输入第 21 个字符
  - 预期结果：
    - 第 21 个字符无法输入（输入框达到 `maxLength` 限制）
    - 昵称输入框下方实时显示"昵称最多 20 个字符"提示

#### 异常场景

- 输入框为空时点击注册，前端给出提示
  - 前置条件：用户停留在注册页面，所有输入框为空
  - 操作步骤：
    1. 不输入任何内容
    2. 点击"注册"按钮
  - 预期结果：
    - 发送请求未发出（前端拦截）
    - 邮箱输入框下方显示错误提示："请输入有效的邮箱地址"
    - 昵称输入框下方显示错误提示："昵称长度为 2-20 字符"
    - 密码输入框下方显示错误提示："密码长度为 8-20 字符"
    - 隐私协议勾选框高亮并显示"请阅读并同意隐私协议"

- 邮箱格式不正确时失焦，显示格式错误提示
  - 前置条件：用户停留在注册页面
  - 操作步骤：
    1. 在"邮箱"输入框中输入 `test@`（不完整邮箱）
    2. 点击其他区域（失焦）
  - 预期结果：
    - 邮箱输入框下方立即显示红色提示："请输入有效的邮箱地址"
    - 邮箱输入框边框变为红色

- 邮箱格式正确后失焦，错误提示消失
  - 前置条件：用户停留在注册页面，邮箱输入框显示格式错误提示
  - 操作步骤：
    1. 在"邮箱"输入框中修正为 `test@example.com`
    2. 点击其他区域（失焦）
  - 预期结果：
    - 邮箱输入框下方的错误提示消失
    - 邮箱输入框边框恢复默认颜色

- 昵称少于 2 字符时失焦，显示长度错误提示
  - 前置条件：用户停留在注册页面
  - 操作步骤：
    1. 在"昵称"输入框中输入 `a`（1 字符）
    2. 点击其他区域（失焦）
  - 预期结果：
    - 昵称输入框下方立即显示红色提示："昵称长度为 2-20 字符"
    - 昵称输入框边框变为红色

- 昵称输入纯空格时失焦，显示错误提示
  - 前置条件：用户停留在注册页面
  - 操作步骤：
    1. 在"昵称"输入框中输入多个空格（如 `   `）
    2. 点击其他区域（失焦）
  - 预期结果：
    - 昵称输入框下方立即显示红色提示："昵称不能为空"（或等效提示）
    - 昵称输入框边框变为红色

- 密码少于 8 字符时失焦，显示长度错误提示
  - 前置条件：用户停留在注册页面
  - 操作步骤：
    1. 在"密码"输入框中输入 `abc123`（6 字符）
    2. 点击其他区域（失焦）
  - 预期结果：
    - 密码输入框下方立即显示红色提示："密码长度至少为 8 个字符"
    - 密码输入框边框变为红色

- 未勾选隐私协议点击注册，高亮提示勾选框
  - 前置条件：用户停留在注册页面，已填写邮箱、昵称、密码
  - 操作步骤：
    1. 在"邮箱"输入框中输入 `user@example.com`
    2. 在"昵称"输入框中输入 `小明`
    3. 在"密码"输入框中输入 `password123`
    4. 不勾选隐私协议
    5. 点击"注册"按钮
  - 预期结果：
    - 发送请求未发出（前端拦截）
    - 隐私协议勾选框边框变为红色
    - 勾选框下方或旁边显示"请阅读并同意隐私协议"红色提示

- 邮箱已被注册时，表单顶部显示错误提示
  - 前置条件：数据库中已存在邮箱 `user@example.com` 的用户
  - 操作步骤：
    1. 在"邮箱"输入框中输入 `user@example.com`
    2. 在"昵称"输入框中输入 `小红`
    3. 在"密码"输入框中输入 `password456`
    4. 勾选隐私协议
    5. 点击"注册"按钮
  - 预期结果：
    - 接口返回 HTTP 409
    - 表单顶部显示红色错误提示框："该邮箱已被注册"
    - "注册"按钮恢复可点击状态
    - 所有输入框恢复可编辑状态
    - 已输入的表单内容保持不变（不清空）

- 网络异常时，表单顶部显示网络错误提示
  - 前置条件：用户停留在注册页面，网络连接中断或后端服务不可用
  - 操作步骤：
    1. 在注册表单中输入有效内容
    2. 勾选隐私协议
    3. 点击"注册"按钮
  - 预期结果：
    - 表单顶部显示红色错误提示框："网络连接失败，请稍后重试"
    - "注册"按钮恢复可点击状态
    - 所有输入框恢复可编辑状态
    - 已输入的表单内容保持不变

---

### API 测试场景

#### 正常场景

- 有效邮箱、昵称、密码和隐私协议同意，用户注册成功
  - 操作步骤：
    1. 用户未登录（不携带 Session Cookie）
    2. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "newuser@example.com",
         "nickname": "小明",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 201
    - 响应体：
      ```json
      {
        "data": {
          "id": "uuid-string",
          "email": "newuser@example.com",
          "nickname": "小明",
          "createdAt": 1741824000000
        },
        "message": "注册成功"
      }
      ```
    - 数据库 `users` 表中新增一条记录
    - 响应 Set-Cookie 头包含有效 Session Cookie

- 昵称包含前后空格时，后端 trim 后存储
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "trimtest@example.com",
         "nickname": "  小红  ",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 201
    - 响应体中 `data.nickname` 为 `"小红"`（前后空格已删除）
    - 数据库中 `nickname` 字段值为 `小红`

- 昵称为 2 字符（边界值），注册成功
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "min@example.com",
         "nickname": "ab",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 201
    - 响应体中 `data.nickname` 为 `"ab"`

- 昵称为 20 字符（边界值），注册成功
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "max@example.com",
         "nickname": "12345678901234567890",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 201
    - 响应体中 `data.nickname` 为 `"12345678901234567890"`

- 密码为 8 字符（边界值），注册成功
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "minpw@example.com",
         "nickname": "测试",
         "password": "abcd1234",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 201
    - 数据库中 `password_hash` 字段为 bcrypt 哈希值（非明文）

- 密码为 20 字符（边界值），注册成功
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "maxpw@example.com",
         "nickname": "测试",
         "password": "12345678901234567890",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 201
    - 数据库中 `password_hash` 字段为 bcrypt 哈希值

#### 异常场景

- 邮箱字段缺失，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "nickname": "小明",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：
      ```json
      {
        "data": null,
        "error": "请求参数格式错误",
        "message": "注册失败"
      }
      ```

- 昵称字段缺失，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请求参数格式错误", "message": "注册失败" }`

- 密码字段缺失，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "小明",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请求参数格式错误", "message": "注册失败" }`

- agreedToPrivacy 字段缺失，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "小明",
         "password": "password123"
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请求参数格式错误", "message": "注册失败" }`

- 邮箱格式不正确，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "invalid-email",
         "nickname": "小明",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请输入有效的邮箱地址", "message": "注册失败" }`

- 昵称少于 2 字符，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "a",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "昵称长度为 2-20 字符", "message": "注册失败" }`

- 昵称超过 20 字符，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "123456789012345678901",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "昵称长度为 2-20 字符", "message": "注册失败" }`

- 昵称为纯空格，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "   ",
         "password": "password123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "昵称长度为 2-20 字符", "message": "注册失败" }`（trim 后长度为 0）

- 密码少于 8 字符，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "小明",
         "password": "abc123",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "密码长度为 8-20 字符", "message": "注册失败" }`

- 密码超过 20 字符，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "小明",
         "password": "123456789012345678901",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "密码长度为 8-20 字符", "message": "注册失败" }`

- agreedToPrivacy 为 false，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "test@example.com",
         "nickname": "小明",
         "password": "password123",
         "agreedToPrivacy": false
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请阅读并同意隐私协议", "message": "注册失败" }`

- 邮箱已被注册，返回 409
  - 操作步骤：
    1. 数据库中已存在 `email = "existing@example.com"` 的用户
    2. 发送 POST /api/auth/register，Body：
       ```json
       {
         "email": "existing@example.com",
         "nickname": "小红",
         "password": "password456",
         "agreedToPrivacy": true
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 409
    - 响应体：`{ "data": null, "error": "该邮箱已被注册", "message": "注册失败" }`

- 并发注册同一邮箱，仅一个成功，其他返回 409
  - 操作步骤：
    1. 两个客户端同时发送 POST /api/auth/register，Body 中 `email` 均为 `concurrent@example.com`
  - 预期结果：
    - 其中一个请求返回 HTTP 201，注册成功
    - 另一个请求返回 HTTP 409，`error` 为 `"该邮箱已被注册"`
    - 数据库中仅存在一条 `email = "concurrent@example.com"` 的记录

- 数据库异常时，返回 500 且不暴露内部错误
  - 操作步骤：
    1. 模拟数据库不可用（停止数据库服务或断开连接）
    2. 发送 POST /api/auth/register，Body 包含有效参数
  - 预期结果：
    - 接口返回 HTTP 500
    - 响应体：`{ "data": null, "error": "服务器内部错误，请稍后重试", "message": "注册失败" }`
    - 响应体不包含数据库栈跟踪、SQL 语句等技术细节

---

## 用户登录功能

### UI 测试场景

#### 正常场景

- 输入正确的邮箱和密码，登录成功并跳转到首页
  - 前置条件：数据库中存在邮箱为 `user@example.com`、密码为 `password123` 的用户
  - 操作步骤：
    1. 访问 `/login` 登录页面
    2. 在"邮箱"输入框中输入 `user@example.com`
    3. 在"密码"输入框中输入 `password123`
    4. 点击"登录"按钮
  - 预期结果：
    - 按钮文字变为"登录中..."且禁用
    - 所有输入框变为不可编辑状态
    - 接口返回成功后，页面自动跳转到 Memo 列表页 `/`
    - 显示成功提示（Toast："登录成功"或等效）

- 登录页面点击"立即注册"链接跳转到注册页
  - 前置条件：用户停留在登录页面，已输入部分内容
  - 操作步骤：
    1. 在登录表单中输入任意内容（邮箱、密码）
    2. 点击页面下方"立即注册"链接
  - 预期结果：
    - 页面跳转到 `/register` 注册页面
    - 登录页面已输入的内容全部清空（不保留）

- 密码输入框点击眼睛图标可切换明文/密文显示
  - 前置条件：用户停留在登录页面
  - 操作步骤：
    1. 在"密码"输入框中输入 `password123`
    2. 点击密码输入框右侧眼睛图标
    3. 再次点击眼睛图标
  - 预期结果：
    - 第一次点击后，密码以明文显示（可看到 `password123`）
    - 第二次点击后，密码恢复密文显示（显示为圆点或星号）

#### 异常场景

- 输入错误的邮箱或密码，表单顶部显示错误提示
  - 前置条件：数据库中存在邮箱为 `user@example.com` 的用户，密码为 `password123`
  - 操作步骤：
    1. 在"邮箱"输入框中输入 `user@example.com`
    2. 在"密码"输入框中输入 `wrongpassword`
    3. 点击"登录"按钮
  - 预期结果：
    - 接口返回 HTTP 401
    - 表单顶部显示红色错误提示框："邮箱或密码错误，请重试"
    - "登录"按钮恢复可点击状态
    - 所有输入框恢复可编辑状态
    - 密码输入框自动清空（`value` 为空字符串）
    - 邮箱输入框保持原内容

- 输入不存在的邮箱，表单顶部显示统一错误提示
  - 前置条件：数据库中不存在邮箱为 `nonexistent@example.com` 的用户
  - 操作步骤：
    1. 在"邮箱"输入框中输入 `nonexistent@example.com`
    2. 在"密码"输入框中输入 `password123`
    3. 点击"登录"按钮
  - 预期结果：
    - 接口返回 HTTP 401
    - 表单顶部显示红色错误提示框："邮箱或密码错误，请重试"（不泄露"用户不存在"）
    - 密码输入框自动清空
    - 邮箱输入框保持原内容

- 网络异常时，表单顶部显示网络错误提示
  - 前置条件：用户停留在登录页面，网络连接中断或后端服务不可用
  - 操作步骤：
    1. 在登录表单中输入有效邮箱和密码
    2. 点击"登录"按钮
  - 预期结果：
    - 表单顶部显示红色错误提示框："网络连接失败，请稍后重试"
    - "登录"按钮恢复可点击状态
    - 所有输入框恢复可编辑状态
    - 已输入的表单内容保持不变

---

### API 测试场景

#### 正常场景

- 有效邮箱和密码，用户登录成功
  - 操作步骤：
    1. 数据库中存在邮箱为 `user@example.com`、密码哈希对应明文 `password123` 的用户
    2. 用户未登录（不携带 Session Cookie）
    3. 发送 POST /api/auth/login，Body：
       ```json
       {
         "email": "user@example.com",
         "password": "password123"
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 200
    - 响应体：
      ```json
      {
        "data": {
          "id": "uuid-string",
          "email": "user@example.com",
          "nickname": "小明",
          "createdAt": 1741824000000
        },
        "message": "登录成功"
      }
      ```
    - 响应 Set-Cookie 头包含有效 Session Cookie
    - 数据库用户记录的 `updated_at` 字段更新为当前时间戳（可选）

#### 异常场景

- 邮箱字段缺失，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/login，Body：
       ```json
       {
         "password": "password123"
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请求参数格式错误", "message": "登录失败" }`

- 密码字段缺失，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/login，Body：
       ```json
       {
         "email": "user@example.com"
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请求参数格式错误", "message": "登录失败" }`

- 邮箱不存在，返回 401 且不泄露具体原因
  - 操作步骤：
    1. 数据库中不存在邮箱为 `nonexistent@example.com` 的用户
    2. 发送 POST /api/auth/login，Body：
       ```json
       {
         "email": "nonexistent@example.com",
         "password": "password123"
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "邮箱或密码错误,请重试", "message": "登录失败" }`（统一提示，不区分"用户不存在"和"密码错误"）

- 密码错误，返回 401 且不泄露具体原因
  - 操作步骤：
    1. 数据库中存在邮箱为 `user@example.com` 的用户，密码哈希对应明文 `password123`
    2. 发送 POST /api/auth/login，Body：
       ```json
       {
         "email": "user@example.com",
         "password": "wrongpassword"
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "邮箱或密码错误，请重试", "message": "登录失败" }`

- 数据库异常时，返回 500 且不暴露内部错误
  - 操作步骤：
    1. 模拟数据库不可用（停止数据库服务或断开连接）
    2. 发送 POST /api/auth/login，Body 包含有效参数
  - 预期结果：
    - 接口返回 HTTP 500
    - 响应体：`{ "data": null, "error": "服务器内部错误，请稍后重试", "message": "登录失败" }`
    - 响应体不包含数据库栈跟踪、SQL 语句等技术细节

---

## 用户登出功能

### UI 测试场景

#### 正常场景

- 已登录用户在个人中心点击登出，Session 销毁并跳转登录页
  - 前置条件：用户已登录，停留在个人中心页面（未来实现）
  - 操作步骤：
    1. 点击"登出"按钮
  - 预期结果：
    - 接口返回成功后，页面跳转到 `/login` 登录页面
    - Session Cookie 被清除（浏览器开发者工具中 Cookie 消失）
    - 显示成功提示（Toast："已成功登出"或等效）

#### 异常场景

- 未登录用户访问登出接口，返回 401（前端通常不会触发此场景）
  - 前置条件：用户未登录（无有效 Session）
  - 操作步骤：
    1. 前端手动调用 POST /api/auth/logout（绕过 UI）
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "请先登录", "message": "登出失败" }`

---

### API 测试场景

#### 正常场景

- 已登录用户调用登出接口，Session 销毁成功
  - 操作步骤：
    1. 用户已登录（携带有效 Session Cookie）
    2. 发送 POST /api/auth/logout（无 Body）
  - 预期结果：
    - 接口返回 HTTP 200
    - 响应体：`{ "data": null, "message": "已成功登出" }`
    - 数据库中对应 Session 记录被删除
    - 响应 Set-Cookie 头清除 Session Cookie（如 `Max-Age=0` 或 `Expires` 过期时间）

#### 异常场景

- 未登录状态调用登出接口，返回 401
  - 操作步骤：
    1. 不携带 Session Cookie
    2. 发送 POST /api/auth/logout
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "请先登录", "message": "登出失败" }`

- Session 已过期调用登出接口，返回 401
  - 操作步骤：
    1. 携带已过期的 Session Cookie（创建时间超过 7 天）
    2. 发送 POST /api/auth/logout
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "请先登录", "message": "登出失败" }`

---

## 获取当前登录用户信息功能

### UI 测试场景

#### 正常场景

- App 启动时，已登录用户自动恢复登录状态
  - 前置条件：用户之前已登录，浏览器 Cookie 中存在有效 Session
  - 操作步骤：
    1. 关闭并重新打开 App（或刷新浏览器页面）
  - 预期结果：
    - App 启动时显示加载占位（`AuthContext.loading=true`）
    - 调用 GET /api/auth/me 成功后，`loading` 变为 `false`
    - 用户直接进入 Memo 列表页 `/`，无需重新登录
    - 不显示登录页或注册页

- App 启动时，未登录用户跳转到登录页
  - 前置条件：用户未登录（无 Session Cookie 或 Session 已过期）
  - 操作步骤：
    1. 打开 App
  - 预期结果：
    - App 启动时显示加载占位（`AuthContext.loading=true`）
    - 调用 GET /api/auth/me 失败（HTTP 401）后，`loading` 变为 `false`
    - 页面自动跳转到 `/login` 登录页面

#### 异常场景

- Session 过期后访问业务功能，自动跳转登录页
  - 前置条件：用户已登录超过 7 天，Session 已过期
  - 操作步骤：
    1. 用户在 Memo 列表页进行任意操作（如创建笔记）
  - 预期结果：
    - 接口返回 HTTP 401
    - 前端捕获 401 状态码，清除本地认证状态
    - 页面自动跳转到 `/login` 登录页面
    - 显示提示（Toast："登录已过期，请重新登录"或等效）

---

### API 测试场景

#### 正常场景

- 已登录用户调用接口，返回用户信息
  - 操作步骤：
    1. 用户已登录（携带有效 Session Cookie）
    2. 发送 GET /api/auth/me（无 Body）
  - 预期结果：
    - 接口返回 HTTP 200
    - 响应体：
      ```json
      {
        "data": {
          "id": "uuid-string",
          "email": "user@example.com",
          "nickname": "小明",
          "createdAt": 1741824000000
        },
        "message": "获取用户信息成功"
      }
      ```
    - 响应体不包含 `passwordHash` 字段

#### 异常场景

- 未登录状态调用接口，返回 401
  - 操作步骤：
    1. 不携带 Session Cookie
    2. 发送 GET /api/auth/me
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "请先登录", "message": "获取用户信息失败" }`

- Session 已过期调用接口，返回 401
  - 操作步骤：
    1. 携带已过期的 Session Cookie（创建时间超过 7 天）
    2. 发送 GET /api/auth/me
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "请先登录", "message": "获取用户信息失败" }`

- Session 中的用户在数据库中已被删除，返回 401
  - 操作步骤：
    1. 用户已登录（携带有效 Session Cookie，Session 中存储 `userId = "deleted-user-id"`）
    2. 数据库中不存在 `id = "deleted-user-id"` 的用户记录（异常情况）
    3. 发送 GET /api/auth/me
  - 预期结果：
    - 接口返回 HTTP 401
    - 响应体：`{ "data": null, "error": "用户不存在，请重新登录", "message": "获取用户信息失败" }`
    - Session 被销毁（服务端调用 `session.destroy()`）

- 数据库异常时，返回 500 且不暴露内部错误
  - 操作步骤：
    1. 用户已登录（携带有效 Session Cookie）
    2. 模拟数据库不可用（停止数据库服务或断开连接）
    3. 发送 GET /api/auth/me
  - 预期结果：
    - 接口返回 HTTP 500
    - 响应体：`{ "data": null, "error": "服务器内部错误，请稍后重试", "message": "获取用户信息失败" }`
    - 响应体不包含数据库栈跟踪、SQL 语句等技术细节

---

## 全局认证状态管理

### UI 测试场景

#### 正常场景

- 未登录用户访问需要认证的页面（如首页），自动跳转登录页
  - 前置条件：用户未登录（无有效 Session）
  - 操作步骤：
    1. 直接访问 `/` Memo 列表页 URL
  - 预期结果：
    - `AuthContext` 初始化时调用 GET /api/auth/me，返回 HTTP 401
    - `isAuthenticated` 变为 `false`
    - 页面自动跳转到 `/login` 登录页面

- 已登录用户访问登录页或注册页，自动跳转首页
  - 前置条件：用户已登录（`AuthContext.isAuthenticated=true`）
  - 操作步骤：
    1. 用户手动访问 `/login` 或 `/register` URL
  - 预期结果：
    - 页面自动跳转到 `/` Memo 列表页
    - 不显示登录或注册表单

---

## 边界场景与特殊情况

### API 测试场景

#### 正常场景

- 注册成功后自动登录，无需二次输入密码
  - 操作步骤：
    1. 发送 POST /api/auth/register，Body 包含有效参数
    2. 接口返回 HTTP 201 且包含 Session Cookie
    3. 立即发送 GET /api/auth/me（使用注册接口返回的 Cookie）
  - 预期结果：
    - GET /api/auth/me 返回 HTTP 200
    - 响应体中 `data` 包含刚注册的用户信息
    - 无需再次调用 POST /api/auth/login

#### 异常场景

- GET /api/auth/me 请求超时或网络中断，前端降级为未登录状态
  - 操作步骤：
    1. App 启动时调用 GET /api/auth/me
    2. 模拟网络超时（5 秒未响应）
  - 预期结果：
    - 前端在 5 秒后超时降级
    - `AuthContext` 设置 `isAuthenticated=false`, `loading=false`
    - 页面跳转到 `/login` 登录页面

- 密码长度为 0 字符时提交登录，返回 400
  - 操作步骤：
    1. 发送 POST /api/auth/login，Body：
       ```json
       {
         "email": "user@example.com",
         "password": ""
       }
       ```
  - 预期结果：
    - 接口返回 HTTP 400
    - 响应体：`{ "data": null, "error": "请求参数格式错误", "message": "登录失败" }`（后端 JSON Schema `minLength: 1` 校验失败）
