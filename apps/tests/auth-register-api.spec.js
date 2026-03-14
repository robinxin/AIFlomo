// E2E 测试：用户注册功能 - API 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (用户注册功能 - API 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * 生成唯一邮箱，避免并发测试中的邮箱冲突（多浏览器并行 + 多次运行）
 */
function uniqueEmail(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe('用户注册功能 - API 正常场景', () => {
  test('有效邮箱、昵称、密码和隐私协议同意,用户注册成功', async ({ request }) => {
    const email = uniqueEmail('newuser');
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 验证响应状态码
    expect(response.status()).toBe(201);

    // 验证响应体
    const body = await response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.email).toBe(email);
    expect(body.data.nickname).toBe('小明');
    expect(body.data).toHaveProperty('createdAt');
    expect(body.message).toBe('注册成功');

    // 验证 Set-Cookie 头包含 Session Cookie
    const setCookie = response.headers()['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('connect.sid'); // Fastify Session 默认 Cookie 名
  });

  test('昵称包含前后空格时,后端 trim 后存储', async ({ request }) => {
    const email = uniqueEmail('trimtest');
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '  小红  ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('小红'); // 前后空格已删除
  });

  test('昵称为 2 字符（边界值）,注册成功', async ({ request }) => {
    const email = uniqueEmail('min');
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: 'ab',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('ab');
  });

  test('昵称为 20 字符（边界值）,注册成功', async ({ request }) => {
    const email = uniqueEmail('max');
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '12345678901234567890',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('12345678901234567890');
  });

  test('密码为 8 字符（边界值）,注册成功', async ({ request }) => {
    const email = uniqueEmail('minpw');
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '测试',
        password: 'abcd1234',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);
  });

  test('密码为 20 字符（边界值）,注册成功', async ({ request }) => {
    const email = uniqueEmail('maxpw');
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '测试',
        password: '12345678901234567890',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);
  });
});

test.describe('用户注册功能 - API 异常场景', () => {
  test('邮箱字段缺失,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('昵称字段缺失,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('密码字段缺失,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('agreedToPrivacy 字段缺失,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('邮箱格式不正确,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'invalid-email',
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请输入有效的邮箱地址');
    expect(body.message).toBe('注册失败');
  });

  test('昵称少于 2 字符,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: 'a',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('昵称长度为 2-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('昵称超过 20 字符,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '123456789012345678901',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('昵称长度为 2-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('昵称为纯空格,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '   ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('昵称长度为 2-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('密码少于 8 字符,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: 'abc123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('密码长度为 8-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('密码超过 20 字符,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: '123456789012345678901',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('密码长度为 8-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('agreedToPrivacy 为 false,返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'test@example.com',
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: false,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请阅读并同意隐私协议');
    expect(body.message).toBe('注册失败');
  });

  test('邮箱已被注册,返回 409', async ({ request }) => {
    // 使用唯一邮箱作为前置条件：第一次注册
    const email = uniqueEmail('existing');
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '已存在',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 第二次注册（相同邮箱）
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小红',
        password: 'password456',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(409);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('该邮箱已被注册');
    expect(body.message).toBe('注册失败');
  });

  test('并发注册同一邮箱,仅一个成功,其他返回 409', async ({ request }) => {
    const email = `concurrent-${Date.now()}@example.com`;

    // 发起两个并发请求
    const [response1, response2] = await Promise.all([
      request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email,
          nickname: '用户1',
          password: 'password123',
          agreedToPrivacy: true,
        },
      }),
      request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email,
          nickname: '用户2',
          password: 'password123',
          agreedToPrivacy: true,
        },
      }),
    ]);

    // 验证一个成功，一个失败
    const statuses = [response1.status(), response2.status()].sort();
    expect(statuses).toEqual([201, 409]);

    // 验证失败的返回 409
    const failedResponse = response1.status() === 409 ? response1 : response2;
    const body = await failedResponse.json();
    expect(body.error).toBe('该邮箱已被注册');
  });

  test('数据库异常时,返回 500 且不暴露内部错误', async ({ request }) => {
    // 注意：此测试需要模拟数据库不可用场景，实际 E2E 测试中可能无法直接实现
    // 可通过停止数据库服务或在后端添加测试模式触发错误

    // 此处为示例代码，实际执行需要配合环境准备
    // 跳过该测试或在 CI 中配置专门的错误注入机制
    test.skip();
  });
});
