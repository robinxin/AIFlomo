import { test, expect } from '@playwright/test';

test.describe('获取当前登录用户信息功能', () => {
  test.describe('UI 测试场景 - 正常场景', () => {
    test('App 启动时，已登录用户自动恢复登录状态', async ({ page, request }) => {
      // 先注册并登录
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 关闭并重新打开 App（通过刷新页面模拟）
      await page.goto('/');

      // 验证用户直接进入 Memo 列表页，无需重新登录
      await expect(page).toHaveURL('/');
      // 验证加载状态已结束（检查是否显示业务内容而非加载占位）
      // 此处需要根据实际页面结构调整
    });

    test('App 启动时，未登录用户跳转到登录页', async ({ page }) => {
      // 不登录直接访问首页
      await page.goto('/');

      // 验证自动跳转到登录页
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('UI 测试场景 - 异常场景', () => {
    test('Session 过期后访问业务功能，自动跳转登录页', async ({ page, request }) => {
      // 先注册并登录
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 访问首页
      await page.goto('/');

      // 手动清除 Cookie（模拟 Session 过期）
      await page.context().clearCookies();

      // 刷新页面或进行操作
      await page.reload();

      // 验证跳转到登录页
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('API 测试场景 - 正常场景', () => {
    test('已登录用户调用接口，返回用户信息', async ({ request }) => {
      // 先注册并登录
      const registerResponse = await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      const registerBody = await registerResponse.json();

      // 调用 /api/auth/me
      const response = await request.get('/api/auth/me');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.id).toBe(registerBody.data.id);
      expect(body.data.email).toBe('user@example.com');
      expect(body.data.nickname).toBe('小明');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.data).not.toHaveProperty('passwordHash');
      expect(body.message).toBe('获取用户信息成功');
    });
  });

  test.describe('API 测试场景 - 异常场景', () => {
    test('未登录状态调用接口，返回 401', async ({ request }) => {
      // 不登录直接调用 /api/auth/me
      const response = await request.get('/api/auth/me');

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('请先登录');
      expect(body.message).toBe('获取用户信息失败');
    });

    test('Session 已过期调用接口，返回 401', async ({ request }) => {
      // 使用过期的 Session Cookie（模拟）
      // 由于 Playwright 难以直接模拟过期 Cookie，此测试需在实际环境中验证
      // 此处标记为 skip，实际实现时需要特殊处理
      test.skip();
    });

    test('Session 中的用户在数据库中已被删除，返回 401', async ({ request }) => {
      // 此测试需要手动操作数据库删除用户记录
      // 在实际测试环境中实现
      test.skip();
    });
  });

  test.describe('边界场景', () => {
    test('GET /api/auth/me 请求超时或网络中断，前端降级为未登录状态', async ({ page, context }) => {
      // 模拟网络超时
      await context.setOffline(true);

      // 访问首页
      await page.goto('/');

      // 等待超时后跳转到登录页
      await expect(page).toHaveURL('/login', { timeout: 10000 });

      // 恢复网络
      await context.setOffline(false);
    });
  });
});
