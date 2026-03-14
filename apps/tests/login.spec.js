import { test, expect } from '@playwright/test';

test.describe('用户登录功能', () => {
  test.describe('UI 测试场景 - 正常场景', () => {
    test('输入正确的邮箱和密码，登录成功并跳转到首页', async ({ page, request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 登出（清除 session）
      await request.post('/api/auth/logout');

      await page.goto('/login');

      // 填写登录表单
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      // 点击登录按钮
      await page.click('[data-testid="submit-button"]');

      // 验证按钮状态
      await expect(page.locator('[data-testid="submit-button"]')).toHaveText('登录中...');
      await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();

      // 验证输入框不可编辑
      await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

      // 等待跳转到首页
      await expect(page).toHaveURL('/');
    });

    test('登录页面点击"立即注册"链接跳转到注册页', async ({ page }) => {
      await page.goto('/login');

      // 填写部分内容
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      // 点击立即注册
      await page.click('[data-testid="to-register"]');

      // 验证跳转到注册页
      await expect(page).toHaveURL('/register');

      // 验证登录页面内容已清空（通过返回登录页检查）
      await page.goto('/login');
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('');
      await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');
    });

    test('密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
      await page.goto('/login');

      // 输入密码
      await page.fill('[data-testid="password-input"]', 'password123');

      // 第一次点击眼睛图标 - 显示明文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'text');

      // 第二次点击眼睛图标 - 恢复密文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');
    });
  });

  test.describe('UI 测试场景 - 异常场景', () => {
    test('输入错误的邮箱或密码，表单顶部显示错误提示', async ({ page, request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 登出
      await request.post('/api/auth/logout');

      await page.goto('/login');

      // 输入错误密码
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="submit-button"]');

      // 验证错误提示
      await expect(page.locator('[data-testid="form-error"]')).toHaveText('邮箱或密码错误，请重试');

      // 验证表单状态恢复
      await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled();
      await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="password-input"]')).toBeEnabled();

      // 验证密码输入框已清空
      await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');

      // 验证邮箱输入框保持原内容
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('user@example.com');
    });

    test('输入不存在的邮箱，表单顶部显示统一错误提示', async ({ page }) => {
      await page.goto('/login');

      // 输入不存在的邮箱
      await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="submit-button"]');

      // 验证统一错误提示（不泄露"用户不存在"）
      await expect(page.locator('[data-testid="form-error"]')).toHaveText('邮箱或密码错误，请重试');

      // 验证密码输入框已清空
      await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');

      // 验证邮箱输入框保持原内容
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('nonexistent@example.com');
    });

    test('网络异常时，表单顶部显示网络错误提示', async ({ page, context }) => {
      await page.goto('/login');

      // 模拟网络异常（离线）
      await context.setOffline(true);

      // 填写表单并提交
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="submit-button"]');

      // 验证网络错误提示
      await expect(page.locator('[data-testid="form-error"]')).toHaveText('网络连接失败，请稍后重试');

      // 验证表单状态恢复
      await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled();
      await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="password-input"]')).toBeEnabled();

      // 恢复网络
      await context.setOffline(false);
    });
  });

  test.describe('API 测试场景 - 正常场景', () => {
    test('有效邮箱和密码，用户登录成功', async ({ request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 登出
      await request.post('/api/auth/logout');

      // 登录
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'user@example.com',
          password: 'password123',
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.email).toBe('user@example.com');
      expect(body.data.nickname).toBe('小明');
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.message).toBe('登录成功');

      // 验证 Set-Cookie 头
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
    });
  });

  test.describe('API 测试场景 - 异常场景', () => {
    test('邮箱字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
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

    test('密码字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
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

    test('邮箱不存在，返回 401 且不泄露具体原因', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
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

    test('密码错误，返回 401 且不泄露具体原因', async ({ request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 登出
      await request.post('/api/auth/logout');

      // 使用错误密码登录
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'user@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('邮箱或密码错误，请重试');
      expect(body.message).toBe('登录失败');
    });
  });
});
