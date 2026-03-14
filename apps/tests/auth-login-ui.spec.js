// E2E 测试：用户登录功能 - UI 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (用户登录功能 - UI 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8082';

test.describe('用户登录功能 - 正常场景', () => {
  test('输入正确的邮箱和密码,登录成功并跳转到首页', async ({ page, request }) => {
    // 前置条件：注册一个测试用户
    await request.post(`${BASE_URL.replace('8082', '3000')}/api/auth/register`, {
      data: {
        email: 'logintest@example.com',
        nickname: '登录测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 清除 Cookie（确保未登录状态）
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/login`);

    // 填写表单
    await page.fill('[data-testid="email-input"]', 'logintest@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击登录按钮
    await page.click('[data-testid="login-button"]');

    // 验证按钮状态变化
    await expect(page.locator('[data-testid="login-button"]')).toHaveText('登录中...');
    await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();

    // 验证输入框变为不可编辑
    await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
    await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

    // 等待跳转到首页
    await page.waitForURL(`${BASE_URL}/`);

    // 验证成功提示（Toast）
    await expect(page.locator('text=登录成功')).toBeVisible({ timeout: 5000 });
  });

  test('登录页面点击"立即注册"链接跳转到注册页', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // 输入部分内容
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击"立即注册"链接
    await page.click('text=立即注册');

    // 验证跳转到注册页
    await page.waitForURL(`${BASE_URL}/register`);
  });

  test('密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // 输入密码
    await page.fill('[data-testid="password-input"]', 'password123');

    // 验证初始为密文显示
    await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');

    // 点击眼睛图标
    await page.click('[data-testid="password-toggle"]');

    // 验证切换为明文显示
    await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'text');

    // 再次点击眼睛图标
    await page.click('[data-testid="password-toggle"]');

    // 验证恢复密文显示
    await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');
  });
});

test.describe('用户登录功能 - 异常场景', () => {
  test('输入错误的邮箱或密码,表单顶部显示错误提示', async ({ page, request }) => {
    // 前置条件：注册一个测试用户
    await request.post(`${BASE_URL.replace('8082', '3000')}/api/auth/register`, {
      data: {
        email: 'wrongpwtest@example.com',
        nickname: '错误密码测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    await page.goto(`${BASE_URL}/login`);

    // 输入正确邮箱，错误密码
    await page.fill('[data-testid="email-input"]', 'wrongpwtest@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');

    // 点击登录
    await page.click('[data-testid="login-button"]');

    // 等待 API 响应
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/login') && resp.status() === 401);

    // 验证表单顶部错误提示
    await expect(page.locator('[data-testid="form-error"]')).toHaveText('邮箱或密码错误，请重试');

    // 验证按钮恢复可点击
    await expect(page.locator('[data-testid="login-button"]')).toBeEnabled();

    // 验证输入框恢复可编辑
    await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();
    await expect(page.locator('[data-testid="password-input"]')).toBeEnabled();

    // 验证密码输入框自动清空
    await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');

    // 验证邮箱输入框保持原内容
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('wrongpwtest@example.com');
  });

  test('输入不存在的邮箱,表单顶部显示统一错误提示', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // 输入不存在的邮箱
    await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击登录
    await page.click('[data-testid="login-button"]');

    // 等待 API 响应
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/login') && resp.status() === 401);

    // 验证表单顶部错误提示（不泄露"用户不存在"）
    await expect(page.locator('[data-testid="form-error"]')).toHaveText('邮箱或密码错误，请重试');

    // 验证密码输入框自动清空
    await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');

    // 验证邮箱输入框保持原内容
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('nonexistent@example.com');
  });

  test('网络异常时,表单顶部显示网络错误提示', async ({ page, context }) => {
    // 模拟网络故障
    await context.route('**/api/auth/login', (route) => route.abort());

    await page.goto(`${BASE_URL}/login`);

    // 填写表单
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击登录
    await page.click('[data-testid="login-button"]');

    // 验证表单顶部错误提示
    await expect(page.locator('[data-testid="form-error"]')).toHaveText('网络连接失败，请稍后重试');

    // 验证按钮恢复可点击
    await expect(page.locator('[data-testid="login-button"]')).toBeEnabled();

    // 验证输入框恢复可编辑
    await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();
    await expect(page.locator('[data-testid="password-input"]')).toBeEnabled();

    // 验证表单内容保持不变
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('test@example.com');
    await expect(page.locator('[data-testid="password-input"]')).toHaveValue('password123');
  });
});
