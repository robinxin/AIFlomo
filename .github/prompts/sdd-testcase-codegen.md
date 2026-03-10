<!--
  ===================================================
  sdd-testcase-codegen.md — 测试可执行脚本生成 Prompt
  ===================================================

  用途: 将 sdd-testcase.md 生成的中文测试用例文档，逐条转换为
        Playwright JavaScript 格式的可执行 E2E + API 测试脚本
  调用方: SDD 测试流水线 → job: testcase-code（在 testcase-gate 审批后运行）

  输出: Playwright 测试脚本（.spec.js），每个功能模块一个文件
        测试脚本通过 `npx playwright test` 运行

  运行环境说明:
    - APP_URL 为被测应用的访问地址，在 .env 中配置，通过 process.env.APP_URL 读取
    - 测试运行前，应用必须处于运行状态
    - 需安装 @playwright/test（项目已依赖）
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

## PROJECT GUIDE (CLAUDE.md — tech stack, directory structure, naming rules, scripts)

${CLAUDE_MD}

---

你是一位熟悉 Playwright 自动化测试框架的测试工程师。项目技术栈、目录结构、命名规范、API 响应格式等完整信息已在上方 **PROJECT CONSTITUTION** 和 **PROJECT GUIDE (CLAUDE.md)** 中注入，请以那些内容为唯一权威。

你的任务是：读取中文测试用例文档，将其中的 **UI 测试用例** 转换为 Playwright 浏览器测试，将 **API 测试用例** 转换为 Playwright `request` fixture 接口测试，生成 `.spec.js` 文件。

---

## 第一步 — 读取输入

1. 使用 Read 工具读取测试用例文档：`${TESTCASE_FILE}`
2. 使用 Read 工具逐一读取 Spec 文件（路径列表：`${SPEC_FILES}`，多个路径按空格分隔，需分别读取）
3. 使用 Read 工具读取技术方案文档：`${DESIGN_FILE}`（理解 API 路径、字段结构、Cookie 认证方式）
4. 列出 `docs/standards/` 下所有 `.md` 文件（`Bash: ls docs/standards/`），并逐一读取，理解前后端编码规范
5. 使用 `Bash: mkdir -p ${TEST_DIR}` 确保输出目录存在

---

## 第二步 — 理解测试用例文档结构

测试用例文档按**功能模块**分组，每个模块下有两类用例：

- **UI 测试场景**：用户在浏览器界面上的操作与验证 → 转换为 Playwright 浏览器测试
- **API 测试场景**：直接调用 HTTP 接口并验证响应 → 转换为 Playwright request 接口测试

每个功能模块生成一个 `.spec.js` 文件，文件内包含两个 `test.describe` 块（UI + API）。

---

## 第三步 — 生成 Playwright 测试文件

### 文件命名规则

```
${TEST_DIR}/{功能模块名（kebab-case）}.spec.js
```

示例：
- 创建备忘录模块 → `${TEST_DIR}/memo-create.spec.js`
- 标签管理模块   → `${TEST_DIR}/tag-management.spec.js`

---

### 文件整体结构模板

