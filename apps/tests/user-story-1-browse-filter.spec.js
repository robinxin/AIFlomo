import { test, expect } from '@playwright/test';

/**
 * 用户故事 1 E2E 测试：快速浏览和筛选笔记
 *
 * 验收场景：
 * 1. 用户进入笔记页面，看到完整的笔记列表和分类统计
 * 2. 用户点击「有标签」筛选项，仅显示带标签的笔记，数量显示正确
 * 3. 用户点击某个标签（如 #工作），仅显示该标签下的笔记
 * 4. 用户点击「无标签」筛选项，仅显示未打标签的笔记
 */

test.describe('用户故事 1：快速浏览和筛选笔记', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
    await page.click('button:has-text("登录")');
    await page.waitForURL('/memo');
  });

  test.describe('验收场景 1：进入笔记页面，看到完整笔记列表和分类统计', () => {
    test('笔记列表按创建时间倒序排列，且显示分类筛选面板', async ({ page }) => {
      await expect(page.locator('[data-testid="memo-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="sidebar-filter"]')).toBeVisible();
      await expect(page.locator('[data-testid="tag-list"]')).toBeVisible();

      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      if (count >= 2) {
        const firstTime = await memoCards.nth(0).getAttribute('data-created-at');
        const secondTime = await memoCards.nth(1).getAttribute('data-created-at');
        expect(new Date(firstTime) >= new Date(secondTime)).toBeTruthy();
      }
    });

    test('页面显示笔记数量统计信息', async ({ page }) => {
      await expect(page.locator('[data-testid="stats-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-memos"]')).toContainText(/全部笔记.*\d+.*条/);
      await expect(page.locator('[data-testid="tagged-memos"]')).toContainText(/有标签.*\d+.*条/);
    });

    test('类型筛选项显示对应笔记数量', async ({ page }) => {
      await expect(page.locator('[data-testid="filter-tagged"]')).toBeVisible();
      await expect(page.locator('[data-testid="filter-untagged"]')).toBeVisible();
      await expect(page.locator('[data-testid="filter-image"]')).toBeVisible();
    });
  });

  test.describe('验收场景 2：点击「有标签」筛选项，仅显示带标签的笔记', () => {
    test('点击「有标签」筛选后，所有笔记卡片都有标签', async ({ page }) => {
      await page.click('[data-testid="filter-tagged"]');

      await expect(page.locator('[data-testid="filter-tagged"]')).toHaveClass(/active|selected/);
      await expect(page.locator('text=有标签')).toBeVisible();

      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = memoCards.nth(i);
        expect(await card.locator('[data-testid="tag"]').count()).toBeGreaterThanOrEqual(1);
      }
    });

    test('「有标签」筛选通过 API 返回正确结果', async ({ request, page }) => {
      await page.waitForURL('/memo');

      const response = await request.get('/api/memos?type=tagged', {
        headers: { Cookie: (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join('; ') }
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();

      for (const memo of body.data) {
        expect(memo.tags).toBeDefined();
        expect(memo.tags.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('验收场景 3：点击某个标签，仅显示该标签下的笔记', () => {
    test('点击标签后，笔记列表仅包含该标签，且标签高亮', async ({ page }) => {
      const tagItems = page.locator('[data-testid="tag-item"]');
      const tagCount = await tagItems.count();

      if (tagCount === 0) {
        test.skip();
        return;
      }

      const firstTagText = await tagItems.first().textContent();
      const tagName = firstTagText.replace(/\s*\(\d+\)\s*/, '').trim();

      await tagItems.first().click();

      await expect(tagItems.first()).toHaveClass(/active|selected/);

      const memoCards = page.locator('[data-testid="memo-card"]');
      const memoCount = await memoCards.count();

      for (let i = 0; i < Math.min(memoCount, 5); i++) {
        const card = memoCards.nth(i);
        await expect(card.locator(`[data-testid="tag"]:has-text("${tagName}")`)).toBeVisible();
      }
    });

    test('按标签筛选通过 API 返回该标签下的所有笔记', async ({ page }) => {
      const tagsResponse = await page.request.get('/api/tags');
      const tagsBody = await tagsResponse.json();

      if (!tagsBody.data || tagsBody.data.length === 0) {
        test.skip();
        return;
      }

      const tagId = tagsBody.data[0].id;
      const tagName = tagsBody.data[0].name;

      const response = await page.request.get(`/api/memos?tagId=${tagId}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.message).toBe('ok');

      for (const memo of body.data) {
        const memoTags = memo.tags || [];
        expect(memoTags.some(tag => tag.id === tagId || tag.name === tagName)).toBeTruthy();
      }
    });
  });

  test.describe('验收场景 4：点击「无标签」筛选项，仅显示未打标签的笔记', () => {
    test('点击「无标签」筛选后，所有笔记卡片都没有标签', async ({ page }) => {
      await page.click('[data-testid="filter-untagged"]');

      await expect(page.locator('[data-testid="filter-untagged"]')).toHaveClass(/active|selected/);

      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = memoCards.nth(i);
        await expect(card.locator('[data-testid="tag"]')).toHaveCount(0);
      }
    });

    test('「无标签」筛选通过 API 返回无标签的笔记', async ({ page }) => {
      const response = await page.request.get('/api/memos?type=untagged');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();

      for (const memo of body.data) {
        expect(!memo.tags || memo.tags.length === 0).toBeTruthy();
      }
    });
  });

  test.describe('补充场景：有图片筛选', () => {
    test('点击「有图片」筛选后，所有笔记都有图片', async ({ page }) => {
      await page.click('[data-testid="filter-image"]');

      await expect(page.locator('[data-testid="filter-image"]')).toHaveClass(/active|selected/);

      const memoCards = page.locator('[data-testid="memo-card"]');
      const count = await memoCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = memoCards.nth(i);
        await expect(card.locator('[data-testid="memo-image"]')).toBeVisible();
      }
    });
  });

  test.describe('边界场景', () => {
    test('未登录用户直接访问 /memo，跳转到登录页', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/memo');
      await page.waitForURL('/login');
      await expect(page.locator('text=请先登录')).toBeVisible();
    });

    test('未登录状态下调用 /api/memos，返回 401', async ({ request }) => {
      const response = await request.get('/api/memos');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });

    test('无任何笔记时，显示空状态提示', async ({ page }) => {
      test.skip();
    });

    test('筛选某个标签但该标签下无笔记，显示空状态', async ({ page }) => {
      test.skip();
    });
  });
});
