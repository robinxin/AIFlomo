import { test, expect } from '@playwright/test';

/**
 * 用户故事 5 E2E 测试：查看笔记热力图和统计
 *
 * 验收场景：
 * 1. 用户在 30 天内创建了笔记，查看热力图时看到每天的笔记数量分布
 * 2. 用户连续使用了 N 天，查看统计信息时显示「已使用 N 天」
 * 3. 用户有若干条笔记，其中一些有标签，查看统计显示「全部笔记 X 条」「有标签 Y 条」
 */

test.describe('用户故事 5：查看笔记热力图和统计', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
    await page.click('button:has-text("登录")');
    await page.waitForURL('/memo');
  });

  test.describe('验收场景 1：查看热力图，看到每天的笔记数量分布', () => {
    test('笔记主页热力图组件可见，且包含日期格子', async ({ page }) => {
      await expect(page.locator('[data-testid="heatmap"]')).toBeVisible();
      const cells = page.locator('[data-testid="heatmap-cell"]');
      const count = await cells.count();
      expect(count).toBeGreaterThan(0);
    });

    test('热力图日期格子数量不超过 90 个（最近 90 天）', async ({ page }) => {
      await expect(page.locator('[data-testid="heatmap"]')).toBeVisible();
      const cells = page.locator('[data-testid="heatmap-cell"]');
      const count = await cells.count();
      expect(count).toBeLessThanOrEqual(90);
    });

    test('鼠标悬停热力图格子时，显示工具提示（日期和笔记数量）', async ({ page }) => {
      await expect(page.locator('[data-testid="heatmap"]')).toBeVisible();

      const cells = page.locator('[data-testid="heatmap-cell"]');
      const count = await cells.count();

      if (count === 0) {
        test.skip();
        return;
      }

      const firstCell = cells.first();
      await firstCell.hover();

      await expect(page.locator('[data-testid="heatmap-tooltip"]')).toBeVisible();
    });

    test('创建笔记后，热力图数据通过 API 返回当天的笔记计数', async ({ page }) => {
      const content = `热力图计数验证 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const statsResponse = await page.request.get('/api/stats');
      expect(statsResponse.status()).toBe(200);

      const body = await statsResponse.json();
      expect(Array.isArray(body.data.heatmap)).toBeTruthy();

      const today = new Date().toISOString().slice(0, 10);
      const todayData = body.data.heatmap.find(item => item.day === today);

      if (todayData) {
        expect(todayData.count).toBeGreaterThan(0);
      }

      await page.request.delete(`/api/memos/${createdMemo.id}`).catch(() => {});
    });

    test('GET /api/stats 返回 heatmap 数组，每条记录包含 day 和 count 字段', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('heatmap');
      expect(Array.isArray(body.data.heatmap)).toBeTruthy();

      if (body.data.heatmap.length > 0) {
        const firstDay = body.data.heatmap[0];
        expect(firstDay).toHaveProperty('day');
        expect(firstDay).toHaveProperty('count');
        expect(typeof firstDay.day).toBe('string');
        expect(typeof firstDay.count).toBe('number');
        expect(firstDay.count).toBeGreaterThan(0);
      }
    });

    test('热力图数据仅包含最近 90 天内的记录（day 字段不早于 90 天前）', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const heatmap = body.data.heatmap;

      if (heatmap.length === 0) {
        return;
      }

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoffDate = ninetyDaysAgo.toISOString().slice(0, 10);

      for (const item of heatmap) {
        expect(item.day >= cutoffDate).toBeTruthy();
      }
    });

    test('热力图页面在 2 秒内完整渲染（SC-005）', async ({ page }) => {
      const startTime = Date.now();

      await expect(page.locator('[data-testid="heatmap"]')).toBeVisible();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  test.describe('验收场景 2：查看统计信息，显示「已使用 N 天」', () => {
    test('笔记主页统计栏可见，且显示使用天数', async ({ page }) => {
      await expect(page.locator('[data-testid="stats-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="usage-days"]')).toBeVisible();
      await expect(page.locator('[data-testid="usage-days"]')).toContainText(/已使用.*\d+.*天/);
    });

    test('GET /api/stats 返回 usageDays 字段，值为正整数', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('usageDays');
      expect(typeof body.data.usageDays).toBe('number');
      expect(body.data.usageDays).toBeGreaterThanOrEqual(1);
    });

    test('统计信息中的使用天数与 API 返回值一致', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const usageDays = body.data.usageDays;

      await expect(page.locator('[data-testid="usage-days"]')).toContainText(String(usageDays));
    });

    test('统计栏显示当前登录用户的昵称', async ({ page }) => {
      await expect(page.locator('[data-testid="user-nickname"]')).toBeVisible();

      const meResponse = await page.request.get('/api/auth/me');
      expect(meResponse.status()).toBe(200);

      const meBody = await meResponse.json();
      const nickname = meBody.data.nickname;

      if (nickname) {
        await expect(page.locator('[data-testid="user-nickname"]')).toContainText(nickname);
      }
    });
  });

  test.describe('验收场景 3：查看统计，显示「全部笔记 X 条」「有标签 Y 条」', () => {
    test('统计栏显示全部笔记数量', async ({ page }) => {
      await expect(page.locator('[data-testid="stats-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-memos"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-memos"]')).toContainText(/全部笔记.*\d+.*条/);
    });

    test('统计栏显示有标签笔记数量', async ({ page }) => {
      await expect(page.locator('[data-testid="stats-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="tagged-memos"]')).toBeVisible();
      await expect(page.locator('[data-testid="tagged-memos"]')).toContainText(/有标签.*\d+.*条/);
    });

    test('GET /api/stats 返回 totalMemos 和 taggedMemos 字段', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.message).toBe('ok');
      expect(body.data).toHaveProperty('totalMemos');
      expect(body.data).toHaveProperty('taggedMemos');
      expect(typeof body.data.totalMemos).toBe('number');
      expect(typeof body.data.taggedMemos).toBe('number');
    });

    test('taggedMemos 不超过 totalMemos', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.taggedMemos).toBeLessThanOrEqual(body.data.totalMemos);
    });

    test('创建一条有标签笔记后，totalMemos 和 taggedMemos 各增加 1', async ({ page }) => {
      const statsBefore = await page.request.get('/api/stats');
      const bodyBefore = await statsBefore.json();
      const totalBefore = bodyBefore.data.totalMemos;
      const taggedBefore = bodyBefore.data.taggedMemos;

      const tagName = `统计标签${Date.now()}`;
      const createResponse = await page.request.post('/api/memos', {
        data: { content: `验证统计增量 #${tagName}` }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const statsAfter = await page.request.get('/api/stats');
      const bodyAfter = await statsAfter.json();

      expect(bodyAfter.data.totalMemos).toBe(totalBefore + 1);
      expect(bodyAfter.data.taggedMemos).toBe(taggedBefore + 1);

      await page.request.delete(`/api/memos/${createdMemo.id}/permanent`).catch(() => {});
    });

    test('创建一条无标签笔记后，totalMemos 增加 1，taggedMemos 不变', async ({ page }) => {
      const statsBefore = await page.request.get('/api/stats');
      const bodyBefore = await statsBefore.json();
      const totalBefore = bodyBefore.data.totalMemos;
      const taggedBefore = bodyBefore.data.taggedMemos;

      const createResponse = await page.request.post('/api/memos', {
        data: { content: `无标签统计验证 ${Date.now()}` }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const statsAfter = await page.request.get('/api/stats');
      const bodyAfter = await statsAfter.json();

      expect(bodyAfter.data.totalMemos).toBe(totalBefore + 1);
      expect(bodyAfter.data.taggedMemos).toBe(taggedBefore);

      await page.request.delete(`/api/memos/${createdMemo.id}/permanent`).catch(() => {});
    });

    test('统计页面显示的数字与 API 返回数据一致', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const { totalMemos, taggedMemos } = body.data;

      await expect(page.locator('[data-testid="total-memos"]')).toContainText(String(totalMemos));
      await expect(page.locator('[data-testid="tagged-memos"]')).toContainText(String(taggedMemos));
    });

    test('软删除笔记后，totalMemos 减少 1', async ({ page }) => {
      const createResponse = await page.request.post('/api/memos', {
        data: { content: `软删除统计测试 ${Date.now()}` }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const statsBefore = await page.request.get('/api/stats');
      const bodyBefore = await statsBefore.json();
      const totalBefore = bodyBefore.data.totalMemos;

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      const statsAfter = await page.request.get('/api/stats');
      const bodyAfter = await statsAfter.json();

      expect(bodyAfter.data.totalMemos).toBe(totalBefore - 1);

      await page.request.delete(`/api/memos/${createdMemo.id}/permanent`).catch(() => {});
    });
  });

  test.describe('补充场景：统计数据完整性', () => {
    test('GET /api/stats 返回完整数据结构（totalMemos、taggedMemos、usageDays、trashCount、heatmap）', async ({ page }) => {
      const response = await page.request.get('/api/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('totalMemos');
      expect(body.data).toHaveProperty('taggedMemos');
      expect(body.data).toHaveProperty('usageDays');
      expect(body.data).toHaveProperty('trashCount');
      expect(body.data).toHaveProperty('heatmap');
    });

    test('统计中的 trashCount 等于回收站中的笔记数量', async ({ page }) => {
      const statsResponse = await page.request.get('/api/stats');
      const statsBody = await statsResponse.json();
      const trashCount = statsBody.data.trashCount;

      const trashResponse = await page.request.get('/api/memos/trash');
      const trashBody = await trashResponse.json();
      const actualTrashCount = trashBody.data.length;

      expect(trashCount).toBe(actualTrashCount);
    });

    test('笔记进入回收站后，trashCount 增加 1', async ({ page }) => {
      const statsBefore = await page.request.get('/api/stats');
      const bodyBefore = await statsBefore.json();
      const trashCountBefore = bodyBefore.data.trashCount;

      const createResponse = await page.request.post('/api/memos', {
        data: { content: `回收站计数验证 ${Date.now()}` }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      const statsAfter = await page.request.get('/api/stats');
      const bodyAfter = await statsAfter.json();

      expect(bodyAfter.data.trashCount).toBe(trashCountBefore + 1);

      await page.request.delete(`/api/memos/${createdMemo.id}/permanent`).catch(() => {});
    });

    test('统计数字在笔记页面加载时自动刷新（页面上数值不为空）', async ({ page }) => {
      await expect(page.locator('[data-testid="stats-bar"]')).toBeVisible();

      const totalText = await page.locator('[data-testid="total-memos"]').textContent();
      const taggedText = await page.locator('[data-testid="tagged-memos"]').textContent();
      const usageText = await page.locator('[data-testid="usage-days"]').textContent();

      expect(totalText).toBeTruthy();
      expect(taggedText).toBeTruthy();
      expect(usageText).toBeTruthy();
    });
  });

  test.describe('认证保护', () => {
    test('未登录用户直接访问 /memo，跳转到登录页', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/memo');
      await page.waitForURL('/login');
      await expect(page.locator('text=请先登录')).toBeVisible();
    });

    test('未登录状态下调用 GET /api/stats，返回 401', async ({ request }) => {
      const response = await request.get('/api/stats');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });
  });
});
