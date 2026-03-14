import { test, expect } from '@playwright/test';

/**
 * 边界场景与特殊情况 - API 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('边界场景与特殊情况 - API 正常场景', () => {
  test('注册成功后自动登录，无需二次输入密码', async ({ request }) => {
    // 注册用户
    const registerResponse = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'autologin@example.com',
        nickname: '自动登录',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(registerResponse.status()).toBe(201);

    // 提取 Session Cookie
    const cookies = registerResponse.headers()['set-cookie'];
    expect(cookies).toBeTruthy();

    // 立即调用 /me 接口
    const meResponse = await request.get(`${API_BASE}/api/auth/me`, {
      headers: {
        Cookie: cookies,
      },
    });

    expect(meResponse.status()).toBe(200);

    const body = await meResponse.json();
    expect(body.data.email).toBe('autologin@example.com');
  });
});

test.describe('边界场景与特殊情况 - API 异常场景', () => {
  test('GET /api/auth/me 请求超时或网络中断，前端降级为未登录状态', async ({ request }) => {
    // 模拟超时需要在前端测试中进行
    // 这里使用占位测试
    test.skip();
  });

  test('密码长度为 0 字符时提交登录，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        email: 'user@example.com',
        password: '',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请求参数格式错误',
      message: '登录失败',
    });
  });
});
