import { test, expect } from '@playwright/test';

/**
 * 用户故事 6 E2E 测试：Pro 功能引导
 *
 * 验收场景：
 * 1. 用户未购买 Pro 会员，点击「微信输入」入口，弹出「购买 Pro 会员」浮窗
 * 2. 用户看到 Pro 会员浮窗，点击关闭按钮，浮窗消失，返回笔记页面
 * 3. 用户在浮窗中点击「立即购买」按钮，跳转到会员购买页面
 */

test.describe('用户故事 6：Pro 功能引导', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
    await page.click('button:has-text("登录")');
    await page.waitForURL('/memo');
  });

  test.describe('验收场景 1：点击「微信输入」入口，弹出「购买 Pro 会员」浮窗', () => {
    test('点击「微信输入」按钮后，Pro 升级浮窗弹出', async ({ page }) => {
      await expect(page.locator('[data-testid="pro-entry-bar"]')).toBeVisible();

      await page.click('[data-testid="pro-entry-wechat"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();
    });

    test('Pro 浮窗显示正确的功能名称「微信输入」', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-upgrade-modal-title"]')).toContainText('微信输入');
    });

    test('Pro 浮窗包含「立即购买」和「暂不购买」按钮', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal-buy-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-upgrade-modal-cancel-btn"]')).toBeVisible();
    });

    test('Pro 浮窗显示功能列表（微信输入、每日回顾、AI 洞察、随机漫步）', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal-features"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-upgrade-modal-features"]')).toContainText('微信输入');
      await expect(page.locator('[data-testid="pro-upgrade-modal-features"]')).toContainText('每日回顾');
      await expect(page.locator('[data-testid="pro-upgrade-modal-features"]')).toContainText('AI 洞察');
      await expect(page.locator('[data-testid="pro-upgrade-modal-features"]')).toContainText('随机漫步');
    });

    test('浮窗立即弹出，无明显延迟（SC-007）', async ({ page }) => {
      const startTime = Date.now();

      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  test.describe('验收场景 2：点击关闭按钮，浮窗消失，返回笔记页面', () => {
    test('点击「暂不购买」关闭浮窗后，浮窗不再可见', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      await page.click('[data-testid="pro-upgrade-modal-cancel-btn"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).not.toBeVisible();
    });

    test('关闭浮窗后，仍停留在笔记页面（/memo）', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      await page.click('[data-testid="pro-upgrade-modal-cancel-btn"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).not.toBeVisible();
      expect(page.url()).toContain('/memo');
    });

    test('关闭浮窗后，笔记页面主体内容仍正常显示', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      await page.click('[data-testid="pro-upgrade-modal-cancel-btn"]');

      await expect(page.locator('[data-testid="memo-index-screen"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-entry-bar"]')).toBeVisible();
    });

    test('点击浮窗遮罩层关闭浮窗后，返回笔记页面', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      await page.click('[data-testid="pro-upgrade-modal-overlay"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).not.toBeVisible();
      expect(page.url()).toContain('/memo');
    });
  });

  test.describe('验收场景 3：点击「立即购买」按钮，跳转到会员购买页面', () => {
    test('点击「立即购买」后，跳转到 Pro 购买页面', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      await page.click('[data-testid="pro-upgrade-modal-buy-btn"]');

      await expect(page.locator('[data-testid="pro-purchase-screen"]')).toBeVisible();
    });

    test('购买页面显示「Pro 会员购买」标题', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      await page.click('[data-testid="pro-upgrade-modal-buy-btn"]');

      await expect(page.locator('[data-testid="pro-purchase-heading"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-purchase-heading"]')).toContainText('Pro 会员购买');
    });

    test('购买页面有「返回笔记页」按钮，点击后回到笔记页', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await page.click('[data-testid="pro-upgrade-modal-buy-btn"]');

      await expect(page.locator('[data-testid="pro-purchase-screen"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-purchase-back-to-memo-btn"]')).toBeVisible();

      await page.click('[data-testid="pro-purchase-back-to-memo-btn"]');

      await expect(page.locator('[data-testid="memo-index-screen"]')).toBeVisible();
    });

    test('点击「立即购买」后，浮窗自动关闭', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();

      await page.click('[data-testid="pro-upgrade-modal-buy-btn"]');

      await expect(page.locator('[data-testid="pro-purchase-screen"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).not.toBeVisible();
    });
  });

  test.describe('补充场景：其他 Pro 功能入口', () => {
    test('点击「每日回顾」入口，弹出 Pro 浮窗并显示功能名称', async ({ page }) => {
      await page.click('[data-testid="pro-entry-daily"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-upgrade-modal-title"]')).toContainText('每日回顾');
    });

    test('点击「AI 洞察」入口，弹出 Pro 浮窗并显示功能名称', async ({ page }) => {
      await page.click('[data-testid="pro-entry-ai"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-upgrade-modal-title"]')).toContainText('AI 洞察');
    });

    test('点击「随机漫步」入口，弹出 Pro 浮窗并显示功能名称', async ({ page }) => {
      await page.click('[data-testid="pro-entry-random"]');

      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-upgrade-modal-title"]')).toContainText('随机漫步');
    });

    test('Pro 功能入口栏包含全部四个入口按钮', async ({ page }) => {
      await expect(page.locator('[data-testid="pro-entry-wechat"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-entry-daily"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-entry-ai"]')).toBeVisible();
      await expect(page.locator('[data-testid="pro-entry-random"]')).toBeVisible();
    });

    test('连续点击不同 Pro 入口，浮窗标题随之更新', async ({ page }) => {
      await page.click('[data-testid="pro-entry-wechat"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal-title"]')).toContainText('微信输入');

      await page.click('[data-testid="pro-upgrade-modal-cancel-btn"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal"]')).not.toBeVisible();

      await page.click('[data-testid="pro-entry-ai"]');
      await expect(page.locator('[data-testid="pro-upgrade-modal-title"]')).toContainText('AI 洞察');

      await page.click('[data-testid="pro-upgrade-modal-cancel-btn"]');
    });
  });

  test.describe('认证保护', () => {
    test('未登录用户直接访问 /memo，跳转到登录页', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/memo');
      await page.waitForURL('/login');
      await expect(page.locator('text=请先登录')).toBeVisible();
    });
  });
});
