// 测试用例：按分类查看笔记列表
// 对应文档：specs/active/45-create-memo-and-memo-list-1-testcases.md

import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('按分类查看笔记列表 - UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('切换到"有标签"分类，列表仅显示带标签的笔记', async ({ page }) => {
    // 前置条件：有 10 条笔记（5 条纯文本、3 条带标签、2 条带图片）
    // TODO: 使用测试数据工厂创建笔记

    // 1. 在主界面顶部点击"有标签"标签页
    const taggedTab = page.locator('[data-testid="filter-tab-tagged"]');
    await taggedTab.click();

    // 预期结果：列表刷新，仅显示 3 条带标签的笔记
    const memoCards = page.locator('[data-testid="memo-card"]');
    await expect(memoCards).toHaveCount(3);

    // 预期结果：每条笔记卡片上显示对应的标签
    for (const card of await memoCards.all()) {
      const tags = card.locator('[data-testid="memo-tag"]');
      await expect(tags.first()).toBeVisible();
    }

    // 预期结果：列表按创建时间倒序排列
    // TODO: 验证时间戳顺序
  });

  test('切换到"有图片"分类，列表仅显示带图片的笔记', async ({ page }) => {
    // 前置条件：有 10 条笔记（5 条纯文本、3 条带标签、2 条带图片）

    // 1. 在主界面顶部点击"有图片"标签页
    const imagesTab = page.locator('[data-testid="filter-tab-with-images"]');
    await imagesTab.click();

    // 预期结果：列表刷新，仅显示 2 条带图片的笔记
    const memoCards = page.locator('[data-testid="memo-card"]');
    await expect(memoCards).toHaveCount(2);

    // 预期结果：每条笔记卡片显示图片缩略图
    for (const card of await memoCards.all()) {
      const images = card.locator('[data-testid="memo-image"]');
      await expect(images.first()).toBeVisible();
    }
  });

  test('在"全部笔记"视图且当前无笔记，显示空状态提示', async ({ page }) => {
    // 前置条件：用户已登录，但没有任何笔记
    // TODO: 清空用户笔记数据

    // 1. 进入主界面（默认"全部笔记"分类）
    await page.goto('/');

    // 预期结果：列表中央显示空状态提示文案："还没有笔记，快来记录第一个想法吧"
    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/还没有笔记|快来记录第一个想法/);

    // 预期结果：显示"立即创建"按钮或类似引导操作
    const createBtn = emptyState.locator('[data-testid="create-first-memo-btn"]');
    await expect(createBtn).toBeVisible();
  });

  test('在"有标签"视图且无带标签笔记，显示空状态提示', async ({ page }) => {
    // 前置条件：用户已登录，有纯文本笔记，但无带标签笔记

    // 1. 点击"有标签"标签页
    const taggedTab = page.locator('[data-testid="filter-tab-tagged"]');
    await taggedTab.click();

    // 预期结果：列表中央显示空状态文案："还没有带标签的笔记，试试添加标签吧"
    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/还没有带标签的笔记|试试添加标签/);
  });

  test('笔记列表滚动到底部，自动加载下一页', async ({ page }) => {
    // 前置条件：用户已登录，有超过 20 条笔记（触发分页）
    // TODO: 创建 25 条测试笔记

    // 1. 在"全部笔记"视图中，向下滚动到列表底部
    const memoList = page.locator('[data-testid="memo-list"]');

    // 获取初始笔记数量
    const initialCount = await page.locator('[data-testid="memo-card"]').count();
    expect(initialCount).toBe(20); // 第一页显示 20 条

    // 滚动到底部
    await memoList.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });

    // 预期结果：列表底部显示加载指示器（Spinner）
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();

    // 预期结果：自动加载下一页笔记（接口请求 page=2）
    await page.waitForResponse(resp => resp.url().includes('page=2'));

    // 预期结果：新笔记追加到列表末尾
    const finalCount = await page.locator('[data-testid="memo-card"]').count();
    expect(finalCount).toBeGreaterThan(initialCount);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('按分类查看笔记列表 - UI 异常场景', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('笔记列表加载失败，显示错误提示和重试按钮', async ({ page }) => {
    // 模拟网络异常或服务器错误
    await page.route('**/api/memos*', route => route.abort());

    // 刷新页面触发列表加载
    await page.reload();

    // 预期结果：列表中央显示错误提示："加载失败，点击重试"
    const errorState = page.locator('[data-testid="error-state"]');
    await expect(errorState).toBeVisible();
    await expect(errorState).toContainText(/加载失败|点击重试/);

    // 预期结果：显示"重试"按钮
    const retryBtn = errorState.locator('[data-testid="retry-btn"]');
    await expect(retryBtn).toBeVisible();

    // 恢复网络
    await page.unroute('**/api/memos*');

    // 预期结果：用户点击重试按钮后，重新请求数据
    await retryBtn.click();

    // 验证列表加载成功
    await expect(page.locator('[data-testid="memo-card"]').first()).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('按分类查看笔记列表 - API 测试', () => {
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

  test('请求全部笔记列表（filter=all），返回所有笔记', async () => {
    const response = await apiContext.get('/api/memos?filter=all&page=1&limit=20');

    // 预期结果：接口返回 200
    expect(response.status()).toBe(200);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toMatchObject({
      data: {
        memos: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 20,
      },
      message: 'ok',
    });

    // 预期结果：memos 数组包含当前用户的所有笔记，按 createdAt 倒序排列
    if (body.data.memos.length > 1) {
      const firstCreatedAt = new Date(body.data.memos[0].createdAt);
      const secondCreatedAt = new Date(body.data.memos[1].createdAt);
      expect(firstCreatedAt >= secondCreatedAt).toBe(true);
    }
  });

  test('请求有标签笔记列表（filter=tagged），仅返回带标签的笔记', async () => {
    const response = await apiContext.get('/api/memos?filter=tagged&page=1&limit=20');

    // 预期结果：接口返回 200
    expect(response.status()).toBe(200);

    const body = await response.json();

    // 预期结果：响应体 data.memos 数组仅包含在 memo_tags 表中有关联记录的笔记
    expect(body.data.memos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tags: expect.arrayContaining([expect.any(Object)]),
        }),
      ])
    );

    // 预期结果：每条笔记的 tags 数组非空
    for (const memo of body.data.memos) {
      expect(memo.tags.length).toBeGreaterThan(0);
    }
  });

  test('请求有图片笔记列表（filter=with-images），仅返回带图片的笔记', async () => {
    const response = await apiContext.get('/api/memos?filter=with-images&page=1&limit=20');

    // 预期结果：接口返回 200
    expect(response.status()).toBe(200);

    const body = await response.json();

    // 预期结果：响应体 data.memos 数组仅包含在 memo_images 表中有关联记录的笔记
    expect(body.data.memos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          images: expect.arrayContaining([expect.any(Object)]),
        }),
      ])
    );

    // 预期结果：每条笔记的 images 数组非空
    for (const memo of body.data.memos) {
      expect(memo.images.length).toBeGreaterThan(0);
    }
  });

  test('请求第 2 页笔记（page=2），返回正确的分页数据', async () => {
    // 前置条件：有超过 20 条笔记

    const response = await apiContext.get('/api/memos?filter=all&page=2&limit=20');

    // 预期结果：接口返回 200
    expect(response.status()).toBe(200);

    const body = await response.json();

    // 预期结果：响应体 data.page 值为 2
    expect(body.data.page).toBe(2);

    // 预期结果：响应体 data.memos 数组包含第 21-40 条笔记
    // （验证逻辑取决于测试数据准备）
  });

  test('请求特定标签下的笔记列表（tagId 参数），返回该标签的笔记', async () => {
    // 前置条件：有标签"#工作"（id: "tag-uuid-1"）
    // TODO: 创建测试标签并获取 ID

    const tagId = 'tag-uuid-1'; // 示例 ID

    const response = await apiContext.get(`/api/memos?tagId=${tagId}&page=1&limit=20`);

    // 预期结果：接口返回 200
    expect(response.status()).toBe(200);

    const body = await response.json();

    // 预期结果：响应体 data.memos 数组仅包含关联了标签"#工作"的笔记
    for (const memo of body.data.memos) {
      const hasTag = memo.tags.some(tag => tag.id === tagId);
      expect(hasTag).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('按分类查看笔记列表 - API 异常场景', () => {
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

  test('未登录访问笔记列表接口，返回 401', async () => {
    const response = await apiContext.get('/api/memos?filter=all&page=1&limit=20');

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

  test('filter 参数值非法（非枚举值），返回 400', async () => {
    const response = await apiContext.get('/api/memos?filter=invalid&page=1&limit=20');

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

  test('page 参数为 0 或负数，返回 400', async () => {
    const response = await apiContext.get('/api/memos?filter=all&page=0&limit=20');

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);
  });

  test('limit 参数超过 100，返回 400', async () => {
    const response = await apiContext.get('/api/memos?filter=all&page=1&limit=101');

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);
  });

  test('tagId 参数指向不存在的标签，返回 404', async () => {
    const response = await apiContext.get('/api/memos?tagId=non-existent-id&page=1&limit=20');

    // 预期结果：接口返回 404
    expect(response.status()).toBe(404);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toMatchObject({
      data: null,
      error: 'NOT_FOUND',
      message: expect.stringContaining('Tag not found'),
    });
  });

  test('tagId 参数指向其他用户的标签，返回 403 或 404', async () => {
    // TODO: 创建属于其他用户的标签
    const otherUserTagId = 'user-b-tag-id';

    const response = await apiContext.get(`/api/memos?tagId=${otherUserTagId}&page=1&limit=20`);

    // 预期结果：接口返回 403 或 404
    expect([403, 404]).toContain(response.status());

    const body = await response.json();

    // 预期结果：响应体包含错误信息
    expect(body.data).toBeNull();
    expect(body.error).toBeTruthy();
  });
});
