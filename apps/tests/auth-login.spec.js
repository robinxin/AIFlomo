// 用户登录功能测试
// 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
// 包含 UI 测试和 API 测试

import { test, expect } from '@playwright/test';

// ==================== UI 测试场景 ====================

test.describe('用户登录功能 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('输入正确的邮箱和密码，登录成功并跳转到首页', async ({ page, request }) => {
      // 前置条件：数据库中存在邮箱为 user@example.com、密码为 password123 的用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 访问登录页面
      await page.goto('/login');

      // 操作步骤
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      // 监听 API 请求
      const responsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/auth/login') && resp.status() === 200
      );

      await page.click('[data-testid="submit-button"]');

      // 预期结果：按钮文字变为"登录中..."且禁用
      await expect(page.locator('[data-testid="submit-button"]')).toHaveText('登录中...');
      await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();

      // 所有输入框变为不可编辑状态
      await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

      // 等待接口返回成功
      await responsePromise;

      // 页面自动跳转到 Memo 列表页 /
      await expect(page).toHaveURL('/');
    });

    test('登录页面点击"立即注册"链接跳转到注册页', async ({ page }) => {
      // 前置条件：用户停留在登录页面，已输入部分内容
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'test1234');

      // 操作步骤
      await page.click('[data-testid="register-link"]');

      // 预期结果：页面跳转到 /register 注册页面
      await expect(page).toHaveURL('/register');
    });

    test('密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
      // 前置条件：用户停留在登录页面
      await page.goto('/login');

      // 操作步骤
      await page.fill('[data-testid="password-input"]', 'password123');

      // 第一次点击：密码变为明文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'text');

      // 第二次点击：密码恢复密文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');
    });
  });

  test.describe('异常场景', () => {
    test('输入错误的邮箱或密码，表单顶部显示错误提示', async ({ page, request }) => {
      // 前置条件：数据库中存在邮箱为 user@example.com 的用户，密码为 password123
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      await page.goto('/login');

      // 操作步骤：输入错误的密码
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');

      const responsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/auth/login') && resp.status() === 401
      );

      await page.click('[data-testid="submit-button"]');

      await responsePromise;

      // 预期结果
      await expect(page.locator('[data-testid="form-error"]')).toContainText('邮箱或密码错误，请重试');
      await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
      await expect(page.locator('[data-testid="password-input"]')).toHaveValue(''); // 密码输入框自动清空
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('user@example.com'); // 邮箱保持原内容
    });

    test('输入不存在的邮箱，表单顶部显示统一错误提示', async ({ page }) => {
      await page.goto('/login');

      // 操作步骤：输入不存在的邮箱
      await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      const responsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/auth/login') && resp.status() === 401
      );

      await page.click('[data-testid="submit-button"]');

      await responsePromise;

      // 预期结果：统一错误提示（不泄露"用户不存在"）
      await expect(page.locator('[data-testid="form-error"]')).toContainText('邮箱或密码错误，请重试');
      await expect(page.locator('[data-testid="password-input"]')).toHaveValue(''); // 密码清空
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('nonexistent@example.com'); // 邮箱保持
    });

    test('网络异常时，表单顶部显示网络错误提示', async ({ page, context, request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '测试',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      await page.goto('/login');

      // 填写有效邮箱和密码
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      // 模拟网络中断
      await context.setOffline(true);

      await page.click('[data-testid="submit-button"]');

      // 预期结果
      await expect(page.locator('[data-testid="form-error"]')).toContainText(/网络连接失败|请稍后重试/);
      await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
      // 已输入的表单内容保持不变
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('test@example.com');
    });
  });
});

// ==================== API 测试场景 ====================

test.describe('用户登录功能 - API 测试', () => {
  test.describe('正常场景', () => {
    test('有效邮箱和密码，用户登录成功', async ({ request }) => {
      // 前置条件：数据库中存在邮箱为 user@example.com、密码哈希对应明文 password123 的用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 操作步骤
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'user@example.com',
          password: 'password123'
        }
      });

      // 预期结果：接口返回 HTTP 200
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body.data).toMatchObject({
        email: 'user@example.com',
        nickname: '小明'
      });
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.message).toBe('登录成功');

      // 响应 Set-Cookie 头包含有效 Session Cookie
      const headers = response.headers();
      expect(headers['set-cookie']).toBeTruthy();
    });
  });

  test.describe('异常场景', () => {
    test('邮箱字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          password: 'password123'
        }
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
          email: 'user@example.com'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('请求参数格式错误');
    });

    test('邮箱不存在，返回 401 且不泄露具体原因', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'nonexistent@example.com',
          password: 'password123'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      // 统一提示，不区分"用户不存在"和"密码错误"
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
          agreedToPrivacy: true
        }
      });

      // 使用错误的密码登录
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'user@example.com',
          password: 'wrongpassword'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('邮箱或密码错误，请重试');
    });
  });
});
