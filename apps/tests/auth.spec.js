import { test, expect } from '@playwright/test';

/**
 * 用户认证测试
 * 对应测试用例文档：§ 用户认证
 */

test.describe('用户认证 - UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 清除可能存在的 Session
    await page.context().clearCookies();
  });

  test.describe('正常场景', () => {
    test('用户在登录页输入有效邮箱和密码，成功登录并跳转到笔记主页', async ({ page }) => {
      await page.goto('/login');

      // 输入邮箱和密码
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '12345678');

      // 点击登录按钮
      await page.click('button:has-text("登录")');

      // 等待跳转
      await page.waitForURL('/memo');

      // 验证成功提示
      await expect(page.locator('text=登录成功')).toBeVisible();

      // 验证 Session Cookie 已设置
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name.includes('session'));
      expect(sessionCookie).toBeDefined();
    });

    test('用户在注册页输入有效信息，成功注册并自动登录', async ({ page }) => {
      const timestamp = Date.now();
      const email = `newuser${timestamp}@example.com`;

      await page.goto('/register');

      // 填写注册信息
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="nickname"]', '测试用户');
      await page.fill('input[name="password"]', '12345678');

      // 点击注册按钮
      await page.click('button:has-text("注册")');

      // 等待跳转到笔记页
      await page.waitForURL('/memo');

      // 验证成功提示
      await expect(page.locator('text=注册成功')).toBeVisible();

      // 验证右上角显示昵称
      await expect(page.locator('text=测试用户')).toBeVisible();
    });

    test('用户在笔记主页点击登出，返回登录页', async ({ page }) => {
      // 先登录
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '12345678');
      await page.click('button:has-text("登录")');
      await page.waitForURL('/memo');

      // 点击用户头像/昵称
      await page.click('[data-testid="user-menu"]');

      // 点击登出
      await page.click('text=登出');

      // 验证跳转到登录页
      await page.waitForURL('/login');

      // 验证提示
      await expect(page.locator('text=已登出')).toBeVisible();

      // 验证 Session Cookie 被清除
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name.includes('session'));
      expect(sessionCookie).toBeUndefined();
    });
  });

  test.describe('异常场景', () => {
    test('未登录用户直接访问 /memo，自动跳转登录页', async ({ page }) => {
      await page.goto('/memo');

      // 验证重定向到登录页
      await page.waitForURL('/login');

      // 验证提示
      await expect(page.locator('text=请先登录')).toBeVisible();
    });

    test('登录页邮箱格式错误，前端给出错误提示', async ({ page }) => {
      await page.goto('/login');

      // 输入无效邮箱
      await page.fill('input[name="email"]', 'notanemail');
      await page.fill('input[name="password"]', '12345678');
      await page.click('button:has-text("登录")');

      // 验证错误提示
      await expect(page.locator('text=请输入有效邮箱')).toBeVisible();
    });

    test('登录页密码长度不足 8 字符，前端给出错误提示', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '123');
      await page.click('button:has-text("登录")');

      // 验证错误提示
      await expect(page.locator('text=密码至少 8 个字符')).toBeVisible();
    });

    test('登录页邮箱或密码错误，后端返回错误提示', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button:has-text("登录")');

      // 验证错误提示
      await expect(page.locator('text=邮箱或密码错误')).toBeVisible();

      // 验证停留在登录页
      await expect(page).toHaveURL('/login');
    });

    test('注册页邮箱已被占用，后端返回错误提示', async ({ page }) => {
      await page.goto('/register');

      // 使用已存在的邮箱
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="nickname"]', '测试');
      await page.fill('input[name="password"]', '12345678');
      await page.click('button:has-text("注册")');

      // 验证错误提示
      await expect(page.locator('text=该邮箱已被注册')).toBeVisible();

      // 验证停留在注册页
      await expect(page).toHaveURL('/register');
    });
  });
});

test.describe('用户认证 - API 测试', () => {
  test.describe('正常场景', () => {
    test('有效邮箱和密码注册新用户，返回 201', async ({ request }) => {
      const timestamp = Date.now();
      const email = `new${timestamp}@example.com`;

      const response = await request.post('/api/auth/register', {
        data: {
          email,
          password: '12345678',
          nickname: '测试用户'
        }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe(email);
      expect(body.data.nickname).toBe('测试用户');
      expect(body.message).toBe('注册成功');

      // 验证 Set-Cookie 响应头
      const setCookie = response.headers()['set-cookie'];
      expect(setCookie).toBeTruthy();
    });

    test('有效邮箱和密码登录，返回 200 并设置 Session', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: '12345678'
        }
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe('test@example.com');
      expect(body.message).toBe('登录成功');

      // 验证 Set-Cookie
      const setCookie = response.headers()['set-cookie'];
      expect(setCookie).toBeTruthy();
    });

    test('已登录用户调用登出接口，Session 被销毁', async ({ request }) => {
      // 先登录
      const loginRes = await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: '12345678'
        }
      });
      expect(loginRes.ok()).toBeTruthy();

      // 登出
      const response = await request.post('/api/auth/logout');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.message).toBe('已登出');

      // 验证 Session 被清除
      const setCookie = response.headers()['set-cookie'];
      expect(setCookie).toContain('Max-Age=0');
    });

    test('已登录用户获取当前用户信息，返回 200', async ({ request }) => {
      // 先登录
      await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: '12345678'
        }
      });

      // 获取当前用户信息
      const response = await request.get('/api/auth/me');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe('test@example.com');
      expect(body.message).toBe('ok');
    });
  });

  test.describe('异常场景', () => {
    test('注册时邮箱格式错误，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'notanemail',
          password: '12345678',
          nickname: '测试'
        }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('请求参数不合法');
    });

    test('注册时密码长度不足 8 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          password: '123',
          nickname: '测试'
        }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    test('注册时邮箱已存在，返回 409', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          password: '12345678',
          nickname: '测试'
        }
      });

      expect(response.status()).toBe(409);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('EMAIL_EXISTS');
      expect(body.message).toBe('该邮箱已被注册');
    });

    test('登录时邮箱或密码错误，返回 401', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('INVALID_CREDENTIALS');
      expect(body.message).toBe('邮箱或密码错误');
    });

    test('未登录状态下访问 /api/auth/me，返回 401', async ({ request }) => {
      const response = await request.get('/api/auth/me');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });
  });
});
