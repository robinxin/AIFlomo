/**
 * E2E 测试：前端表单验证
 * 测试用例来源：specs/active/28-feature-account-registration-login-2-testcases.md
 */

import { test, expect } from '@playwright/test';

const WEB_URL = process.env.WEB_URL || 'http://localhost:8082';

test.describe('前端表单验证 - 正常场景', () => {
  test('邮箱格式正确，无错误提示', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    // 填写正确的邮箱
    await page.fill('input[type="email"]', 'user@example.com');

    // 光标移出邮箱输入框（触发 onBlur）
    await page.click('input[placeholder*="昵称"]');

    // 等待可能的错误提示出现
    await page.waitForTimeout(500);

    // 验证没有错误提示
    await expect(page.locator('text=请输入有效的邮箱地址')).not.toBeVisible();
  });

  test('密码长度符合要求，无错误提示', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    // 填写符合要求的密码（7 位，符合 6-128 范围）
    await page.fill('input[type="password"]', 'Pass123');

    // 光标移出密码输入框
    await page.click('input[type="email"]');

    await page.waitForTimeout(500);

    // 验证没有错误提示
    await expect(page.locator('text=密码至少需要 6 个字符')).not.toBeVisible();
    await expect(page.locator('text=密码不能超过 128 个字符')).not.toBeVisible();
  });
});

test.describe('前端表单验证 - 异常场景', () => {
  test('实时邮箱格式校验', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    // 填写无效邮箱
    await page.fill('input[type="email"]', 'invalid');

    // 光标移出邮箱输入框（触发 onBlur）
    await page.click('input[placeholder*="昵称"]');

    // 验证错误提示在 1 秒内显示
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible({ timeout: 1000 });

    // 验证错误提示为红色（可通过 CSS class 或颜色验证）
    const errorText = page.locator('text=请输入有效的邮箱地址');
    await expect(errorText).toHaveCSS('color', /rgb\(239, 68, 68\)|rgb\(220, 38, 38\)|red/);
  });

  test('密码输入框以掩码形式显示', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    const passwordInput = page.locator('input[type="password"]');

    // 输入密码
    await passwordInput.fill('Pass123');

    // 验证 input 的 type 为 password（自动掩码显示）
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 验证输入框中的值（实际值仍为明文，但显示为掩码）
    const inputValue = await passwordInput.inputValue();
    expect(inputValue).toBe('Pass123');

    // 验证浏览器渲染的掩码效果（无法直接测试，但可验证 secureTextEntry 属性）
    // 在 React Native 中为 secureTextEntry={true}，在 Web 中为 type="password"
  });
});
