/**
 * E2E 测试：前端页面导航
 * 测试用例来源：specs/active/28-feature-account-registration-login-2-testcases.md
 */

import { test, expect } from '@playwright/test';

const WEB_URL = process.env.WEB_URL || 'http://localhost:8082';

test.describe('前端页面导航 - 正常场景', () => {
  test('从登录页面点击"立即注册"，跳转到注册页面', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    // 点击"立即注册"链接
    await page.click('text=立即注册');

    // 验证跳转到注册页面
    await page.waitForURL(`${WEB_URL}/register`, { timeout: 2000 });
    expect(page.url()).toContain('/register');

    // 验证注册表单为空白状态
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue('');
  });

  test('从注册页面点击"返回登录"，跳转到登录页面', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    // 点击"返回登录"链接
    await page.click('text=返回登录');

    // 验证跳转到登录页面
    await page.waitForURL(`${WEB_URL}/login`, { timeout: 2000 });
    expect(page.url()).toContain('/login');

    // 验证登录表单为空白状态
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue('');
  });

  test('注册成功后跳转到登录页面或自动登录', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    const uniqueEmail = `nav-test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[placeholder*="昵称"]', '导航测试');
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');

    await page.click('button:has-text("注册")');

    // 验证显示成功提示
    await expect(page.locator('text=注册成功')).toBeVisible({ timeout: 3000 });

    // 验证跳转到登录页面或主页面
    await page.waitForURL(/\/(login|memo)/, { timeout: 2000 });
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/(login|memo)/);
  });

  test('登录成功后跳转到主页面', async ({ page, request }) => {
    // 先注册一个用户
    const email = 'login-nav-test@example.com';
    await request.post(`${WEB_URL.replace('8082', '3000')}/api/auth/register`, {
      data: {
        email,
        nickname: '登录导航测试',
        password: 'Pass123',
        agreePolicy: true,
      },
    }).catch(() => {
      // 用户已存在，忽略错误
    });

    await page.goto(`${WEB_URL}/login`);

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Pass123');
    await page.click('button:has-text("登录")');

    // 验证跳转到主页面
    await page.waitForURL(`${WEB_URL}/memo`, { timeout: 3000 });
    expect(page.url()).toContain('/memo');
  });
});

test.describe('前端页面导航 - 异常场景', () => {
  test('在登录/注册页面之间来回切换，之前填写的表单数据不保留', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    // 填写邮箱
    await page.fill('input[type="email"]', 'test@example.com');

    // 跳转到注册页面
    await page.click('text=立即注册');
    await page.waitForURL(`${WEB_URL}/register`);

    // 返回登录页面
    await page.click('text=返回登录');
    await page.waitForURL(`${WEB_URL}/login`);

    // 验证表单数据已清空
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue('');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveValue('');
  });
});
