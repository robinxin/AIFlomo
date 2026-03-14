import { test, expect } from '@playwright/test';

/**
 * 用户注册功能 - API 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('用户注册 - API 正常场景', () => {
  test('有效邮箱、昵称、密码和隐私协议同意，用户注册成功', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'newuser@example.com',
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        email: 'newuser@example.com',
        nickname: '小明',
      },
      message: '注册成功',
    });

    expect(body.data.id).toBeTruthy();
    expect(body.data.createdAt).toBeGreaterThan(0);

    // 验证 Set-Cookie 包含 Session
    const cookies = response.headers()['set-cookie'];
    expect(cookies).toBeTruthy();
  });

  test('昵称包含前后空格时，后端 trim 后存储', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'trimtest@example.com',
        nickname: '  小红  ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('小红');
  });

  test('昵称为 2 字符（边界值），注册成功', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'min@example.com',
        nickname: 'ab',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('ab');
  });

  test('昵称为 20 字符（边界值），注册成功', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'max@example.com',
        nickname: '12345678901234567890',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('12345678901234567890');
  });

  test('密码为 8 字符（边界值），注册成功', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'minpw@example.com',
        nickname: '测试',
        password: 'abcd1234',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);
  });

  test('密码为 20 字符（边界值），注册成功', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'maxpw@example.com',
        nickname: '测试',
        password: '12345678901234567890',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);
  });
});

test.describe('用户注册 - API 异常场景', () => {
  test('邮箱字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请求参数格式错误',
      message: '注册失败',
    });
  });

  test('昵称字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请求参数格式错误',
      message: '注册失败',
    });
  });

  test('密码字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请求参数格式错误',
      message: '注册失败',
    });
  });

  test('agreedToPrivacy 字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请求参数格式错误',
      message: '注册失败',
    });
  });

  test('邮箱格式不正确，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'invalid-email',
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请输入有效的邮箱地址',
      message: '注册失败',
    });
  });

  test('昵称少于 2 字符，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: 'a',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '昵称长度为 2-20 字符',
      message: '注册失败',
    });
  });

  test('昵称超过 20 字符，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '123456789012345678901',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '昵称长度为 2-20 字符',
      message: '注册失败',
    });
  });

  test('昵称为纯空格，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '   ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '昵称长度为 2-20 字符',
      message: '注册失败',
    });
  });

  test('密码少于 8 字符，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: 'abc123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '密码长度为 8-20 字符',
      message: '注册失败',
    });
  });

  test('密码超过 20 字符，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: '123456789012345678901',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '密码长度为 8-20 字符',
      message: '注册失败',
    });
  });

  test('agreedToPrivacy 为 false，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: false,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请阅读并同意隐私协议',
      message: '注册失败',
    });
  });

  test('邮箱已被注册，返回 409', async ({ request }) => {
    // 先注册一个用户
    await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'existing@example.com',
        nickname: '已存在',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 尝试再次注册相同邮箱
    const response = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'existing@example.com',
        nickname: '小红',
        password: 'password456',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(409);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '该邮箱已被注册',
      message: '注册失败',
    });
  });

  test('并发注册同一邮箱，仅一个成功，其他返回 409', async ({ request }) => {
    // 并发发送两个注册请求
    const promises = [
      request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email: 'concurrent@example.com',
          nickname: '用户1',
          password: 'password123',
          agreedToPrivacy: true,
        },
      }),
      request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email: 'concurrent@example.com',
          nickname: '用户2',
          password: 'password456',
          agreedToPrivacy: true,
        },
      }),
    ];

    const responses = await Promise.all(promises);

    // 其中一个成功，一个失败
    const statuses = responses.map(r => r.status()).sort();
    expect(statuses).toEqual([201, 409]);
  });

  test('数据库异常时，返回 500 且不暴露内部错误', async ({ request }) => {
    // 此测试需要手动停止数据库服务，或通过 mock 模拟
    // 这里使用占位测试，实际执行时需配合数据库控制
    test.skip();
  });
});
