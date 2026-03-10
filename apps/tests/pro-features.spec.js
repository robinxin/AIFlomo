import { test, expect } from '@playwright/test';

/**
 * Pro 功能引导测试
 * 对应测试用例文档：§ Pro 功能引导
 */

// 测试前登录
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', '12345678');
  await page.click('button:has-text("登录")');
  await page.waitForURL('/memo');
});

test.describe('Pro 功能引导 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('用户点击"微信输入"入口，弹出 Pro 购买浮窗', async ({ page }) => {
      // 点击微信输入入口（假设在顶部工具栏）
      await page.click('[data-testid="wechat-input-btn"]');

      // 验证 Pro 浮窗弹出
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      // 验证浮窗标题
      await expect(page.locator('[data-testid="pro-upgrade-modal"] >> text=购买 Pro 会员')).toBeVisible();

      // 验证功能介绍存在
      await expect(page.locator('[data-testid="pro-features"]')).toBeVisible();

      // 验证"立即购买"按钮
      await expect(page.locator('button:has-text("立即购买")')).toBeVisible();

      // 验证"关闭"按钮
      await expect(page.locator('[data-testid="close-modal-btn"]')).toBeVisible();
    });

    test('用户在 Pro 浮窗点击"关闭"，浮窗消失', async ({ page }) => {
      // 打开 Pro 浮窗
      await page.click('[data-testid="wechat-input-btn"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      // 点击关闭按钮
      await page.click('[data-testid="close-modal-btn"]');

      // 验证浮窗消失
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).not.toBeVisible();

      // 验证返回笔记主页
      await expect(page).toHaveURL('/memo');
    });

    test('用户在 Pro 浮窗点击"立即购买"，跳转占位页', async ({ page }) => {
      // 打开 Pro 浮窗
      await page.click('[data-testid="wechat-input-btn"]');

      // 点击"立即购买"
      await page.click('button:has-text("立即购买")');

      // 验证跳转到占位页或显示"功能开发中"提示
      await expect(
        page.locator('text=功能开发中').or(page.locator('[data-testid="pro-placeholder"]'))
      ).toBeVisible();
    });
  });
});
