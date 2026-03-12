// 测试用例：删除笔记
// 对应文档：specs/active/45-create-memo-and-memo-list-1-testcases.md

import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('删除笔记 - UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('删除笔记后，笔记从列表中移除', async ({ page }) => {
    // 前置条件：用户已登录，有笔记"测试删除"（id: "memo-uuid-1"）
    // TODO: 创建测试笔记

    // 1. 在笔记卡片上长按或点击删除图标（如果前端实现了删除按钮）
    const memoCard = page.locator('[data-testid="memo-card"]', { hasText: '测试删除' });
    await expect(memoCard).toBeVisible();

    // 方案1: 长按触发删除菜单
    await memoCard.press('Enter', { delay: 1000 }); // 模拟长按

    // 或方案2: 点击删除按钮
    const deleteBtn = memoCard.locator('[data-testid="memo-delete-btn"]');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    }

    // 2. 确认删除操作
    const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    if (await confirmDialog.isVisible()) {
      const confirmBtn = confirmDialog.locator('[data-testid="confirm-btn"]');
      await confirmBtn.click();
    }

    // 预期结果：笔记"测试删除"从列表中消失
    await expect(memoCard).not.toBeVisible();

    // 预期结果：显示成功提示："删除成功"
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toContainText('删除成功');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('删除笔记 - API 测试', () => {
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

  test('删除自己的笔记，返回 204', async () => {
    // 前置条件：用户已登录（user A），有笔记（id: "memo-uuid-1"，属于 user A）
    // TODO: 创建测试笔记并获取 ID

    const memoId = 'memo-uuid-1'; // 示例 ID

    const response = await apiContext.delete(`/api/memos/${memoId}`);

    // 预期结果：接口返回 204
    expect(response.status()).toBe(204);

    // 预期结果：无响应体
    const body = await response.text();
    expect(body).toBe('');

    // TODO: 验证数据库 memos 表中该记录被删除
    // TODO: 验证 memo_tags 和 memo_images 表中关联记录也被级联删除
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('删除笔记 - API 异常场景', () => {
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

  test('未登录删除笔记，返回 401', async () => {
    const memoId = 'memo-uuid-1';

    const response = await apiContext.delete(`/api/memos/${memoId}`);

    // 预期结果：接口返回 401
    expect(response.status()).toBe(401);

    const body = await response.json();

    // 预期结果：响应体包含错误信息
    expect(body).toMatchObject({
      data: null,
      error: 'Unauthorized',
      message: expect.stringContaining('请先登录'),
    });
  });

  test('删除不存在的笔记，返回 404', async () => {
    const response = await apiContext.delete('/api/memos/non-existent-id');

    // 预期结果：接口返回 404
    expect(response.status()).toBe(404);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toMatchObject({
      data: null,
      error: 'NOT_FOUND',
      message: expect.stringContaining('Memo not found'),
    });
  });

  test('删除其他用户的笔记，返回 403', async () => {
    // 前置条件：用户已登录（user A），尝试删除 user B 的笔记
    // TODO: 创建属于其他用户的笔记

    const otherUserMemoId = 'user-b-memo-id';

    const response = await apiContext.delete(`/api/memos/${otherUserMemoId}`);

    // 预期结果：接口返回 403
    expect(response.status()).toBe(403);

    const body = await response.json();

    // 预期结果：响应体格式正确
    expect(body).toMatchObject({
      data: null,
      error: 'FORBIDDEN',
      message: expect.stringContaining('Forbidden'),
    });
  });
});
