import { test, expect } from '@playwright/test';

/**
 * 用户注册功能 - UI 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

test.describe('用户注册 - UI 正常场景', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('输入有效邮箱、昵称、密码并勾选隐私协议，注册成功并跳转到首页', async ({ page }) => {
    // 填写表单
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="nickname-input"]', '小明');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.check('[data-testid="privacy-checkbox"]');

    // 点击注册按钮
    await page.click('[data-testid="submit-button"]');

    // 验证加载状态
    await expect(page.locator('[data-testid="submit-button"]')).toContainText('注册中...');
    await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
    await expect(page.locator('[data-testid="nickname-input"]')).toBeDisabled();
    await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

    // 等待跳转到首页
    await page.waitForURL('/');

    // 验证成功提示
    await expect(page.locator('text=注册成功')).toBeVisible();
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

  test('注册页面点击"返回登录"链接跳转到登录页', async ({ page }) => {
    // 输入部分内容
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="nickname-input"]', '测试');

    // 点击返回登录链接
    await page.click('text=返回登录');

    // 验证跳转到登录页
    await page.waitForURL('/login');
  });

  test('昵称输入 20 字符后无法继续输入', async ({ page }) => {
    const nicknameInput = page.locator('[data-testid="nickname-input"]');

    // 输入 20 个字符
    await nicknameInput.fill('12345678901234567890');

    // 验证输入框值为 20 字符
    await expect(nicknameInput).toHaveValue('12345678901234567890');

    // 尝试继续输入（maxLength 会阻止）
    await nicknameInput.press('a');

    // 验证仍然是 20 字符
    await expect(nicknameInput).toHaveValue('12345678901234567890');

    // 验证提示文字
    await expect(page.locator('text=昵称最多 20 个字符')).toBeVisible();
  });
});

test.describe('用户注册 - UI 异常场景', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('输入框为空时点击注册，前端给出提示', async ({ page }) => {
    // 直接点击注册按钮
    await page.click('[data-testid="submit-button"]');

    // 验证错误提示
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();
    await expect(page.locator('text=昵称长度为 2-20 字符')).toBeVisible();
    await expect(page.locator('text=密码长度为 8-20 字符')).toBeVisible();
    await expect(page.locator('text=请阅读并同意隐私协议')).toBeVisible();
  });

  test('邮箱格式不正确时失焦，显示格式错误提示', async ({ page }) => {
    const emailInput = page.locator('[data-testid="email-input"]');

    // 输入不完整邮箱
    await emailInput.fill('test@');

    // 失焦
    await emailInput.blur();

    // 验证错误提示
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();

    // 验证输入框边框变红（通过 CSS class 或样式）
    await expect(emailInput).toHaveClass(/error|invalid/);
  });

  test('邮箱格式正确后失焦，错误提示消失', async ({ page }) => {
    const emailInput = page.locator('[data-testid="email-input"]');

    // 先输入错误邮箱触发错误
    await emailInput.fill('test@');
    await emailInput.blur();
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();

    // 修正为正确邮箱
    await emailInput.fill('test@example.com');
    await emailInput.blur();

    // 验证错误提示消失
    await expect(page.locator('text=请输入有效的邮箱地址')).not.toBeVisible();
  });

  test('昵称少于 2 字符时失焦，显示长度错误提示', async ({ page }) => {
    const nicknameInput = page.locator('[data-testid="nickname-input"]');

    // 输入 1 个字符
    await nicknameInput.fill('a');

    // 失焦
    await nicknameInput.blur();

    // 验证错误提示
    await expect(page.locator('text=昵称长度为 2-20 字符')).toBeVisible();
    await expect(nicknameInput).toHaveClass(/error|invalid/);
  });

  test('昵称输入纯空格时失焦，显示错误提示', async ({ page }) => {
    const nicknameInput = page.locator('[data-testid="nickname-input"]');

    // 输入多个空格
    await nicknameInput.fill('   ');

    // 失焦
    await nicknameInput.blur();

    // 验证错误提示
    await expect(page.locator('text=昵称不能为空')).toBeVisible();
    await expect(nicknameInput).toHaveClass(/error|invalid/);
  });

  test('密码少于 8 字符时失焦，显示长度错误提示', async ({ page }) => {
    const passwordInput = page.locator('[data-testid="password-input"]');

    // 输入 6 个字符
    await passwordInput.fill('abc123');

    // 失焦
    await passwordInput.blur();

    // 验证错误提示
    await expect(page.locator('text=密码长度至少为 8 个字符')).toBeVisible();
    await expect(passwordInput).toHaveClass(/error|invalid/);
  });

  test('未勾选隐私协议点击注册，高亮提示勾选框', async ({ page }) => {
    // 填写其他字段
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="nickname-input"]', '小明');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 不勾选隐私协议
    // 点击注册
    await page.click('[data-testid="submit-button"]');

    // 验证错误提示
    await expect(page.locator('text=请阅读并同意隐私协议')).toBeVisible();
    await expect(page.locator('[data-testid="privacy-checkbox"]')).toHaveClass(/error|invalid/);
  });

  test('邮箱已被注册时，表单顶部显示错误提示', async ({ page }) => {
    // 假设数据库中已存在 user@example.com
    // 填写表单
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="nickname-input"]', '小红');
    await page.fill('[data-testid="password-input"]', 'password456');
    await page.check('[data-testid="privacy-checkbox"]');

    // 点击注册
    await page.click('[data-testid="submit-button"]');

    // 等待 API 响应
    await page.waitForResponse(response =>
      response.url().includes('/api/auth/register') && response.status() === 409
    );

    // 验证错误提示
    await expect(page.locator('[data-testid="form-error"]')).toContainText('该邮箱已被注册');

    // 验证表单恢复可编辑
    await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
    await expect(page.locator('[data-testid="email-input"]')).not.toBeDisabled();

    // 验证已输入内容保持不变
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('user@example.com');
    await expect(page.locator('[data-testid="nickname-input"]')).toHaveValue('小红');
  });

  test('网络异常时，表单顶部显示网络错误提示', async ({ page }) => {
    // 模拟网络异常（拦截请求返回错误）
    await page.route('**/api/auth/register', route => route.abort());

    // 填写表单
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="nickname-input"]', '测试');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.check('[data-testid="privacy-checkbox"]');

    // 点击注册
    await page.click('[data-testid="submit-button"]');

    // 验证网络错误提示
    await expect(page.locator('[data-testid="form-error"]')).toContainText('网络连接失败，请稍后重试');

    // 验证表单恢复可编辑
    await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
  });
});
