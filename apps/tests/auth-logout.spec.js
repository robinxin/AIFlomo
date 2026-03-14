// 用户登出功能测试
// 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
// 包含 UI 测试和 API 测试

import { test, expect } from '@playwright/test';

// ==================== UI 测试场景 ====================

test.describe('用户登出功能 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('已登录用户在个人中心点击登出，Session 销毁并跳转登录页', async ({ page, request }) => {
      // 前置条件：用户已登录
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 停留在个人中心页面（未来实现，此处用首页代替）
      await page.goto('/');

      // 操作步骤：点击"登出"按钮（假设按钮已在页面上）
      const responsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/auth/logout') && resp.status() === 200
      );

      await page.click('[data-testid="logout-button"]');

      await responsePromise;

      // 预期结果：页面跳转到 /login 登录页面
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('异常场景', () => {
    test('未登录用户访问登出接口，返回 401', async ({ page }) => {
      // 前置条件：用户未登录（无有效 Session）
      await page.goto('/login');

      // 操作步骤：前端手动调用 POST /api/auth/logout（绕过 UI）
      const response = await page.request.post('/api/auth/logout');

      // 预期结果：接口返回 HTTP 401
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('请先登录');
      expect(body.message).toBe('登出失败');
    });
  });
});

// ==================== API 测试场景 ====================

test.describe('用户登出功能 - API 测试', () => {
  test.describe('正常场景', () => {
    test('已登录用户调用登出接口，Session 销毁成功', async ({ request }) => {
      // 前置条件：用户已登录（携带有效 Session Cookie）
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 操作步骤：发送 POST /api/auth/logout
      const response = await request.post('/api/auth/logout');

      // 预期结果：接口返回 HTTP 200
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.message).toBe('已成功登出');

      // 响应 Set-Cookie 头清除 Session Cookie
      const headers = response.headers();
      expect(headers['set-cookie']).toBeTruthy();

      // 验证 Session 已被销毁：再次调用需要认证的接口应返回 401
      const meResponse = await request.get('/api/auth/me');
      expect(meResponse.status()).toBe(401);
    });
  });

  test.describe('异常场景', () => {
    test('未登录状态调用登出接口，返回 401', async ({ request }) => {
      // 操作步骤：不携带 Session Cookie，发送 POST /api/auth/logout
      const response = await request.post('/api/auth/logout');

      // 预期结果：接口返回 HTTP 401
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('请先登录');
      expect(body.message).toBe('登出失败');
    });

    test('Session 已过期调用登出接口，返回 401', async ({ request }) => {
      // 操作步骤：携带已过期的 Session Cookie（创建时间超过 7 天）
      // 注意：实际测试中模拟过期 Session 较复杂，此处仅验证逻辑
      // 可以通过 Cookie 手动设置过期时间或等待 Session 自然过期

      // 模拟：使用无效的 Session Cookie
      const response = await request.post('/api/auth/logout', {
        headers: {
          'Cookie': 'sessionId=invalid-session-id'
        }
      });

      // 预期结果：接口返回 HTTP 401
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('请先登录');
    });
  });
});
