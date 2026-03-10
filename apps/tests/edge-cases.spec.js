import { test, expect } from '@playwright/test';

/**
 * 边界和特殊场景测试
 * 对应测试用例文档：§ 边界和特殊场景
 */

// 测试前登录
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', '12345678');
  await page.click('button:has-text("登录")');
  await page.waitForURL('/memo');
});

test.describe('边界和特殊场景 - UI 测试', () => {
  test('用户在弱网环境下创建笔记，显示加载状态', async ({ page, context }) => {
    // 模拟慢速网络
    await context.route('**/api/memos', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.continue();
    });

    // 输入笔记内容
    await page.fill('[data-testid="memo-input"]', '测试弱网环境');

    // 点击发送
    await page.click('button:has-text("发送")');

    // 验证发送按钮变为禁用状态或显示 Spinner
    await expect(
      page.locator('button:has-text("发送")[disabled]').or(page.locator('[data-testid="loading-spinner"]'))
    ).toBeVisible();
  });

  test('用户在离线状态下尝试创建笔记，显示网络错误提示', async ({ page, context }) => {
    // 模拟离线状态（拦截所有请求并失败）
    await context.setOffline(true);

    // 输入笔记内容
    await page.fill('[data-testid="memo-input"]', '测试离线状态');

    // 点击发送
    await page.click('button:has-text("发送")');

    // 验证错误提示
    await expect(page.locator('text=网络连接失败，请稍后重试')).toBeVisible();

    // 验证笔记内容保留在输入框
    await expect(page.locator('[data-testid="memo-input"]')).toHaveValue('测试离线状态');

    // 恢复在线状态
    await context.setOffline(false);
  });
});

test.describe('边界和特殊场景 - API 测试', () => {
  test('数据库异常时，返回 500 且不暴露内部错误', async () => {
    // 此测试需要模拟数据库故障，通常在集成测试环境中进行
    // 暂时跳过
    test.skip();
  });
});
