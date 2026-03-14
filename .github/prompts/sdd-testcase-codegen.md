/e2e 读取测试用例文档（`${TESTCASE_FILE}`）和技术方案文档（`${DESIGN_FILE}`），将每条测试用例转换为可执行的 Playwright 测试代码（UI 测试用 page fixture，API 测试用 request fixture），每个功能模块生成一个 .spec.js 文件，使用 Write 工具写入 `${TEST_DIR}/` 目录。**只生成测试文件，不要执行测试。**

---

## 代码生成规范（必须全部遵守）

### 一、代码复用规范

1. 所有重复出现的业务逻辑（如：用户注册、数据初始化、接口调用）必须封装为可复用的工具函数或常量，禁止在多处重复写相同代码；
2. 工具函数需命名清晰（如：`registerUser` / `loginAndGetCookie` / `createMemo`），参数可配置，能覆盖所有使用场景；
3. 业务代码中统一调用工具函数，不允许直接写重复的底层逻辑（如：直接写 `request.post` 注册用户）；
4. 测试数据（密码、昵称、超时时长等）统一在文件顶部以常量声明，禁止硬编码分散在各测试中；
5. 保持代码结构清晰，注释说明工具函数的用途和参数；只保留必要的业务逻辑，无冗余代码。

### 二、测试隔离规范（最重要）

6. **需要"未登录状态"的 API 测试，禁止用变量重命名模拟隔离**（如 `const freshRequest = request` 是错误写法）；必须使用 `const freshContext = await request.newContext()` 创建全新 context，测试结束后调用 `await freshContext.dispose()`；
7. 每个测试用例必须独立，不得依赖其他测试执行后的状态（如 Cookie、数据库数据）；需要登录态的测试，在该测试自身的 `beforeEach` 或测试体内完成登录，不依赖前序测试遗留的登录状态。

### 三、测试结构规范

8. UI 测试（使用 `page` fixture）放在 `describe('UI 测试')` 块内；API 测试（使用 `request` fixture）放在 `describe('API 测试')` 块内；禁止将 API 测试放进 UI 的 `describe` 块，反之亦然；
9. `describe` 块按功能模块组织，嵌套层级不超过两层：外层为模块名，内层为"正常场景"/"异常场景"。

### 四、断言规范

10. 每次 API 请求后必须先断言状态码，再读取响应体：
    ```js
    const response = await request.post('/api/xxx', { ... });
    expect(response.status()).toBe(200); // 先断言状态码
    const body = await response.json();  // 再处理响应体
    ```
    禁止在未断言状态码的情况下直接调用 `response.json()`；
11. 每个测试至少包含一个明确的业务断言（不仅仅是状态码），验证响应体中的关键字段值。

### 五、UI 元素等待规范

12. 点击、填写操作前，对动态渲染或异步加载的元素，必须先等待其可交互：
    ```js
    await expect(page.getByRole('button', { name: '登出' })).toBeEnabled();
    await page.getByRole('button', { name: '登出' }).click();
    ```
    禁止使用固定时间等待（`page.waitForTimeout`）替代条件等待。