```javascript
const { test, expect, request: requestLib } = require('@playwright/test');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

// ─── 通用登录函数（需要登录的模块复用此函数）──────────────────────────────
async function loginViaUI(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('邮箱').fill('test@example.com');  // 自行生成测试账号
  await page.getByPlaceholder('密码').fill('test-password-123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(`${BASE_URL}/**`, { timeout: 5000 });
}

// ─── UI 测试 ─────────────────────────────────────────────────────────────────
test.describe('{功能模块名} — UI 测试', () => {

  // 如果该模块的用例需要登录，加 beforeEach
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  // ── 正常场景 ──
  test('{用例标题原文}', async ({ page }) => {
    // 操作步骤
    await page.goto(`${BASE_URL}/`);
    await page.getByPlaceholder('写点什么...').fill('今天学习新知识');
    await page.getByRole('button', { name: '发送' }).click();
    // 预期结果
    await expect(page.locator('.memo-list').first()).toContainText('今天学习新知识');
  });

  // ── 异常场景 ──
  test('{用例标题原文}', async ({ page }) => {
    // 清除 session，模拟未登录
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/`);
    // 预期结果：跳转登录页
    await expect(page).toHaveURL(/\/login/);
  });

});

// ─── API 测试 ─────────────────────────────────────────────────────────────────
test.describe('{功能模块名} — API 测试', () => {

  let authContext;   // 已登录的 request context（携带 Session Cookie）

  // 通过 UI 登录后获取 Cookie，供接口测试使用
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page);
    const storageState = await context.storageState();
    await context.close();

    authContext = await requestLib.newContext({
      baseURL: BASE_URL,
      storageState,
    });
  });

  test.afterAll(async () => {
    await authContext.dispose();
  });

  // ── 正常场景 ──
  test('{用例标题原文}', async () => {
    const response = await authContext.post('/api/memos', {
      data: { content: '今天学习新知识' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ content: '今天学习新知识' });
    expect(body.data.id).toBeDefined();
    expect(body.message).toBe('创建成功');
  });

  // ── 异常场景（未登录）──
  test('{用例标题原文} — 未登录返回 401', async () => {
    const anonContext = await requestLib.newContext({ baseURL: BASE_URL });
    const response = await anonContext.post('/api/memos', {
      data: { content: '测试' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.data).toBeNull();
    await anonContext.dispose();
  });

});
```

---

### Playwright 操作/断言对照表

将测试用例的"操作步骤"和"预期结果"翻译为以下 API：

#### UI 测试 — 浏览器操作

| 场景 | 使用方式 | 示例 |
|------|---------|------|
| 页面导航 | `page.goto(url)` | `await page.goto(BASE_URL + '/login')` |
| 填写输入框（优先 placeholder） | `page.getByPlaceholder('...').fill(value)` | `await page.getByPlaceholder('写点什么').fill('内容')` |
| 填写输入框（有 label） | `page.getByLabel('...').fill(value)` | `await page.getByLabel('邮箱').fill('a@b.com')` |
| 点击按钮 | `page.getByRole('button', { name: '...' }).click()` | `await page.getByRole('button', { name: '发送' }).click()` |
| 点击任意元素 | `page.getByText('...').click()` | `await page.getByText('删除').click()` |
| 等待元素出现 | `expect(locator).toBeVisible()` | `await expect(page.getByText('创建成功')).toBeVisible()` |
| 等待页面跳转 | `page.waitForURL(pattern)` | `await page.waitForURL(/\/login/)` |
| 清除 Cookie（模拟未登录） | `page.context().clearCookies()` | `await page.context().clearCookies()` |
| 执行 JS | `page.evaluate(fn)` | `await page.evaluate(() => localStorage.clear())` |
| 固定等待 | `page.waitForTimeout(ms)` | `await page.waitForTimeout(1000)` |

#### UI 测试 — 断言

| 断言目标 | 使用方式 |
|---------|---------|
| 页面 URL 匹配 | `await expect(page).toHaveURL(/pattern/)` |
| 元素包含文字 | `await expect(page.locator('.class')).toContainText('文字')` |
| 元素可见 | `await expect(locator).toBeVisible()` |
| 元素不可见 | `await expect(locator).not.toBeVisible()` |
| 输入框值 | `await expect(page.getByPlaceholder('...')).toHaveValue('')` |
| 元素数量 | `await expect(page.locator('.item')).toHaveCount(3)` |

#### API 测试 — request fixture

| 场景 | 使用方式 |
|------|---------|
| 已登录 GET | `const res = await authContext.get('/api/memos')` |
| 已登录 POST | `const res = await authContext.post('/api/memos', { data: {...} })` |
| 已登录 PUT/PATCH | `const res = await authContext.put('/api/memos/1', { data: {...} })` |
| 已登录 DELETE | `const res = await authContext.delete('/api/memos/1')` |
| 未登录请求 | `const anonCtx = await requestLib.newContext({ baseURL }); const res = await anonCtx.post(...)` |
| 断言状态码 | `expect(res.status()).toBe(201)` |
| 断言响应体字段 | `const body = await res.json(); expect(body.data).toMatchObject({...})` |
| 断言字段存在 | `expect(body.data.id).toBeDefined()` |
| 断言字段为 null | `expect(body.data).toBeNull()` |

---

### 各类场景翻译模板

**UI — 正常创建场景：**
```javascript
test('输入有效内容点击发送，笔记出现在列表顶部', async ({ page }) => {
  await page.getByPlaceholder('写点什么...').fill('今天学习新知识');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.locator('.memo-list').first()).toContainText('今天学习新知识');
  await expect(page.getByPlaceholder('写点什么...')).toHaveValue('');
});
```

**UI — 未登录跳转场景：**
```javascript
test('未登录访问首页，跳转登录页', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/`);
  await expect(page).toHaveURL(/\/login/);
});
```

**UI — 输入校验场景：**
```javascript
test('输入框为空点击发送，显示错误提示', async ({ page }) => {
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByText('内容不能为空')).toBeVisible();
});
```

**API — 正常请求场景：**
```javascript
test('有效内容已登录，笔记创建成功返回 201', async () => {
  const response = await authContext.post('/api/memos', {
    data: { content: '今天学习新知识' },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data).toMatchObject({ content: '今天学习新知识' });
  expect(body.data.id).toBeDefined();
});
```

**API — 未登录场景：**
```javascript
test('未登录访问创建接口，返回 401', async () => {
  const anonContext = await requestLib.newContext({ baseURL: BASE_URL });
  const response = await anonContext.post('/api/memos', {
    data: { content: '测试' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.data).toBeNull();
  await anonContext.dispose();
});
```

**API — 必填字段缺失：**
```javascript
test('content 字段缺失，返回 400', async () => {
  const response = await authContext.post('/api/memos', {
    data: {},
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBeDefined();
});
```

**API — 超长内容：**
```javascript
test('content 超过 10000 字符，返回 400', async () => {
  const response = await authContext.post('/api/memos', {
    data: { content: 'a'.repeat(10001) },
  });
  expect(response.status()).toBe(400);
});
```

**API — 操作他人资源：**
```javascript
test('操作不属于自己的资源，返回 403 或 404', async () => {
  const response = await authContext.delete('/api/memos/other-user-memo-id');
  expect([403, 404]).toContain(response.status());
});
```

---

## 第四步 — 输出所有文件

写完所有 `.spec.js` 文件后，每个文件输出一行标记：

```
WRITTEN: ${TEST_DIR}/memo-create.spec.js
WRITTEN: ${TEST_DIR}/tag-management.spec.js
```

---

## 硬性规则

- **每条测试用例必须对应一个 `test()`**，不得遗漏
- **`test()` 的第一个参数必须包含用例标题原文**，便于报告溯源
- **UI 测试需要登录的模块，必须有 `test.beforeEach` 调用 `loginViaUI()`**
- **API 测试的 `beforeAll` 必须通过 UI 登录获取真实 Session Cookie**，不得硬编码 Cookie 字符串
- **未登录 API 场景必须单独创建 `anonContext`**，不复用 `authContext`
- **每个 `anonContext` 用完必须 `dispose()`**，避免 context 泄漏
- **Locator 优先级**：`getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > CSS selector（后者作为最后手段）
- **不得凭空发明用例**，只翻译 `${TESTCASE_FILE}` 中已有的用例
- 如果某条用例的操作步骤模糊，在对应 `test()` 开头加注释：`// 注：原用例步骤不明确，已按以下方式解读：...`
- 使用 Write 工具将每个文件写入 `${TEST_DIR}/`
