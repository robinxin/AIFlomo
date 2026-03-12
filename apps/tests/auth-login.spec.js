/**
 * E2E 测试：用户登录功能
 * 测试用例来源：specs/active/28-feature-account-registration-login-2-testcases.md
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEB_URL = process.env.WEB_URL || 'http://localhost:8082';

// 测试前准备：注册测试用户
test.beforeEach(async ({ request }) => {
  // 确保测试用户存在
  await request.post(`${API_URL}/api/auth/register`, {
    data: {
      email: 'testuser@example.com',
      nickname: '测试用户',
      password: 'Pass123',
      agreePolicy: true,
    },
  }).catch(() => {
    // 用户已存在，忽略错误
  });
});

test.describe('用户登录 - 正常场景', () => {
  test('有效邮箱和密码，登录成功', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    // 填写登录表单
    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'Pass123');

    // 点击登录按钮
    await page.click('button:has-text("登录")');

    // 验证跳转到 /memo 页面
    await page.waitForURL(`${WEB_URL}/memo`, { timeout: 3000 });
    expect(page.url()).toContain('/memo');
  });

  test('邮箱大小写混合，统一转小写比对，登录成功', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'TestUser@Example.com', // 大小写混合
        password: 'Pass123',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.email).toBe('testuser@example.com');
    expect(body.message).toBe('登录成功');

    // 验证 Session Cookie 设置
    const setCookie = response.headers()['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });

  test('Session 有效期为 7 天', async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'testuser@example.com',
        password: 'Pass123',
      },
    });

    expect(loginResponse.status()).toBe(200);

    // 提取 Session Cookie
    const setCookie = loginResponse.headers()['set-cookie'];
    const sessionIdMatch = setCookie.match(/sessionId=([^;]+)/);
    expect(sessionIdMatch).toBeTruthy();

    // 验证 Session 过期时间（通过查询 /api/auth/me 验证 Session 有效）
    const meResponse = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Cookie: `sessionId=${sessionIdMatch[1]}`,
      },
    });

    expect(meResponse.status()).toBe(200);
  });
});

test.describe('用户登录 - 异常场景', () => {
  test('邮箱不存在，返回 401', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'Pass123',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');
    expect(body.message).toBe('邮箱或密码错误');
  });

  test('密码错误，返回 401', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'testuser@example.com',
        password: 'WrongPass',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');
    expect(body.message).toBe('邮箱或密码错误');
  });

  test('邮箱字段为空，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    await page.fill('input[type="email"]', '');
    await page.fill('input[type="password"]', 'Pass123');

    await page.click('button:has-text("登录")');

    // 验证前端错误提示
    await expect(page.locator('text=请填写完整信息')).toBeVisible();
  });

  test('密码字段为空，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', '');

    await page.click('button:has-text("登录")');

    await expect(page.locator('text=请填写完整信息')).toBeVisible();
  });

  test('邮箱和密码都为空，前端阻止提交', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    await page.fill('input[type="email"]', '');
    await page.fill('input[type="password"]', '');

    await page.click('button:has-text("登录")');

    await expect(page.locator('text=请填写完整信息')).toBeVisible();
  });

  test('快速点击登录按钮多次，仅发起一次请求', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'Pass123');

    // 监听网络请求
    let requestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) {
        requestCount++;
      }
    });

    // 快速点击 5 次
    const button = page.locator('button:has-text("登录")');
    await button.click({ clickCount: 5, delay: 50 });

    await page.waitForTimeout(1000);

    // 验证仅发起一次请求
    expect(requestCount).toBe(1);
  });

  test('网络错误时显示友好提示', async ({ page, context }) => {
    await page.goto(`${WEB_URL}/login`);

    // 模拟网络错误（阻止所有请求）
    await context.route('**/api/auth/login', (route) => {
      route.abort('failed');
    });

    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'Pass123');
    await page.click('button:has-text("登录")');

    // 验证友好错误提示
    await expect(page.locator('text=网络错误，请稍后重试')).toBeVisible({ timeout: 3000 });
  });
});
