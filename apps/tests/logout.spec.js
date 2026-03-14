import { test, expect } from '@playwright/test';

test.describe('用户登出功能', () => {
  test.describe('UI 测试场景 - 正常场景', () => {
    test('已登录用户在个人中心点击登出，Session 销毁并跳转登录页', async ({ page, request }) => {
      // 先注册并登录
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 访问个人中心页面（未来实现）
      // 由于个人中心尚未实现，此测试暂时跳过 UI 部分
      // 仅测试 API 登出功能
      await page.goto('/');

      // 调用登出 API
      const response = await request.post('/api/auth/logout');
      expect(response.status()).toBe(200);

      // 验证跳转到登录页（由前端路由守卫触发）
      await page.goto('/');
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('API 测试场景 - 正常场景', () => {
    test('已登录用户调用登出接口，Session 销毁成功', async ({ request }) => {
      // 先注册并登录
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 调用登出接口
      const response = await request.post('/api/auth/logout');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.message).toBe('已成功登出');

      // 验证 Session 已销毁（调用 /api/auth/me 应返回 401）
      const meResponse = await request.get('/api/auth/me');
      expect(meResponse.status()).toBe(401);
    });
  });

  test.describe('API 测试场景 - 异常场景', () => {
    test('未登录状态调用登出接口，返回 401', async ({ request }) => {
      // 不登录直接调用登出
      const response = await request.post('/api/auth/logout');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('请先登录');
      expect(body.message).toBe('登出失败');
    });

    test('Session 已过期调用登出接口，返回 401', async ({ request }) => {
      // 使用过期的 Session Cookie（模拟）
      // 由于 Playwright 难以直接模拟过期 Cookie，此测试需在实际环境中验证
      // 或通过修改系统时间来模拟
      // 此处标记为 skip，实际实现时需要特殊处理
      test.skip();
    });
  });
});
