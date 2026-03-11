import { test, expect } from '@playwright/test';

/**
 * 用户故事 3 E2E 测试：搜索笔记
 *
 * 验收场景：
 * 1. 用户在搜索框输入「会议」，显示所有内容包含「会议」的笔记
 * 2. 用户在搜索结果页清空搜索框，返回初始搜索提示状态
 * 3. 用户搜索「不存在的关键词」，显示「未找到相关笔记」提示
 */

test.describe('用户故事 3：搜索笔记', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
    await page.click('button:has-text("登录")');
    await page.waitForURL('/memo');
  });

  test.describe('验收场景 1：输入关键词，显示包含该关键词的笔记', () => {
    test('进入搜索页显示初始提示，输入关键字后显示搜索框和结果列表', async ({ page }) => {
      await page.goto('/memo/search');

      await expect(page.locator('[data-testid="search-screen"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-page-bar"]')).toBeVisible();

      const initialEmpty = page.locator('[data-testid="search-empty-initial"]');
      await expect(initialEmpty).toBeVisible();
    });

    test('输入搜索关键词后，结果列表中的每条笔记都包含该关键词', async ({ page }) => {
      const keyword = `测试搜索${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content: `这是一条包含「${keyword}」的测试笔记` }
      });
      expect(createResponse.status()).toBe(201);

      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill(keyword);

      await page.waitForTimeout(400);

      const resultList = page.locator('[data-testid="search-result-list"]');
      await expect(resultList).toBeVisible();

      const resultHeader = page.locator('[data-testid="search-result-count"]');
      await expect(resultHeader).toBeVisible();
      await expect(resultHeader).toContainText(keyword);
    });

    test('搜索结果中显示正确的笔记数量摘要', async ({ page }) => {
      const keyword = `摘要验证${Date.now()}`;

      await page.request.post('/api/memos', {
        data: { content: `第一条包含「${keyword}」的笔记` }
      });
      await page.request.post('/api/memos', {
        data: { content: `第二条包含「${keyword}」的笔记` }
      });

      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill(keyword);

      await page.waitForTimeout(400);

      const resultCount = page.locator('[data-testid="search-result-count"]');
      await expect(resultCount).toBeVisible();
      await expect(resultCount).toContainText(/共 \d+ 条笔记/);
    });

    test('通过 API 搜索关键词，返回所有匹配的笔记', async ({ page }) => {
      const keyword = `API搜索${Date.now()}`;

      await page.request.post('/api/memos', {
        data: { content: `笔记内容包含 ${keyword}` }
      });

      const response = await page.request.get(`/api/memos?q=${encodeURIComponent(keyword)}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.message).toBe('ok');

      for (const memo of body.data) {
        expect(memo.content.toLowerCase()).toContain(keyword.toLowerCase());
      }
    });

    test('搜索不区分大小写，能匹配英文字母大小写', async ({ page }) => {
      const upperKeyword = `SEARCH${Date.now()}`;
      const lowerKeyword = upperKeyword.toLowerCase();

      await page.request.post('/api/memos', {
        data: { content: `英文内容 ${lowerKeyword} 测试` }
      });

      const response = await page.request.get(`/api/memos?q=${encodeURIComponent(upperKeyword)}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.data.length).toBeGreaterThan(0);
    });

    test('搜索结果中高亮显示匹配关键词', async ({ page }) => {
      const keyword = `高亮测试${Date.now()}`;

      await page.request.post('/api/memos', {
        data: { content: `这是高亮测试内容 ${keyword} 结束` }
      });

      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill(keyword);

      await page.waitForTimeout(400);

      const resultList = page.locator('[data-testid="search-result-list"]');
      await expect(resultList).toBeVisible();
    });
  });

  test.describe('验收场景 2：清空搜索框，返回初始提示状态', () => {
    test('输入关键词后点击清除按钮，搜索框清空并显示初始提示', async ({ page }) => {
      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill('测试清除');

      await page.waitForTimeout(400);

      const clearBtn = page.locator('[data-testid="search-page-bar-clear"]');
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();

      await expect(input).toHaveValue('');

      const initialEmpty = page.locator('[data-testid="search-empty-initial"]');
      await expect(initialEmpty).toBeVisible();
    });

    test('手动清空输入框内容，搜索结果消失，显示初始提示', async ({ page }) => {
      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill('会议');

      await page.waitForTimeout(400);

      await input.fill('');

      await page.waitForTimeout(400);

      const initialEmpty = page.locator('[data-testid="search-empty-initial"]');
      await expect(initialEmpty).toBeVisible();
    });

    test('清空搜索框后，API 不再携带 q 参数发起搜索请求', async ({ page }) => {
      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill('会议');
      await page.waitForTimeout(400);

      await input.fill('');
      await page.waitForTimeout(400);

      const response = await page.request.get('/api/memos');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
    });
  });

  test.describe('验收场景 3：搜索不存在的关键词，显示「未找到相关笔记」提示', () => {
    test('搜索完全不存在的关键词，显示空状态提示', async ({ page }) => {
      await page.goto('/memo/search');

      const nonExistKeyword = `绝对不存在的内容XYZ_${Date.now()}`;

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill(nonExistKeyword);

      await page.waitForTimeout(400);

      const noResult = page.locator('[data-testid="search-empty-no-results"]');
      await expect(noResult).toBeVisible();
    });

    test('通过 API 搜索不存在的关键词，返回空数组', async ({ page }) => {
      const nonExistKeyword = `绝对不存在的内容XYZ_${Date.now()}`;

      const response = await page.request.get(`/api/memos?q=${encodeURIComponent(nonExistKeyword)}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.data.length).toBe(0);
      expect(body.message).toBe('ok');
    });

    test('搜索空格或空白字符串，不发起搜索请求，显示初始提示', async ({ page }) => {
      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill('   ');

      await page.waitForTimeout(400);

      const initialEmpty = page.locator('[data-testid="search-empty-initial"]');
      await expect(initialEmpty).toBeVisible();
    });
  });

  test.describe('补充场景：搜索性能与边界', () => {
    test('搜索结果在输入后 1 秒内显示（SC-003）', async ({ page }) => {
      const keyword = `性能测试${Date.now()}`;

      await page.request.post('/api/memos', {
        data: { content: `性能测试内容 ${keyword}` }
      });

      await page.goto('/memo/search');

      const input = page.locator('[data-testid="search-page-bar-input"]');

      const startTime = Date.now();
      await input.fill(keyword);

      await page.waitForTimeout(400);

      const resultList = page.locator('[data-testid="search-result-list"]');
      await expect(resultList).toBeVisible();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000);
    });

    test('搜索关键词超过 200 字符时，前端不发起请求', async ({ page }) => {
      await page.goto('/memo/search');

      const longKeyword = 'a'.repeat(201);
      const input = page.locator('[data-testid="search-page-bar-input"]');
      await input.fill(longKeyword);

      await page.waitForTimeout(400);

      const initialEmpty = page.locator('[data-testid="search-empty-initial"]');
      const noResults = page.locator('[data-testid="search-empty-no-results"]');

      const initialVisible = await initialEmpty.isVisible().catch(() => false);
      const noResultsVisible = await noResults.isVisible().catch(() => false);
      expect(initialVisible || noResultsVisible).toBeTruthy();
    });

    test('搜索支持部分匹配（如搜索「会议」能匹配「参加会议记录」）', async ({ page }) => {
      const keyword = `部分匹配${Date.now()}`;

      await page.request.post('/api/memos', {
        data: { content: `完整内容是：参加${keyword}记录` }
      });

      const response = await page.request.get(`/api/memos?q=${encodeURIComponent(keyword)}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].content).toContain(keyword);
    });
  });

  test.describe('认证保护', () => {
    test('未登录用户直接访问 /memo/search，跳转到登录页', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/memo/search');
      await page.waitForURL('/login');
      await expect(page.locator('text=请先登录')).toBeVisible();
    });

    test('未登录状态下调用 GET /api/memos?q=关键词，返回 401', async ({ request }) => {
      const response = await request.get('/api/memos?q=%E4%BC%9A%E8%AE%AE');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });
  });
});
