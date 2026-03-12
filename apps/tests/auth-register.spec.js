/**
 * E2E 测试：用户注册功能
 * 测试用例来源：specs/active/28-feature-account-registration-login-2-testcases.md
 */

import { test, expect } from '@playwright/test';

// 测试配置
const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEB_URL = process.env.WEB_URL || 'http://localhost:8082';

test.describe('用户注册 - 正常场景', () => {
  test('有效信息+勾选协议，注册成功', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    // 填写表单
    await page.fill('input[type="email"]', 'user@example.com');
    await page.fill('input[placeholder*="昵称"]', '张三');
    await page.fill('input[type="password"]', 'Pass123!');
    await page.check('input[type="checkbox"]'); // 勾选隐私协议

    // 点击注册按钮
    await page.click('button:has-text("注册")');

    // 验证成功提示
    await expect(page.locator('text=注册成功')).toBeVisible({ timeout: 3000 });

    // 验证跳转到登录页面或自动登录到 /memo
    await page.waitForURL(/\/(login|memo)/, { timeout: 2000 });
  });

  test('邮箱包含大写字母，统一转小写存储', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'User@Example.com',
        nickname: '测试用户',
        password: 'Secure123',
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.email).toBe('user@example.com'); // 验证转为小写
    expect(body.message).toBe('注册成功');
  });

  test('密码为 6 位边界值，注册成功', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'test6@example.com',
        nickname: '边界测试',
        password: '123456', // 正好 6 位
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.email).toBe('test6@example.com');
  });

  test('密码为 128 位边界值，注册成功', async ({ request }) => {
    const longPassword = 'a'.repeat(128);
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'test128@example.com',
        nickname: '长密码测试',
        password: longPassword,
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(201);
  });

  test('昵称为 1 个字符边界值，注册成功', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'test1@example.com',
        nickname: '张',
        password: 'Pass123',
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.nickname).toBe('张');
  });

  test('昵称为 50 个字符边界值，注册成功', async ({ request }) => {
    const longNickname = '昵'.repeat(50);
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'test50@example.com',
        nickname: longNickname,
        password: 'Pass123',
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.nickname).toBe(longNickname);
  });
});

test.describe('用户注册 - 异常场景（前端校验）', () => {
  test('邮箱格式不正确（缺少 @），前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[placeholder*="昵称"]', '测试');
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');

    // 触发 onBlur 事件
    await page.click('input[placeholder*="昵称"]');

    // 验证前端错误提示
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();
  });

  test('邮箱格式不正确（缺少域名），前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', 'user@');
    await page.fill('input[placeholder*="昵称"]', '测试');
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');

    await page.click('input[placeholder*="昵称"]');
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();
  });

  test('邮箱格式不正确（纯域名），前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', '@example.com');
    await page.fill('input[placeholder*="昵称"]', '测试');
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');

    await page.click('input[placeholder*="昵称"]');
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();
  });

  test('未勾选隐私协议，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', 'user@example.com');
    await page.fill('input[placeholder*="昵称"]', '张三');
    await page.fill('input[type="password"]', 'Pass123');
    // 不勾选复选框

    await page.click('button:has-text("注册")');

    // 验证前端错误提示
    await expect(page.locator('text=请先同意隐私协议')).toBeVisible();
  });

  test('密码少于 6 位，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder*="昵称"]', '测试');
    await page.fill('input[type="password"]', '123'); // 3 位
    await page.check('input[type="checkbox"]');

    await page.click('input[type="email"]'); // 触发 onBlur

    await expect(page.locator('text=密码至少需要 6 个字符')).toBeVisible();
  });

  test('密码超过 128 位，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder*="昵称"]', '测试');
    await page.fill('input[type="password"]', 'a'.repeat(129)); // 129 位
    await page.check('input[type="checkbox"]');

    await page.click('input[type="email"]');

    await expect(page.locator('text=密码不能超过 128 个字符')).toBeVisible();
  });

  test('昵称为空字符串，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder*="昵称"]', '');
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');

    await page.click('input[type="email"]');

    await expect(page.locator('text=昵称长度需在 1-50 个字符之间')).toBeVisible();
  });

  test('昵称超过 50 个字符，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder*="昵称"]', '昵'.repeat(51));
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');

    await page.click('input[type="email"]');

    await expect(page.locator('text=昵称长度需在 1-50 个字符之间')).toBeVisible();
  });
});

test.describe('用户注册 - 异常场景（后端校验）', () => {
  test('邮箱已被注册，返回 409', async ({ request }) => {
    // 先注册一个用户
    await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'existing@example.com',
        nickname: '已存在用户',
        password: 'Pass123',
        agreePolicy: true,
      },
    });

    // 尝试重复注册
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'existing@example.com',
        nickname: '新用户',
        password: 'Pass123',
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('EMAIL_ALREADY_EXISTS');
    expect(body.message).toBe('该邮箱已被注册');
  });

  test('邮箱字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        nickname: '测试',
        password: 'Pass123',
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  test('密码字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '测试',
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  test('昵称字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        password: 'Pass123',
        agreePolicy: true,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  test('agreePolicy 为 false，返回 400', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '测试',
        password: 'Pass123',
        agreePolicy: false,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });
});

test.describe('用户注册 - 防重复提交', () => {
  test('快速点击注册按钮多次，仅发起一次请求', async ({ page }) => {
    await page.goto(`${WEB_URL}/register`);

    const uniqueEmail = `test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[placeholder*="昵称"]', '测试');
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');

    // 监听网络请求
    let requestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/register')) {
        requestCount++;
      }
    });

    // 快速点击 5 次
    const button = page.locator('button:has-text("注册")');
    await button.click({ clickCount: 5, delay: 50 });

    // 等待请求完成
    await page.waitForTimeout(1000);

    // 验证仅发起一次请求
    expect(requestCount).toBe(1);

    // 验证按钮在请求期间被禁用
    await expect(button).toBeDisabled();
  });
});
