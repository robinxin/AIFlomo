// E2E 测试：全局认证状态管理 - UI 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (全局认证状态管理 - UI 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8082';
const API_BASE_URL = BASE_URL.replace('8082', '3000');

test.describe('全局认证状态管理 - 正常场景', () => {
  test('App 启动时,已登录用户自动恢复登录状态', async ({ page, request }) => {
    // 前置条件：注册并登录
    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email: 'autorestoretest@example.com',
        nickname: '自动恢复',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    const loginResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'autorestoretest@example.com',
        password: 'password123',
      },
    });

    // 设置 Cookie
    const setCookie = loginResponse.headers()['set-cookie'];
    await page.context().addCookies([
      {
        name: 'connect.sid',
        value: setCookie.split('connect.sid=')[1].split(';')[0],
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 关闭并重新打开 App（刷新页面）
    await page.goto(`${BASE_URL}/`);

    // 验证加载状态
    await expect(page.locator('[data-testid="auth-loading"]')).toBeVisible({ timeout: 1000 });

    // 等待加载完成
    await expect(page.locator('[data-testid="auth-loading"]')).not.toBeVisible({ timeout: 5000 });

    // 验证直接进入首页（无跳转到登录页）
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('App 启动时,未登录用户跳转到登录页', async ({ page }) => {
    // 清除 Cookie（确保未登录状态）
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/`);

    // 验证加载状态
    await expect(page.locator('[data-testid="auth-loading"]')).toBeVisible({ timeout: 1000 });

    // 等待加载完成并跳转到登录页
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
  });

  test('未登录用户访问需要认证的页面（如首页）,自动跳转登录页', async ({ page }) => {
    // 清除 Cookie
    await page.context().clearCookies();

    // 直接访问首页
    await page.goto(`${BASE_URL}/`);

    // 验证跳转到登录页
    await page.waitForURL(`${BASE_URL}/login`);
  });

  test('已登录用户访问登录页或注册页,自动跳转首页', async ({ page, request }) => {
    // 前置条件：注册并登录
    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email: 'redirecttest@example.com',
        nickname: '重定向测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    const loginResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'redirecttest@example.com',
        password: 'password123',
      },
    });

    // 设置 Cookie
    const setCookie = loginResponse.headers()['set-cookie'];
    await page.context().addCookies([
      {
        name: 'connect.sid',
        value: setCookie.split('connect.sid=')[1].split(';')[0],
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 访问登录页
    await page.goto(`${BASE_URL}/login`);

    // 验证自动跳转到首页
    await page.waitForURL(`${BASE_URL}/`);

    // 访问注册页
    await page.goto(`${BASE_URL}/register`);

    // 验证自动跳转到首页
    await page.waitForURL(`${BASE_URL}/`);
  });
});

test.describe('全局认证状态管理 - 异常场景', () => {
  test('Session 过期后访问业务功能,自动跳转登录页', async ({ page, context }) => {
    // 模拟 GET /api/auth/me 返回 401（Session 过期）
    await context.route('**/api/auth/me', (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({
          data: null,
          error: '请先登录',
          message: '获取用户信息失败',
        }),
      });
    });

    // 访问首页
    await page.goto(`${BASE_URL}/`);

    // 验证跳转到登录页
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });

    // 验证显示提示（可选，根据前端实现）
    // await expect(page.locator('text=登录已过期，请重新登录')).toBeVisible();
  });

  test('GET /api/auth/me 请求超时或网络中断,前端降级为未登录状态', async ({ page, context }) => {
    // 模拟网络超时（5 秒未响应）
    await context.route('**/api/auth/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000)); // 超过 5 秒
      route.abort();
    });

    // 访问首页
    await page.goto(`${BASE_URL}/`);

    // 验证跳转到登录页（超时降级）
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 8000 });
  });
});
