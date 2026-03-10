import { test, expect } from '@playwright/test';

/**
 * 浏览和筛选笔记测试
 * 对应测试用例文档：§ 浏览和筛选笔记
 */

// 测试前登录
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', '12345678');
  await page.click('button:has-text("登录")');
  await page.waitForURL('/memo');
});

test.describe('浏览和筛选笔记 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('用户进入笔记主页，看到所有笔记列表按时间倒序排列', async ({ page }) => {
      // 验证页面显示笔记列表
      await expect(page.locator('[data-testid="memo-list"]')).toBeVisible();

      // 验证左侧筛选面板显示
      await expect(page.locator('[data-testid="sidebar-filter"]')).toBeVisible();

      // 验证标签树显示
      await expect(page.locator('[data-testid="tag-list"]')).toBeVisible();

      // 获取前两条笔记的时间戳，验证倒序
      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      if (count >= 2) {
        const firstTime = await memoCards.nth(0).getAttribute('data-created-at');
        const secondTime = await memoCards.nth(1).getAttribute('data-created-at');
        expect(new Date(firstTime) >= new Date(secondTime)).toBeTruthy();
      }
    });

    test('用户点击"有标签"筛选项，仅显示带标签的笔记', async ({ page }) => {
      // 点击"有标签"筛选
      await page.click('[data-testid="filter-tagged"]');

      // 验证筛选项高亮
      await expect(page.locator('[data-testid="filter-tagged"]')).toHaveClass(/active|selected/);

      // 验证页面顶部显示筛选标题
      await expect(page.locator('text=有标签')).toBeVisible();

      // 验证所有显示的笔记都有标签
      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = memoCards.nth(i);
        await expect(card.locator('[data-testid="tag"]')).toHaveCount({ min: 1 });
      }
    });

    test('用户点击某个标签（如 #工作），仅显示该标签下的笔记', async ({ page }) => {
      // 点击"工作"标签
      await page.click('[data-testid="tag-list"] >> text=工作');

      // 验证标签高亮
      await expect(page.locator('[data-testid="tag-list"] >> text=工作')).toHaveClass(/active|selected/);

      // 验证页面顶部显示标签名称
      await expect(page.locator('h1:has-text("工作")')).toBeVisible();

      // 验证所有笔记都包含"工作"标签
      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = memoCards.nth(i);
        await expect(card.locator('[data-testid="tag"]:has-text("工作")')).toBeVisible();
      }
    });

    test('用户点击"无标签"筛选项，仅显示未打标签的笔记', async ({ page }) => {
      await page.click('[data-testid="filter-untagged"]');

      await expect(page.locator('[data-testid="filter-untagged"]')).toHaveClass(/active|selected/);

      // 验证所有笔记无标签
      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = memoCards.nth(i);
        await expect(card.locator('[data-testid="tag"]')).toHaveCount(0);
      }
    });

    test('用户点击"有图片"筛选项，仅显示包含图片的笔记', async ({ page }) => {
      await page.click('[data-testid="filter-image"]');

      await expect(page.locator('[data-testid="filter-image"]')).toHaveClass(/active|selected/);

      // 验证所有笔记都有图片
      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = memoCards.nth(i);
        await expect(card.locator('[data-testid="memo-image"]')).toBeVisible();
      }
    });
  });

  test.describe('异常场景', () => {
    test('用户账号下无任何笔记，显示空状态提示', async ({ page }) => {
      // 假设使用新用户账号
      // 此场景需要特殊处理，暂时跳过
      test.skip();
    });

    test('用户筛选某个标签但该标签下无笔记，显示空状态', async ({ page }) => {
      // 创建一个无笔记的标签（通过API或者特殊设置）
      // 此场景需要特殊处理，暂时跳过
      test.skip();
    });
  });
});

test.describe('浏览笔记 - API 测试', () => {
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
    test('已登录用户获取笔记列表，返回所有正常笔记', async () => {
      const response = await apiContext.get('/api/memos');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.message).toBe('ok');

      // 验证笔记按创建时间倒序排列
      if (body.data.length >= 2) {
        const firstTime = new Date(body.data[0].createdAt);
        const secondTime = new Date(body.data[1].createdAt);
        expect(firstTime >= secondTime).toBeTruthy();
      }
    });

    test('按类型筛选：获取有标签的笔记', async () => {
      const response = await apiContext.get('/api/memos?type=tagged');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();

      // 验证所有笔记都有标签
      for (const memo of body.data) {
        expect(memo.tags).toBeDefined();
        expect(memo.tags.length).toBeGreaterThan(0);
      }
    });

    test('按类型筛选：获取无标签的笔记', async () => {
      const response = await apiContext.get('/api/memos?type=untagged');

      expect(response.status()).toBe(200);

      const body = await response.json();

      // 验证所有笔记无标签
      for (const memo of body.data) {
        expect(!memo.tags || memo.tags.length === 0).toBeTruthy();
      }
    });

    test('按类型筛选：获取有图片的笔记', async () => {
      const response = await apiContext.get('/api/memos?type=image');

      expect(response.status()).toBe(200);

      const body = await response.json();

      // 验证所有笔记 hasImage = 1
      for (const memo of body.data) {
        expect(memo.hasImage).toBe(1);
      }
    });

    test('按标签筛选：获取某个标签下的所有笔记', async () => {
      // 先获取标签列表
      const tagsRes = await apiContext.get('/api/tags');
      const tagsBody = await tagsRes.json();

      if (tagsBody.data.length > 0) {
        const tagId = tagsBody.data[0].id;

        const response = await apiContext.get(`/api/memos?tagId=${tagId}`);

        expect(response.status()).toBe(200);

        const body = await response.json();

        // 验证所有笔记都包含该标签
        for (const memo of body.data) {
          const memoTags = memo.tags || [];
          expect(memoTags.some(tag => tag.id === tagId)).toBeTruthy();
        }
      }
    });
  });

  test.describe('异常场景', () => {
    test('未登录用户访问笔记列表，返回 401', async ({ request }) => {
      const response = await request.get('/api/memos');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });

    test('操作他人笔记（访问不属于自己的笔记 ID），返回 404', async () => {
      // 此测试需要多个用户账号，暂时跳过
      test.skip();
    });
  });
});
