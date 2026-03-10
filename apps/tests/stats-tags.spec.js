import { test, expect } from '@playwright/test';

/**
 * 统计数据、热力图和标签管理测试
 * 对应测试用例文档：§ 统计数据与热力图、§ 标签管理
 */

// 测试前登录
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', '12345678');
  await page.click('button:has-text("登录")');
  await page.waitForURL('/memo');
});

test.describe('统计数据与热力图 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('用户在笔记主页查看统计信息，显示笔记总数、有标签数、使用天数', async ({ page }) => {
      // 验证统计区域显示
      await expect(page.locator('[data-testid="stats-bar"]')).toBeVisible();

      // 验证全部笔记数显示
      await expect(page.locator('[data-testid="total-memos"]')).toContainText(/全部笔记.*\d+.*条/);

      // 验证有标签数显示
      await expect(page.locator('[data-testid="tagged-memos"]')).toContainText(/有标签.*\d+.*条/);

      // 验证使用天数显示
      await expect(page.locator('[data-testid="usage-days"]')).toContainText(/已使用.*\d+.*天/);

      // 验证显示当前登录昵称
      await expect(page.locator('[data-testid="user-nickname"]')).toBeVisible();
    });

    test('用户查看热力图，看到每天的笔记数量分布', async ({ page }) => {
      // 验证热力图显示
      await expect(page.locator('[data-testid="heatmap"]')).toBeVisible();

      // 验证热力图有日期格子
      await expect(page.locator('[data-testid="heatmap-cell"]')).toHaveCount({ min: 1 });

      // 鼠标悬停某日期，验证工具提示
      const firstCell = page.locator('[data-testid="heatmap-cell"]').first();
      await firstCell.hover();

      // 验证工具提示显示（格式：{日期}: {N} 条笔记）
      await expect(page.locator('[data-testid="heatmap-tooltip"]')).toBeVisible();
    });
  });

  test.describe('异常场景', () => {
    test('用户首次注册当天，统计显示"已使用 1 天"', async ({ page }) => {
      // 需要新用户账号，暂时跳过
      test.skip();
    });

    test('用户无任何笔记时，统计数字均为 0', async ({ page }) => {
      // 需要清空笔记的账号，暂时跳过
      test.skip();
    });
  });
});

test.describe('统计数据 - API 测试', () => {
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
    test('获取统计数据，返回笔记总数、有标签数、使用天数', async () => {
      const response = await apiContext.get('/api/stats');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('totalMemos');
      expect(body.data).toHaveProperty('taggedMemos');
      expect(body.data).toHaveProperty('usageDays');
      expect(body.data).toHaveProperty('trashCount');
      expect(body.message).toBe('ok');

      // 验证数据类型
      expect(typeof body.data.totalMemos).toBe('number');
      expect(typeof body.data.taggedMemos).toBe('number');
      expect(typeof body.data.usageDays).toBe('number');
      expect(typeof body.data.trashCount).toBe('number');
    });

    test('获取热力图数据，返回最近 90 天每日笔记分布', async () => {
      const response = await apiContext.get('/api/stats');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('heatmap');
      expect(Array.isArray(body.data.heatmap)).toBeTruthy();

      // 验证热力图数据格式
      if (body.data.heatmap.length > 0) {
        const firstDay = body.data.heatmap[0];
        expect(firstDay).toHaveProperty('day');
        expect(firstDay).toHaveProperty('count');
        expect(typeof firstDay.count).toBe('number');
      }
    });
  });

  test.describe('异常场景', () => {
    test('未登录用户访问统计接口，返回 401', async ({ request }) => {
      const response = await request.get('/api/stats');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });
  });
});

test.describe('标签管理 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('用户在左侧标签树看到所有标签及笔记数量', async ({ page }) => {
      await page.goto('/memo');

      // 验证标签树显示
      await expect(page.locator('[data-testid="tag-list"]')).toBeVisible();

      // 验证标签项显示名称和数量
      const tagItems = page.locator('[data-testid="tag-item"]');
      const count = await tagItems.count();

      if (count > 0) {
        const firstTag = tagItems.first();
        await expect(firstTag).toContainText(/\w+.*\(\d+\)/);
      }
    });

    test('用户创建带新标签的笔记，标签树实时更新', async ({ page }) => {
      const newTag = `新标签${Date.now()}`;
      const content = `测试 #${newTag} 内容`;

      // 创建笔记
      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      // 等待创建成功
      await page.waitForTimeout(500);

      // 验证标签树新增标签
      await expect(page.locator(`[data-testid="tag-list"] >> text=${newTag}`)).toBeVisible();

      // 验证笔记卡片显示标签高亮
      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator(`[data-testid="tag"]:has-text("${newTag}")`)).toBeVisible();
    });
  });

  test.describe('异常场景', () => {
    test('用户无任何标签时，标签树显示空状态', async ({ page }) => {
      // 需要无标签的账号，暂时跳过
      test.skip();
    });
  });
});

test.describe('标签管理 - API 测试', () => {
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
    test('获取标签列表（含笔记计数），返回所有标签', async () => {
      const response = await apiContext.get('/api/tags');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.message).toBe('ok');

      // 验证标签数据格式
      if (body.data.length > 0) {
        const firstTag = body.data[0];
        expect(firstTag).toHaveProperty('id');
        expect(firstTag).toHaveProperty('name');
        expect(firstTag).toHaveProperty('count');
        expect(typeof firstTag.count).toBe('number');
      }
    });
  });

  test.describe('异常场景', () => {
    test('未登录用户获取标签列表，返回 401', async ({ request }) => {
      const response = await request.get('/api/tags');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });
  });
});
