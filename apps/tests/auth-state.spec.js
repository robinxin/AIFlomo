import { test, expect } from '@playwright/test';

test.describe('全局认证状态管理', () => {
  test.describe('UI 测试场景 - 正常场景', () => {
    test('未登录用户访问需要认证的页面（如首页），自动跳转登录页', async ({ page }) => {
      // 直接访问首页（不登录）
      await page.goto('/');

      // 验证自动跳转到登录页
      await expect(page).toHaveURL('/login');
    });

    test('已登录用户访问登录页或注册页，自动跳转首页', async ({ page, request }) => {
      // 先注册并登录
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 尝试访问登录页
      await page.goto('/login');
      await expect(page).toHaveURL('/');

      // 尝试访问注册页
      await page.goto('/register');
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('边界场景', () => {
    test('注册成功后自动登录，无需二次输入密码', async ({ page, request }) => {
      await page.goto('/register');

      // 填写注册表单
      await page.fill('[data-testid="email-input"]', 'newuser@example.com');
      await page.fill('[data-testid="nickname-input"]', '新用户');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.check('[data-testid="privacy-checkbox"]');
      await page.click('[data-testid="submit-button"]');

      // 等待跳转到首页
      await expect(page).toHaveURL('/');

      // 验证用户已登录（调用 /api/auth/me）
      const response = await request.get('/api/auth/me');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.email).toBe('newuser@example.com');
      expect(body.data.nickname).toBe('新用户');
    });

    test('密码长度为 0 字符时提交登录，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
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
});
