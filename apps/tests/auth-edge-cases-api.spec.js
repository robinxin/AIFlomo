// E2E 测试：边界场景与特殊情况 - API 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (边界场景与特殊情况 - API 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('边界场景与特殊情况 - API 正常场景', () => {
  test('注册成功后自动登录,无需二次输入密码', async ({ request }) => {
    // 使用唯一邮箱避免并发测试中的邮箱冲突（多浏览器并行运行时）
    const uniqueEmail = `autologin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

    // 注册
    const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: uniqueEmail,
        nickname: '自动登录',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(registerResponse.status()).toBe(201);

    // 获取注册接口返回的 Session Cookie
    const setCookie = registerResponse.headers()['set-cookie'];
    expect(setCookie).toBeDefined();

    // 立即使用注册返回的 Cookie 调用 GET /api/auth/me
    const meResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Cookie: setCookie,
      },
    });

    expect(meResponse.status()).toBe(200);

    const body = await meResponse.json();
    expect(body.data.email).toBe(uniqueEmail);
    expect(body.data.nickname).toBe('自动登录');
  });
});

test.describe('边界场景与特殊情况 - API 异常场景', () => {
  test('GET /api/auth/me 请求超时或网络中断,前端降级为未登录状态', async ({ request }) => {
    // 注意：此测试需要在前端测试中实现（模拟网络超时）
    // API 测试中无法直接模拟前端超时降级逻辑
    test.skip();
  });

  test('密码长度为 0 字符时提交登录,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'user@example.com',
        password: '',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('登录失败');
  });
});
