import { test, expect } from '@playwright/test';

/**
 * 全局认证状态管理 - UI 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

test.describe('全局认证状态管理 - UI 正常场景', () => {
  test('未登录用户访问需要认证的页面（如首页），自动跳转登录页', async ({ page }) => {
    // 直接访问首页
    await page.goto('/');

    // 等待自动跳转到登录页
    await page.waitForURL('/login');

    // 验证登录页面显示
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
  });

  test('已登录用户访问登录页或注册页，自动跳转首页', async ({ page, request }) => {
    // 先注册并登录
    const registerResponse = await request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: 'redirect@example.com',
        nickname: '重定向测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 提取 Session Cookie
    const cookies = registerResponse.headers()['set-cookie'];

    // 设置 Cookie 到浏览器
    const sessionCookie = cookies.split(';')[0];
    const [name, value] = sessionCookie.split('=');
    await page.context().addCookies([{
      name,
      value,
      domain: 'localhost',
      path: '/',
    }]);

    // 访问登录页
    await page.goto('/login');

    // 等待自动跳转到首页
    await page.waitForURL('/');
  });
});

test.describe('获取当前登录用户信息 - UI 场景', () => {
  test('App 启动时，已登录用户自动恢复登录状态', async ({ page, request }) => {
    // 先注册并登录
    const registerResponse = await request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: 'restore@example.com',
        nickname: '恢复状态',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 提取 Session Cookie
    const cookies = registerResponse.headers()['set-cookie'];

    // 设置 Cookie 到浏览器
    const sessionCookie = cookies.split(';')[0];
    const [name, value] = sessionCookie.split('=');
    await page.context().addCookies([{
      name,
      value,
      domain: 'localhost',
      path: '/',
    }]);

    // 重新加载页面（模拟 App 启动）
    await page.goto('/');

    // 验证直接进入首页，无需重新登录
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=登录')).not.toBeVisible();
  });

  test('App 启动时，未登录用户跳转到登录页', async ({ page }) => {
    // 清除所有 Cookie
    await page.context().clearCookies();

    // 打开 App
    await page.goto('/');

    // 验证自动跳转到登录页
    await page.waitForURL('/login');
  });
});

test.describe('Session 过期场景', () => {
  test('Session 过期后访问业务功能，自动跳转登录页', async ({ page }) => {
    // 设置一个过期的 Session Cookie
    await page.context().addCookies([{
      name: 'session',
      value: 'expired-session-id',
      domain: 'localhost',
      path: '/',
    }]);

    // 访问需要登录的页面
    await page.goto('/');

    // 等待 API 返回 401
    await page.waitForResponse(response =>
      response.url().includes('/api/auth/me') && response.status() === 401
    );

    // 验证自动跳转到登录页
    await page.waitForURL('/login');

    // 验证提示信息
    await expect(page.locator('text=登录已过期，请重新登录')).toBeVisible();
  });
});
