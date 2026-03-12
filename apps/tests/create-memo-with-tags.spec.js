// 测试用例：创建带标签的笔记
// 对应文档：specs/active/45-create-memo-and-memo-list-1-testcases.md

import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带标签的笔记 - UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 前置条件：用户已登录，停留在主界面
    await page.goto('/');
  });

  test('选择已有标签并发布，笔记显示该标签', async ({ page }) => {
    // 前置条件：已有标签"#阅读"
    const input = page.locator('[data-testid="memo-input"]');
    const tagBtn = page.locator('[data-testid="tag-btn"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 1. 在输入框中输入"《原则》第三章笔记"
    await input.fill('《原则》第三章笔记');

    // 2. 点击"#标签"按钮或标签选择入口
    await tagBtn.click();

    // 3. 从弹出的标签列表中选择"#阅读"
    const tagPicker = page.locator('[data-testid="tag-picker"]');
    await expect(tagPicker).toBeVisible();

    const tagItem = tagPicker.locator('[data-testid="tag-item"]', { hasText: '阅读' });
    await tagItem.click();

    // 4. 弹层关闭，输入框上方显示"#阅读"
    await expect(tagPicker).not.toBeVisible();
    const selectedTags = page.locator('[data-testid="selected-tags"]');
    await expect(selectedTags).toContainText('#阅读');

    // 5. 点击"发布"按钮
    await publishBtn.click();

    // 预期结果：笔记成功发布
    await expect(page.locator('[data-testid="toast"]')).toContainText(/发布成功|创建成功/);

    // 预期结果：笔记卡片上显示"#阅读"标签
    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    await expect(firstMemoCard.locator('[data-testid="memo-tag"]', { hasText: '阅读' })).toBeVisible();

    // 预期结果：切换到"有标签"分类，该笔记可见
    const taggedTab = page.locator('[data-testid="filter-tab-tagged"]');
    await taggedTab.click();
    await expect(firstMemoCard).toContainText('《原则》第三章笔记');
  });

  test('输入不存在的标签，系统自动创建新标签', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const tagBtn = page.locator('[data-testid="tag-btn"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 1. 在输入框中输入"测试新标签功能"
    await input.fill('测试新标签功能');

    // 2. 打开标签选择弹层
    await tagBtn.click();

    const tagPicker = page.locator('[data-testid="tag-picker"]');
    await expect(tagPicker).toBeVisible();

    // 3. 在标签输入框中输入"新标签"
    const tagInput = tagPicker.locator('[data-testid="tag-input"]');
    await tagInput.fill('新标签');

    // 4. 点击"添加"按钮
    const addTagBtn = tagPicker.locator('[data-testid="add-tag-btn"]');
    await addTagBtn.click();

    // 5. 弹层关闭，输入框上方显示"#新标签"
    await expect(tagPicker).not.toBeVisible();
    const selectedTags = page.locator('[data-testid="selected-tags"]');
    await expect(selectedTags).toContainText('#新标签');

    // 6. 点击"发布"按钮
    await publishBtn.click();

    // 预期结果：笔记成功发布
    await expect(page.locator('[data-testid="toast"]')).toContainText(/发布成功|创建成功/);

    // 预期结果：笔记卡片上显示"#新标签"
    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    await expect(firstMemoCard.locator('[data-testid="memo-tag"]', { hasText: '新标签' })).toBeVisible();

    // 预期结果：进入"全部标签"页面，列表中出现"#新标签"条目，笔记数为 1
    await page.goto('/tags');
    const tagListItem = page.locator('[data-testid="tag-list-item"]', { hasText: '新标签' });
    await expect(tagListItem).toBeVisible();
    await expect(tagListItem).toContainText('1');
  });

  test('为笔记添加多个标签，笔记在所有标签筛选下均可见', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const tagBtn = page.locator('[data-testid="tag-btn"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 1. 在输入框中输入"新产品创意"
    await input.fill('新产品创意');

    // 2. 选择标签"#工作"和"#灵感"
    await tagBtn.click();

    const tagPicker = page.locator('[data-testid="tag-picker"]');
    await tagPicker.locator('[data-testid="tag-item"]', { hasText: '工作' }).click();
    await tagPicker.locator('[data-testid="tag-item"]', { hasText: '灵感' }).click();

    // 3. 输入框上方显示"#工作 #灵感"
    const selectedTags = page.locator('[data-testid="selected-tags"]');
    await expect(selectedTags).toContainText('#工作');
    await expect(selectedTags).toContainText('#灵感');

    // 4. 点击"发布"按钮
    await publishBtn.click();

    // 预期结果：笔记成功发布
    await expect(page.locator('[data-testid="toast"]')).toContainText(/发布成功|创建成功/);

    // 预期结果：笔记卡片上同时显示"#工作"和"#灵感"两个标签
    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    await expect(firstMemoCard.locator('[data-testid="memo-tag"]', { hasText: '工作' })).toBeVisible();
    await expect(firstMemoCard.locator('[data-testid="memo-tag"]', { hasText: '灵感' })).toBeVisible();

    // 预期结果：进入"全部标签"页面，"#工作"和"#灵感"的笔记数各 +1
    await page.goto('/tags');
    // TODO: 验证笔记数增加

    // 预期结果：分别点击"#工作"和"#灵感"标签进入对应笔记列表，该笔记均可见
    await page.locator('[data-testid="tag-list-item"]', { hasText: '工作' }).click();
    await expect(page.locator('[data-testid="memo-card"]', { hasText: '新产品创意' })).toBeVisible();

    await page.goBack();
    await page.locator('[data-testid="tag-list-item"]', { hasText: '灵感' }).click();
    await expect(page.locator('[data-testid="memo-card"]', { hasText: '新产品创意' })).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带标签的笔记 - UI 异常场景', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('标签名称包含特殊字符，前端实时过滤', async ({ page }) => {
    const tagBtn = page.locator('[data-testid="tag-btn"]');

    // 1. 打开标签选择弹层
    await tagBtn.click();

    const tagPicker = page.locator('[data-testid="tag-picker"]');
    const tagInput = tagPicker.locator('[data-testid="tag-input"]');

    // 2. 在标签输入框中输入"工作@home"
    await tagInput.fill('工作@home');

    // 预期结果：输入框中仅显示"工作home"（特殊字符 @ 被自动过滤）
    // 或显示提示："标签仅支持字母、数字、下划线"
    const actualValue = await tagInput.inputValue();
    expect(actualValue).not.toContain('@');

    // 可能的实现：显示警告提示
    const warning = tagPicker.locator('[data-testid="tag-format-warning"]');
    await expect(warning).toContainText(/标签仅支持|字母|数字|下划线/);
  });

  test('标签名称超过 20 字符，前端自动截断', async ({ page }) => {
    const tagBtn = page.locator('[data-testid="tag-btn"]');

    await tagBtn.click();

    const tagPicker = page.locator('[data-testid="tag-picker"]');
    const tagInput = tagPicker.locator('[data-testid="tag-input"]');

    // 在标签输入框中输入 21 个字符的标签名
    const longTagName = 'a'.repeat(21);
    await tagInput.fill(longTagName);

    // 预期结果：输入框中仅显示前 20 个字符
    const actualValue = await tagInput.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(20);
  });

  test('标签名称少于 2 字符，无法添加', async ({ page }) => {
    const tagBtn = page.locator('[data-testid="tag-btn"]');

    await tagBtn.click();

    const tagPicker = page.locator('[data-testid="tag-picker"]');
    const tagInput = tagPicker.locator('[data-testid="tag-input"]');
    const addTagBtn = tagPicker.locator('[data-testid="add-tag-btn"]');

    // 在标签输入框中输入单个字符"a"
    await tagInput.fill('a');

    // 点击"添加"按钮
    await addTagBtn.click();

    // 预期结果：显示错误提示："标签名称至少 2 个字符"
    const errorMsg = tagPicker.locator('[data-testid="tag-error"]');
    await expect(errorMsg).toContainText('标签名称至少 2 个字符');

    // 预期结果：标签未添加到笔记
    const selectedTags = page.locator('[data-testid="selected-tags"]');
    await expect(selectedTags).not.toContainText('#a');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带标签的笔记 - API 测试', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
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

  test('创建笔记时传入已存在的标签 ID，关联成功', async () => {
    // 前置条件：已有标签"#阅读"（id: "tag-uuid-1"）
    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        tagNames: ['阅读'],
      },
    });

    // 预期结果：接口返回 201
    expect(response.status()).toBe(201);

    const body = await response.json();

    // 预期结果：响应体 data.tags 数组包含标签对象
    expect(body.data.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          name: '阅读',
        }),
      ])
    );

    // TODO: 验证数据库 memo_tags 表中新增一条记录
  });

  test('创建笔记时传入不存在的标签名，后端自动创建', async () => {
    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        tagNames: ['新标签_' + Date.now()], // 使用时间戳避免冲突
      },
    });

    // 预期结果：接口返回 201
    expect(response.status()).toBe(201);

    const body = await response.json();

    // 预期结果：响应体 data.tags 数组包含新创建的标签对象
    expect(body.data.tags.length).toBeGreaterThan(0);
    expect(body.data.tags[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });

    // TODO: 验证数据库 tags 表中新增一条记录
    // TODO: 验证数据库 memo_tags 表中新增关联记录
  });

  test('创建笔记时传入多个标签，全部关联成功', async () => {
    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        tagNames: ['工作', '灵感', '阅读'],
      },
    });

    // 预期结果：接口返回 201
    expect(response.status()).toBe(201);

    const body = await response.json();

    // 预期结果：响应体 data.tags 数组包含 3 个标签对象
    expect(body.data.tags.length).toBe(3);

    // TODO: 验证数据库 memo_tags 表中新增 3 条记录
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带标签的笔记 - API 异常场景', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
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

  test('tagNames 数组中包含非法字符的标签名，返回 400', async () => {
    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        tagNames: ['工作@home'],
      },
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

  test('tagNames 数组中包含长度超过 20 字符的标签名，返回 400', async () => {
    const longTagName = 'a'.repeat(21);

    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        tagNames: [longTagName],
      },
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);
  });

  test('tagNames 数组中包含长度少于 2 字符的标签名，返回 400', async () => {
    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        tagNames: ['a'],
      },
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);
  });

  test('tagNames 数组超过 50 项，返回 400', async () => {
    const tags = Array.from({ length: 51 }, (_, i) => `标签${i}`);

    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        tagNames: tags,
      },
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);
  });
});
