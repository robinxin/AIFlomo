// 测试用例：查看全部标签及笔记数
// 对应文档：specs/active/45-create-memo-and-memo-list-1-testcases.md

import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('查看全部标签及笔记数 - UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('进入"全部标签"页面，显示所有标签及笔记数', async ({ page }) => {
    // 前置条件：用户已登录，有 5 个标签（#工作、#阅读、#灵感、#日记、#学习）
    // TODO: 创建测试标签数据

    // 1. 在主界面点击"标签"入口（侧边栏或底部导航）
    const tagsEntry = page.locator('[data-testid="tags-nav-link"]');
    await tagsEntry.click();

    // 2. 进入"全部标签"列表页面
    await expect(page).toHaveURL(/\/tags/);

    // 预期结果：显示 5 个标签条目
    const tagItems = page.locator('[data-testid="tag-list-item"]');
    await expect(tagItems).toHaveCount(5);

    // 预期结果：每个标签后括号内显示对应笔记数（如"#工作 (8)"）
    const expectedTags = [
      { name: '工作', count: 8 },
      { name: '阅读', count: 5 },
      { name: '灵感', count: 3 },
      { name: '日记', count: 2 },
      { name: '学习', count: 1 },
    ];

    for (const { name, count } of expectedTags) {
      const tagItem = page.locator('[data-testid="tag-list-item"]', { hasText: name });
      await expect(tagItem).toContainText(`(${count})`);
    }

    // 预期结果：标签按创建时间倒序排列（或字母顺序，取决于实现）
    // TODO: 验证排序顺序
  });

  test('点击某个标签条目，跳转到该标签的笔记列表页面', async ({ page }) => {
    // 前置条件：用户在"全部标签"页面，有标签"#阅读 (5)"
    await page.goto('/tags');

    const tagItem = page.locator('[data-testid="tag-list-item"]', { hasText: '阅读' });
    await expect(tagItem).toBeVisible();

    // 1. 点击标签条目"#阅读 (5)"
    await tagItem.click();

    // 预期结果：页面跳转到该标签的笔记列表页（如 /tags/tag-uuid-2）
    await expect(page).toHaveURL(/\/tags\/[a-z0-9-]+/);

    // 预期结果：列表仅显示带有"#阅读"标签的 5 条笔记
    const memoCards = page.locator('[data-testid="memo-card"]');
    await expect(memoCards).toHaveCount(5);

    // 验证每条笔记都包含"#阅读"标签
    for (const card of await memoCards.all()) {
      const tags = card.locator('[data-testid="memo-tag"]', { hasText: '阅读' });
      await expect(tags).toBeVisible();
    }
  });

  test('标签笔记数为 0 时，标签仍显示在列表中', async ({ page }) => {
    // 前置条件：用户已登录，有标签"#灵感"，该标签下无笔记
    await page.goto('/tags');

    // 预期结果：列表中显示"#灵感 (0)"
    const tagItem = page.locator('[data-testid="tag-list-item"]', { hasText: '灵感' });
    await expect(tagItem).toBeVisible();
    await expect(tagItem).toContainText('(0)');

    // 预期结果：标签条目仍然可见，未被自动隐藏或删除
    await expect(tagItem).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('查看全部标签及笔记数 - API 测试', () => {
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

  test('请求全部标签列表，返回所有标签及笔记数', async () => {
    const response = await apiContext.get('/api/tags');

    // 预期结果：接口返回 200
    expect(response.status()).toBe(200);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          createdAt: expect.any(String),
          memoCount: expect.any(Number),
        }),
      ]),
      message: 'ok',
    });

    // 预期结果：data 数组包含当前用户的所有标签
    expect(Array.isArray(body.data)).toBe(true);

    // 预期结果：每个标签对象包含 memoCount 字段（通过聚合查询实时计算）
    for (const tag of body.data) {
      expect(tag).toHaveProperty('memoCount');
      expect(typeof tag.memoCount).toBe('number');
      expect(tag.memoCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('笔记数为 0 的标签也包含在响应中', async () => {
    // 前置条件：用户已登录，有标签"#灵感"，该标签下无笔记
    // TODO: 创建测试标签（无笔记）

    const response = await apiContext.get('/api/tags');

    expect(response.status()).toBe(200);

    const body = await response.json();

    // 预期结果：响应体 data 数组中包含 memoCount 为 0 的标签
    const emptyTag = body.data.find(tag => tag.memoCount === 0);
    expect(emptyTag).toBeDefined();
    expect(emptyTag).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      memoCount: 0,
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('查看全部标签及笔记数 - API 异常场景', () => {
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

  test('未登录访问标签列表接口，返回 401', async () => {
    const response = await apiContext.get('/api/tags');

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
});
