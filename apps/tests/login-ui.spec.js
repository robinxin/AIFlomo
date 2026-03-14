import { test, expect } from '@playwright/test';

/**
 * 用户登录功能 - UI 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

test.describe('用户登录 - UI 正常场景', () => {
  test.beforeEach(async ({ page }) => {
    // 假设数据库中已存在测试用户
    await page.goto('/login');
  });

  test('输入正确的邮箱和密码，登录成功并跳转到首页', async ({ page }) => {
    // 填写登录表单
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击登录按钮
    await page.click('[data-testid="submit-button"]');

    // 验证加载状态
    await expect(page.locator('[data-testid="submit-button"]')).toContainText('登录中...');
    await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
    await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

    // 等待跳转到首页
    await page.waitForURL('/');

    // 验证成功提示
    await expect(page.locator('text=登录成功')).toBeVisible();
  });

  test('登录页面点击"立即注册"链接跳转到注册页', async ({ page }) => {
    // 输入部分内容
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password');

    // 点击立即注册链接
    await page.click('text=立即注册');

    // 验证跳转到注册页
    await page.waitForURL('/register');
  });

  test('密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
    // 输入密码
    await page.fill('[data-testid="password-input"]', 'password123');

    // 获取密码输入框
    const passwordInput = page.locator('[data-testid="password-input"]');

    // 验证初始状态是密文
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 点击眼睛图标
    await page.click('[data-testid="password-toggle"]');

    // 验证变为明文
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // 再次点击眼睛图标
    await page.click('[data-testid="password-toggle"]');

    // 验证恢复密文
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('用户登录 - UI 异常场景', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('输入错误的邮箱或密码，表单顶部显示错误提示', async ({ page }) => {
    // 输入错误密码
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');

    // 点击登录
    await page.click('[data-testid="submit-button"]');

    // 等待 API 响应
    await page.waitForResponse(response =>
      response.url().includes('/api/auth/login') && response.status() === 401
    );

    // 验证错误提示
    await expect(page.locator('[data-testid="form-error"]')).toContainText('邮箱或密码错误，请重试');

    // 验证表单恢复可编辑
    await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
    await expect(page.locator('[data-testid="email-input"]')).not.toBeDisabled();
    await expect(page.locator('[data-testid="password-input"]')).not.toBeDisabled();

    // 验证密码框被清空
    await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');

    // 验证邮箱框保持原内容
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('user@example.com');
  });

  test('输入不存在的邮箱，表单顶部显示统一错误提示', async ({ page }) => {
    // 输入不存在的邮箱
    await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击登录
    await page.click('[data-testid="submit-button"]');

    // 等待 API 响应
    await page.waitForResponse(response =>
      response.url().includes('/api/auth/login') && response.status() === 401
    );

    // 验证统一错误提示（不泄露"用户不存在"）
    await expect(page.locator('[data-testid="form-error"]')).toContainText('邮箱或密码错误，请重试');

    // 验证密码框被清空
    await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');

    // 验证邮箱框保持原内容
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('nonexistent@example.com');
  });

  test('网络异常时，表单顶部显示网络错误提示', async ({ page }) => {
    // 模拟网络异常
    await page.route('**/api/auth/login', route => route.abort());

    // 填写表单
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击登录
    await page.click('[data-testid="submit-button"]');

    // 验证网络错误提示
    await expect(page.locator('[data-testid="form-error"]')).toContainText('网络连接失败，请稍后重试');

    // 验证表单恢复可编辑
    await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
  });
});
