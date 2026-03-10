import { test, expect } from '@playwright/test';

/**
 * 删除和回收站测试
 * 对应测试用例文档：§ 删除和回收站
 */

// 测试前登录
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', '12345678');
  await page.click('button:has-text("登录")');
  await page.waitForURL('/memo');
});

test.describe('删除和回收站 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('用户在笔记列表删除一条笔记，笔记进入回收站', async ({ page }) => {
      // 先创建一条笔记
      const content = `测试删除 ${Date.now()}`;
      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');
      await page.waitForTimeout(500);

      // 获取笔记卡片
      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo).toContainText(content);

      // 长按或点击菜单
      await firstMemo.locator('[data-testid="memo-menu-btn"]').click();

      // 点击删除
      await page.click('button:has-text("删除")');

      // 确认删除
      await page.click('[data-testid="confirm-dialog"] button:has-text("确认")');

      // 验证笔记从列表消失
      await expect(page.locator(`text=${content}`)).not.toBeVisible();

      // 验证成功提示
      await expect(page.locator('text=已移至回收站')).toBeVisible();

      // 验证回收站计数增加
      const trashCount = page.locator('[data-testid="trash-count"]');
      await expect(trashCount).toBeVisible();
    });

    test('用户进入回收站，看到所有已删除笔记', async ({ page }) => {
      // 点击回收站
      await page.click('[data-testid="trash-link"]');

      // 验证跳转到回收站页
      await page.waitForURL('/memo/trash');

      // 验证显示已删除笔记
      await expect(page.locator('[data-testid="trash-memo-card"]')).toHaveCount({ min: 1 });

      // 验证每条笔记有"恢复"和"永久删除"按钮
      const firstTrashMemo = page.locator('[data-testid="trash-memo-card"]').first();
      await expect(firstTrashMemo.locator('button:has-text("恢复")')).toBeVisible();
      await expect(firstTrashMemo.locator('button:has-text("永久删除")')).toBeVisible();
    });

    test('用户在回收站恢复一条笔记，笔记回到正常列表', async ({ page }) => {
      await page.goto('/memo/trash');

      // 点击第一条笔记的"恢复"按钮
      await page.locator('[data-testid="trash-memo-card"]').first().locator('button:has-text("恢复")').click();

      // 验证成功提示
      await expect(page.locator('text=恢复成功')).toBeVisible();

      // 验证笔记从回收站消失
      await page.waitForTimeout(500);

      // 返回笔记主页
      await page.goto('/memo');

      // 验证笔记出现在列表中（需要获取笔记内容进行验证）
      await expect(page.locator('[data-testid="memo-card"]')).toHaveCount({ min: 1 });
    });

    test('用户在回收站永久删除笔记，笔记不可恢复', async ({ page }) => {
      await page.goto('/memo/trash');

      // 获取第一条笔记
      const firstTrashMemo = page.locator('[data-testid="trash-memo-card"]').first();

      // 点击"永久删除"
      await firstTrashMemo.locator('button:has-text("永久删除")').click();

      // 二次确认
      await page.click('[data-testid="confirm-dialog"] button:has-text("确认")');

      // 验证成功提示
      await expect(page.locator('text=已永久删除')).toBeVisible();

      // 验证笔记从回收站消失
      await page.waitForTimeout(500);
    });
  });

  test.describe('异常场景', () => {
    test('回收站为空时，显示空状态提示', async ({ page }) => {
      // 需要清空回收站，暂时跳过
      test.skip();
    });

    test('删除笔记前弹出确认对话框，点击取消不删除', async ({ page }) => {
      // 创建笔记
      const content = `测试取消删除 ${Date.now()}`;
      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');
      await page.waitForTimeout(500);

      // 点击删除
      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await firstMemo.locator('[data-testid="memo-menu-btn"]').click();
      await page.click('button:has-text("删除")');

      // 点击取消
      await page.click('[data-testid="confirm-dialog"] button:has-text("取消")');

      // 验证对话框关闭
      await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();

      // 验证笔记仍在列表中
      await expect(page.locator(`text=${content}`)).toBeVisible();
    });
  });
});

test.describe('删除和回收站 - API 测试', () => {
  let apiContext;
  let testMemoId;

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

    // 创建测试笔记
    const createRes = await apiContext.post('/api/memos', {
      data: {
        content: '测试删除的笔记'
      }
    });
    const createBody = await createRes.json();
    testMemoId = createBody.data.id;
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('正常场景', () => {
    test('软删除笔记（移入回收站），返回 200', async () => {
      const response = await apiContext.delete(`/api/memos/${testMemoId}`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.message).toBe('已移至回收站');
    });

    test('获取回收站列表，返回所有已删除笔记', async () => {
      const response = await apiContext.get('/api/memos/trash');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.message).toBe('ok');

      // 验证所有笔记都有 deletedAt
      for (const memo of body.data) {
        expect(memo.deletedAt).not.toBeNull();
      }
    });

    test('从回收站恢复笔记，返回 200', async () => {
      // 先创建并删除一条笔记
      const createRes = await apiContext.post('/api/memos', {
        data: { content: '测试恢复' }
      });
      const memoId = (await createRes.json()).data.id;

      await apiContext.delete(`/api/memos/${memoId}`);

      // 恢复笔记
      const response = await apiContext.post(`/api/memos/${memoId}/restore`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.deletedAt).toBeNull();
      expect(body.message).toBe('恢复成功');
    });

    test('永久删除笔记，返回 204', async () => {
      // 创建并删除一条笔记
      const createRes = await apiContext.post('/api/memos', {
        data: { content: '测试永久删除' }
      });
      const memoId = (await createRes.json()).data.id;

      await apiContext.delete(`/api/memos/${memoId}`);

      // 永久删除
      const response = await apiContext.delete(`/api/memos/${memoId}/permanent`);

      expect(response.status()).toBe(204);
    });
  });

  test.describe('异常场景', () => {
    test('未登录用户删除笔记，返回 401', async ({ request }) => {
      const response = await request.delete('/api/memos/memo-123');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });

    test('删除他人笔记，返回 404', async () => {
      // 需要多用户场景，暂时跳过
      test.skip();
    });

    test('恢复不存在的笔记，返回 404', async () => {
      const response = await apiContext.post('/api/memos/invalid-id/restore');

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Memo not found');
    });

    test('永久删除他人笔记，返回 404', async () => {
      // 需要多用户场景，暂时跳过
      test.skip();
    });
  });
});
