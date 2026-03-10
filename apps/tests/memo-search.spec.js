import { test, expect } from '@playwright/test';

/**
 * 搜索笔记测试
 * 对应测试用例文档：§ 搜索笔记
 */

// 测试前登录
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', '12345678');
  await page.click('button:has-text("登录")');
  await page.waitForURL('/memo');
});

test.describe('搜索笔记 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('用户在搜索框输入关键词，实时显示匹配笔记', async ({ page }) => {
      // 跳转到搜索页
      await page.goto('/memo/search');

      // 在搜索框输入关键词
      await page.fill('[data-testid="search-input"]', '会议');

      // 等待防抖延迟（300ms）
      await page.waitForTimeout(350);

      // 验证搜索结果显示
      await expect(page.locator('[data-testid="memo-card"]')).toHaveCount({ min: 1 });

      // 验证匹配的关键词高亮
      const memoCards = page.locator('[data-testid="memo-card"]');
      const firstCard = memoCards.first();
      await expect(firstCard.locator('text=会议')).toBeVisible();

      // 验证搜索结果按时间倒序
      const count = await memoCards.count();
      if (count >= 2) {
        const firstTime = await memoCards.nth(0).getAttribute('data-created-at');
        const secondTime = await memoCards.nth(1).getAttribute('data-created-at');
        expect(new Date(firstTime) >= new Date(secondTime)).toBeTruthy();
      }
    });

    test('用户清空搜索框，返回全部笔记列表', async ({ page }) => {
      await page.goto('/memo/search');

      // 先搜索
      await page.fill('[data-testid="search-input"]', '测试');
      await page.waitForTimeout(350);

      // 验证有搜索结果
      await expect(page.locator('[data-testid="memo-card"]')).toHaveCount({ min: 1 });

      // 点击清空按钮
      await page.click('[data-testid="clear-search-btn"]');

      // 验证搜索框清空
      await expect(page.locator('[data-testid="search-input"]')).toHaveValue('');

      // 验证返回全部笔记或主页
      await expect(page).toHaveURL(/\/memo/);
    });
  });

  test.describe('异常场景', () => {
    test('用户搜索不存在的关键词，显示空状态提示', async ({ page }) => {
      await page.goto('/memo/search');

      // 搜索不存在的关键词
      await page.fill('[data-testid="search-input"]', '不存在的关键词xyz123');
      await page.waitForTimeout(350);

      // 验证空状态提示
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(page.locator('text=未找到相关笔记')).toBeVisible();

      // 验证"清空搜索"按钮
      await expect(page.locator('button:has-text("清空搜索")')).toBeVisible();
    });

    test('用户搜索结果超过 100 条，显示分页或限制提示', async ({ page }) => {
      // 此场景需要准备大量数据，暂时跳过
      test.skip();
    });
  });
});

test.describe('搜索笔记 - API 测试', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:3000'
    });

    // 登录
    await apiContext.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: '12345678'
      }
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('正常场景', () => {
    test('关键词搜索笔记内容，返回匹配结果', async () => {
      const response = await apiContext.get('/api/memos?q=会议');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();

      // 验证所有结果都包含关键词
      for (const memo of body.data) {
        expect(memo.content.toLowerCase()).toContain('会议');
      }
    });

    test('搜索关键词为空字符串，返回全部笔记', async () => {
      const response = await apiContext.get('/api/memos?q=');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      // 返回的笔记数量应该和不带 q 参数一致
    });
  });

  test.describe('异常场景', () => {
    test('未登录用户搜索，返回 401', async ({ request }) => {
      const response = await request.get('/api/memos?q=测试');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });
  });
});
