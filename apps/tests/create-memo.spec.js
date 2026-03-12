// 测试用例：创建纯文本笔记
// 对应文档：specs/active/45-create-memo-and-memo-list-1-testcases.md

import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建纯文本笔记 - UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 前置条件：用户已登录，停留在主界面首页（"全部笔记"分类）
    await page.goto('/');
    // 假设已有登录 Session，如需登录请在此添加登录逻辑
  });

  test('输入有效内容并点击发送，笔记出现在列表顶部', async ({ page }) => {
    // 1. 点击页面底部输入框，键盘弹起
    const input = page.locator('[data-testid="memo-input"]');
    await input.click();

    // 2. 输入内容"今天学到的新概念"
    await input.fill('今天学到的新概念');

    // 3. 点击"发布"按钮
    const publishBtn = page.locator('[data-testid="publish-btn"]');
    await publishBtn.click();

    // 预期结果：输入框内容清空
    await expect(input).toHaveValue('');

    // 预期结果：笔记列表顶部出现包含"今天学到的新概念"的笔记卡片
    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    await expect(firstMemoCard).toContainText('今天学到的新概念');

    // 预期结果：显示成功提示（Toast："发布成功" 或 "创建成功"）
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toContainText(/发布成功|创建成功/);

    // 预期结果：笔记卡片显示创建时间
    const timestamp = firstMemoCard.locator('[data-testid="memo-timestamp"]');
    await expect(timestamp).toBeVisible();
  });

  test('输入 10000 字符内容，发布成功', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 1. 在输入框中输入 10000 字符的文本
    const content10k = 'a'.repeat(10000);
    await input.fill(content10k);

    // 2. 输入框底部字数统计显示"10000/10000"
    const charCount = page.locator('[data-testid="char-count"]');
    await expect(charCount).toContainText('10000/10000');

    // 3. 点击"发布"按钮
    await publishBtn.click();

    // 预期结果：发送成功
    await expect(page.locator('[data-testid="toast"]')).toContainText(/发布成功|创建成功/);

    // 预期结果：笔记完整内容显示在列表顶部
    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    await expect(firstMemoCard).toBeVisible();

    // 预期结果：显示成功提示
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
  });

  test('创建笔记后下拉刷新，新笔记仍显示在列表顶部', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 前置条件：用户已成功创建一条笔记
    await input.fill('测试下拉刷新');
    await publishBtn.click();
    await page.waitForTimeout(500); // 等待笔记创建完成

    // 1. 在笔记列表顶部下拉刷新
    const memoList = page.locator('[data-testid="memo-list"]');
    await memoList.hover();
    // 模拟下拉刷新（具体实现取决于前端框架）
    await page.evaluate(() => {
      window.scrollTo(0, -100); // 模拟下拉
    });

    // 2. 等待刷新完成
    await page.waitForTimeout(1000);

    // 预期结果：刚创建的笔记仍显示在列表最顶部
    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    await expect(firstMemoCard).toContainText('测试下拉刷新');

    // 预期结果：列表顺序按创建时间倒序排列
    // （验证前几条笔记的时间戳递减）
  });
});

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建纯文本笔记 - UI 异常场景', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('输入框为空时点击发送，前端给出提示', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 1. 不输入任何内容（输入框为空）
    await expect(input).toHaveValue('');

    // 2. 点击"发送"按钮
    await publishBtn.click();

    // 预期结果：界面显示错误提示："内容不能为空"
    const errorToast = page.locator('[data-testid="toast"]');
    await expect(errorToast).toContainText('内容不能为空');

    // 预期结果：输入框保持聚焦状态
    await expect(input).toBeFocused();

    // 预期结果："发布"按钮仍可点击（未禁用）
    await expect(publishBtn).toBeEnabled();
  });

  test('输入内容超过 10000 字符，前端阻止继续输入并提示', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');

    // 1. 在输入框中输入 10001 字符
    const content10001 = 'a'.repeat(10001);
    await input.fill(content10001);

    // 预期结果：输入框底部字数提示变红（如"10001/10000"）
    const charCount = page.locator('[data-testid="char-count"]');
    await expect(charCount).toHaveClass(/text-red|error/);

    // 预期结果：输入框上方或附近显示警告提示："已达字数上限"
    const warning = page.locator('[data-testid="char-limit-warning"]');
    await expect(warning).toContainText('已达字数上限');

    // 预期结果：无法继续输入（或继续输入的字符被自动截断）
    const actualValue = await input.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(10000);
  });

  test('未登录用户访问主界面，跳转到登录页', async ({ page }) => {
    // 1. 清除 Session Cookie（模拟未登录状态）
    await page.context().clearCookies();

    // 2. 直接访问主界面 URL（如 `/`）
    await page.goto('/');

    // 预期结果：页面自动跳转至登录页（如 `/login`）
    await expect(page).toHaveURL(/\/login/);

    // 预期结果：登录页正常展示登录表单
    const loginForm = page.locator('[data-testid="login-form"]');
    await expect(loginForm).toBeVisible();
  });

  test('网络异常时点击发布，保留已输入内容并提示错误', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 1. 输入框中有内容"测试网络异常"
    await input.fill('测试网络异常');

    // 2. 断开网络连接（模拟）
    await page.route('**/api/memos', route => route.abort());

    // 3. 点击"发布"按钮
    await publishBtn.click();

    // 预期结果：界面显示错误提示："网络连接失败，请稍后重试"
    const errorToast = page.locator('[data-testid="toast"]');
    await expect(errorToast).toContainText(/网络连接失败|请稍后重试/);

    // 预期结果：输入框中的内容"测试网络异常"仍然保留
    await expect(input).toHaveValue('测试网络异常');

    // 预期结果：用户可重新点击发布按钮
    await expect(publishBtn).toBeEnabled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建纯文本笔记 - API 测试', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
    // 创建 API context，携带已登录的 Session Cookie
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
    // TODO: 登录获取 Session Cookie
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('有效内容和已登录用户，笔记创建成功', async () => {
    // 1. 发送 POST /api/memos，Body：{ "content": "今天学到的新概念" }
    const response = await apiContext.post('/api/memos', {
      data: { content: '今天学到的新概念' },
    });

    // 预期结果：接口返回 201
    expect(response.status()).toBe(201);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('message', '创建成功');

    // 预期结果：data 包含完整字段
    expect(body.data).toMatchObject({
      id: expect.any(String),
      content: '今天学到的新概念',
      userId: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      tags: [],
      images: [],
    });

    // TODO: 验证数据库 memos 表中新增一条记录
  });

  test('content 为 10000 字符（边界值），创建成功', async () => {
    const content10k = 'a'.repeat(10000);

    const response = await apiContext.post('/api/memos', {
      data: { content: content10k },
    });

    // 预期结果：接口返回 201
    expect(response.status()).toBe(201);

    const body = await response.json();

    // 预期结果：响应体 data.content 长度为 10000
    expect(body.data.content.length).toBe(10000);

    // TODO: 验证数据库成功存储完整内容
  });

  test('content 为 1 字符（最小边界值），创建成功', async () => {
    const response = await apiContext.post('/api/memos', {
      data: { content: 'a' },
    });

    // 预期结果：接口返回 201
    expect(response.status()).toBe(201);

    const body = await response.json();

    // 预期结果：响应体 data.content 值为 "a"
    expect(body.data.content).toBe('a');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建纯文本笔记 - API 异常场景', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('未登录时访问创建接口，返回 401', async () => {
    // 1. 不携带 Session cookie（或 cookie 无效）
    const response = await apiContext.post('/api/memos', {
      data: { content: '测试' },
    });

    // 预期结果：接口返回 401
    expect(response.status()).toBe(401);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toMatchObject({
      data: null,
      error: 'Unauthorized',
      message: '请先登录',
    });
  });

  test('content 为空字符串，返回 400', async () => {
    const response = await apiContext.post('/api/memos', {
      data: { content: '' },
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);

    const body = await response.json();

    // 预期结果：响应体包含错误信息
    expect(body).toMatchObject({
      data: null,
      error: 'VALIDATION_ERROR',
      message: expect.stringContaining('请求参数不合法'),
    });
  });

  test('content 字段缺失，返回 400', async () => {
    const response = await apiContext.post('/api/memos', {
      data: {},
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);

    const body = await response.json();

    // 预期结果：响应体包含错误信息，提示缺少必填字段
    expect(body.data).toBeNull();
    expect(body.error).toBeTruthy();
  });

  test('content 超过 10000 字符，返回 400', async () => {
    const content10001 = 'a'.repeat(10001);

    const response = await apiContext.post('/api/memos', {
      data: { content: content10001 },
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toMatchObject({
      data: null,
      error: 'VALIDATION_ERROR',
      message: expect.stringContaining('请求参数不合法'),
    });
  });

  test('数据库异常时，返回 500 且不暴露内部错误', async () => {
    // 此测试需要模拟数据库故障
    // TODO: 实现数据库故障模拟逻辑

    // 预期结果：接口返回 500
    // 预期结果：响应体格式：{ "data": null, "error": "INTERNAL_ERROR", "message": "服务器内部错误" }
    // 预期结果：响应体不包含数据库详细错误信息（如表名、字段名、SQL 语句）
  });
});
