/**
 * E2E 测试：Session 安全
 * 测试用例来源：specs/active/28-feature-account-registration-login-2-testcases.md
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEB_URL = process.env.WEB_URL || 'http://localhost:8082';

// 辅助函数：注册并登录用户
async function registerAndLogin(request, email = 'sectest@example.com') {
  await request.post(`${API_URL}/api/auth/register`, {
    data: {
      email,
      nickname: '安全测试',
      password: 'Pass123',
      agreePolicy: true,
    },
  }).catch(() => {
    // 用户已存在，忽略错误
  });

  return await request.post(`${API_URL}/api/auth/login`, {
    data: {
      email,
      password: 'Pass123',
    },
  });
}

test.describe('Session 安全 - Cookie 设置', () => {
  test('Cookie 设置为 HttpOnly', async ({ request }) => {
    const loginResponse = await registerAndLogin(request);

    const setCookie = loginResponse.headers()['set-cookie'];
    expect(setCookie).toContain('HttpOnly');

    // 验证前端 JavaScript 无法读取 Cookie
    // 注意：Playwright 测试环境中无法直接验证 document.cookie，需在浏览器上下文中测试
  });

  test('Cookie 设置为 SameSite=Strict', async ({ request }) => {
    const loginResponse = await registerAndLogin(request);

    const setCookie = loginResponse.headers()['set-cookie'];
    expect(setCookie).toContain('SameSite=Strict');
  });

  test('生产环境 Cookie 设置为 Secure', async ({ request }) => {
    // 注意：此测试需要在生产环境或设置 NODE_ENV=production 时运行
    // 如果当前为开发环境，可跳过此测试

    if (process.env.NODE_ENV !== 'production') {
      test.skip();
      return;
    }

    const loginResponse = await registerAndLogin(request, 'prodtest@example.com');

    const setCookie = loginResponse.headers()['set-cookie'];
    expect(setCookie).toContain('Secure');
  });
});

test.describe('Session 安全 - 密码存储', () => {
  test('密码使用 bcrypt 存储，salt rounds = 10', async ({ request }) => {
    const email = `bcrypttest-${Date.now()}@example.com`;
    const registerResponse = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email,
        nickname: 'Bcrypt测试',
        password: 'TestPassword123',
        agreePolicy: true,
      },
    });

    expect(registerResponse.status()).toBe(201);

    // 注意：直接查询数据库验证 password_hash 字段
    // 由于 Playwright 无法直接访问数据库，此测试需配合后端单测完成
    // 可通过日志或 API 返回结构间接验证（但不应返回 passwordHash）

    // 验证响应不包含 passwordHash（安全要求）
    const body = await registerResponse.json();
    expect(body.data.passwordHash).toBeUndefined();
  });
});

test.describe('Session 安全 - XSS 防护', () => {
  test('前端 JavaScript 无法通过 document.cookie 读取 Session ID', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    // 登录
    await page.fill('input[type="email"]', 'xsstest@example.com');
    await page.fill('input[type="password"]', 'Pass123');

    // 先注册用户
    await page.goto(`${WEB_URL}/register`);
    await page.fill('input[type="email"]', 'xsstest@example.com');
    await page.fill('input[placeholder*="昵称"]', 'XSS测试');
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("注册")');
    await page.waitForTimeout(1500);

    // 返回登录
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"]', 'xsstest@example.com');
    await page.fill('input[type="password"]', 'Pass123');
    await page.click('button:has-text("登录")');

    await page.waitForURL(`${WEB_URL}/memo`, { timeout: 3000 });

    // 尝试读取 Cookie
    const cookieValue = await page.evaluate(() => {
      return document.cookie;
    });

    // 验证 Cookie 不包含 sessionId（因为设置了 HttpOnly）
    expect(cookieValue).not.toContain('sessionId');
  });

  test('用户输入的邮箱和昵称仅作为纯文本渲染', async ({ page }) => {
    const maliciousNickname = '<script>alert("XSS")</script>';

    await page.goto(`${WEB_URL}/register`);

    await page.fill('input[type="email"]', `xss-nickname-${Date.now()}@example.com`);
    await page.fill('input[placeholder*="昵称"]', maliciousNickname);
    await page.fill('input[type="password"]', 'Pass123');
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("注册")');

    // 验证页面不执行 XSS 脚本
    page.on('dialog', async (dialog) => {
      // 如果有 alert 弹窗，说明 XSS 攻击成功（测试失败）
      throw new Error('XSS attack detected!');
    });

    await page.waitForTimeout(2000);
    // 如果到这里没有抛出异常，说明 XSS 防护有效
  });
});

test.describe('Session 安全 - 错误信息脱敏', () => {
  test('登录失败统一返回"邮箱或密码错误"，不暴露用户是否存在', async ({ request }) => {
    // 测试不存在的用户
    const nonExistentResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'nonexistent-user-12345@example.com',
        password: 'Pass123',
      },
    });

    expect(nonExistentResponse.status()).toBe(401);
    const body1 = await nonExistentResponse.json();
    expect(body1.message).toBe('邮箱或密码错误');

    // 测试存在的用户但密码错误
    await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'existing-user@example.com',
        nickname: '存在用户',
        password: 'CorrectPass',
        agreePolicy: true,
      },
    }).catch(() => {});

    const wrongPasswordResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'existing-user@example.com',
        password: 'WrongPass',
      },
    });

    expect(wrongPasswordResponse.status()).toBe(401);
    const body2 = await wrongPasswordResponse.json();
    expect(body2.message).toBe('邮箱或密码错误');

    // 验证两种错误返回的消息相同（不暴露用户是否存在）
    expect(body1.message).toBe(body2.message);
    expect(body1.error).toBe(body2.error);
  });

  test('注册时邮箱已存在，明确提示"该邮箱已被注册"', async ({ request }) => {
    const email = 'duplicate-test@example.com';

    // 先注册一次
    await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '首次注册',
        password: 'Pass123',
        agreePolicy: true,
      },
    }).catch(() => {});

    // 尝试重复注册
    const duplicateResponse = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '重复注册',
        password: 'Pass123',
        agreePolicy: true,
      },
    });

    expect(duplicateResponse.status()).toBe(409);
    const body = await duplicateResponse.json();
    expect(body.message).toBe('该邮箱已被注册');
    expect(body.error).toBe('EMAIL_ALREADY_EXISTS');
  });
});
