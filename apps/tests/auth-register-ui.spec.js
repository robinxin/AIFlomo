// E2E 测试：用户注册功能 - UI 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (用户注册功能 - UI 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8082';

test.describe('用户注册功能 - 正常场景', () => {
  test('输入有效邮箱、昵称、密码并勾选隐私协议,注册成功并跳转到首页', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 填写表单
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="nickname-input"]', '小明');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.check('[data-testid="privacy-checkbox"]');

    // 点击注册按钮
    await page.click('[data-testid="register-button"]');

    // 验证按钮状态变化
    await expect(page.locator('[data-testid="register-button"]')).toHaveText('注册中...');
    await expect(page.locator('[data-testid="register-button"]')).toBeDisabled();

    // 验证输入框变为不可编辑
    await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
    await expect(page.locator('[data-testid="nickname-input"]')).toBeDisabled();
    await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

    // 等待跳转到首页
    await page.waitForURL(`${BASE_URL}/`);

    // 验证成功提示（Toast）
    await expect(page.locator('text=注册成功')).toBeVisible({ timeout: 5000 });
  });

  test('密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

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

  test('注册页面点击"返回登录"链接跳转到登录页', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 输入部分内容
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="nickname-input"]', '测试');

    // 点击"返回登录"链接
    await page.click('text=返回登录');

    // 验证跳转到登录页
    await page.waitForURL(`${BASE_URL}/login`);

    // 验证注册页面内容已清空（跳转后无法验证，仅验证 URL 跳转）
  });

  test('昵称输入 20 字符后无法继续输入', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    const maxLengthNickname = '12345678901234567890'; // 20 字符

    // 输入 20 字符
    await page.fill('[data-testid="nickname-input"]', maxLengthNickname);

    // 验证输入框值为 20 字符
    await expect(page.locator('[data-testid="nickname-input"]')).toHaveValue(maxLengthNickname);

    // 尝试输入第 21 个字符
    await page.fill('[data-testid="nickname-input"]', maxLengthNickname + 'x');

    // 验证输入框值仍为 20 字符（maxLength 阻止）
    await expect(page.locator('[data-testid="nickname-input"]')).toHaveValue(maxLengthNickname);

    // 验证显示"昵称最多 20 个字符"提示
    await expect(page.locator('text=昵称最多 20 个字符')).toBeVisible();
  });
});

test.describe('用户注册功能 - 异常场景', () => {
  test('输入框为空时点击注册,前端给出提示', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 不输入任何内容，直接点击注册
    await page.click('[data-testid="register-button"]');

    // 验证错误提示
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();
    await expect(page.locator('text=昵称长度为 2-20 字符')).toBeVisible();
    await expect(page.locator('text=密码长度为 8-20 字符')).toBeVisible();
    await expect(page.locator('text=请阅读并同意隐私协议')).toBeVisible();
  });

  test('邮箱格式不正确时失焦,显示格式错误提示', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 输入不完整邮箱
    await page.fill('[data-testid="email-input"]', 'test@');

    // 失焦
    await page.locator('[data-testid="nickname-input"]').focus();

    // 验证错误提示
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();

    // 验证输入框边框变红（通过 CSS class 或 style）
    const emailInput = page.locator('[data-testid="email-input"]');
    const borderColor = await emailInput.evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(borderColor).toContain('rgb(255'); // 红色边框
  });

  test('邮箱格式正确后失焦,错误提示消失', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 输入不完整邮箱
    await page.fill('[data-testid="email-input"]', 'test@');
    await page.locator('[data-testid="nickname-input"]').focus();

    // 验证错误提示出现
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();

    // 修正为正确邮箱
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.locator('[data-testid="nickname-input"]').focus();

    // 验证错误提示消失
    await expect(page.locator('text=请输入有效的邮箱地址')).not.toBeVisible();
  });

  test('昵称少于 2 字符时失焦,显示长度错误提示', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 输入 1 字符
    await page.fill('[data-testid="nickname-input"]', 'a');

    // 失焦
    await page.locator('[data-testid="email-input"]').focus();

    // 验证错误提示
    await expect(page.locator('text=昵称长度为 2-20 字符')).toBeVisible();
  });

  test('昵称输入纯空格时失焦,显示错误提示', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 输入多个空格
    await page.fill('[data-testid="nickname-input"]', '   ');

    // 失焦
    await page.locator('[data-testid="email-input"]').focus();

    // 验证错误提示
    await expect(page.locator('text=昵称不能为空')).toBeVisible();
  });

  test('密码少于 8 字符时失焦,显示长度错误提示', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 输入 6 字符
    await page.fill('[data-testid="password-input"]', 'abc123');

    // 失焦
    await page.locator('[data-testid="email-input"]').focus();

    // 验证错误提示
    await expect(page.locator('text=密码长度至少为 8 个字符')).toBeVisible();
  });

  test('未勾选隐私协议点击注册,高亮提示勾选框', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // 填写有效表单内容（不勾选隐私协议）
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="nickname-input"]', '小明');
    await page.fill('[data-testid="password-input"]', 'password123');

    // 点击注册
    await page.click('[data-testid="register-button"]');

    // 验证隐私协议错误提示
    await expect(page.locator('text=请阅读并同意隐私协议')).toBeVisible();

    // 验证勾选框边框变红
    const checkbox = page.locator('[data-testid="privacy-checkbox"]');
    const borderColor = await checkbox.evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(borderColor).toContain('rgb(255'); // 红色边框
  });

  test('邮箱已被注册时,表单顶部显示错误提示', async ({ page }) => {
    // 前置条件：数据库中已存在 user@example.com 用户（需手动创建或通过 API）
    // 本测试假设数据库已有该用户

    await page.goto(`${BASE_URL}/register`);

    // 填写表单（使用已注册的邮箱）
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="nickname-input"]', '小红');
    await page.fill('[data-testid="password-input"]', 'password456');
    await page.check('[data-testid="privacy-checkbox"]');

    // 点击注册
    await page.click('[data-testid="register-button"]');

    // 等待 API 响应
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/register') && resp.status() === 409);

    // 验证表单顶部错误提示
    await expect(page.locator('[data-testid="form-error"]')).toHaveText('该邮箱已被注册');

    // 验证按钮恢复可点击
    await expect(page.locator('[data-testid="register-button"]')).toBeEnabled();

    // 验证输入框恢复可编辑
    await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();

    // 验证表单内容保持不变
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('user@example.com');
    await expect(page.locator('[data-testid="nickname-input"]')).toHaveValue('小红');
  });

  test('网络异常时,表单顶部显示网络错误提示', async ({ page, context }) => {
    // 模拟网络故障（中断 API 请求）
    await context.route('**/api/auth/register', (route) => route.abort());

    await page.goto(`${BASE_URL}/register`);

    // 填写有效表单
    await page.fill('[data-testid="email-input"]', 'newuser@example.com');
    await page.fill('[data-testid="nickname-input"]', '新用户');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.check('[data-testid="privacy-checkbox"]');

    // 点击注册
    await page.click('[data-testid="register-button"]');

    // 验证表单顶部错误提示
    await expect(page.locator('[data-testid="form-error"]')).toHaveText('网络连接失败，请稍后重试');

    // 验证按钮恢复可点击
    await expect(page.locator('[data-testid="register-button"]')).toBeEnabled();

    // 验证输入框恢复可编辑
    await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();
  });
});
