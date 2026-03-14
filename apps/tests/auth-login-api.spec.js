// E2E 测试：用户登录功能 - API 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (用户登录功能 - API 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('用户登录功能 - API 正常场景', () => {
  test('有效邮箱和密码,用户登录成功', async ({ request }) => {
    // 前置条件：先注册一个用户
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'loginapitest@example.com',
        nickname: '登录API测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 登录
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'loginapitest@example.com',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.email).toBe('loginapitest@example.com');
    expect(body.data.nickname).toBe('登录API测试');
    expect(body.data).toHaveProperty('createdAt');
    expect(body.message).toBe('登录成功');

    // 验证 Set-Cookie 头包含 Session Cookie
    const setCookie = response.headers()['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('connect.sid');
  });
});

test.describe('用户登录功能 - API 异常场景', () => {
  test('邮箱字段缺失,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        password: 'password123',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('登录失败');
  });

  test('密码字段缺失,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'user@example.com',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('登录失败');
  });

  test('邮箱不存在,返回 401 且不泄露具体原因', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('邮箱或密码错误，请重试');
    expect(body.message).toBe('登录失败');
  });

  test('密码错误,返回 401 且不泄露具体原因', async ({ request }) => {
    // 前置条件：先注册一个用户
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'wrongpw@example.com',
        nickname: '错误密码',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 使用错误密码登录
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'wrongpw@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('邮箱或密码错误，请重试');
    expect(body.message).toBe('登录失败');
  });

  test('数据库异常时,返回 500 且不暴露内部错误', async ({ request }) => {
    // 注意：此测试需要模拟数据库不可用场景
    // 实际 E2E 测试中可能无法直接实现，跳过或配置专门的错误注入机制
    test.skip();
  });
});
