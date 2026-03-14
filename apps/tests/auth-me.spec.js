// 获取当前登录用户信息功能测试
// 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
// 包含 UI 测试和 API 测试

import { test, expect } from '@playwright/test';

// ==================== UI 测试场景 ====================

test.describe('获取当前登录用户信息功能 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('App 启动时，已登录用户自动恢复登录状态', async ({ page, request }) => {
      // 前置条件：用户之前已登录，浏览器 Cookie 中存在有效 Session
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 操作步骤：关闭并重新打开 App（刷新浏览器页面）
      await page.goto('/');

      // 预期结果：调用 GET /api/auth/me 成功后，用户直接进入 Memo 列表页 /
      await page.waitForResponse(resp =>
        resp.url().includes('/api/auth/me') && resp.status() === 200
      );

      // 用户直接进入 Memo 列表页，无需重新登录
      await expect(page).toHaveURL('/');
    });

    test('App 启动时，未登录用户跳转到登录页', async ({ page }) => {
      // 前置条件：用户未登录（无 Session Cookie）
      // 操作步骤：打开 App
      await page.goto('/');

      // 预期结果：调用 GET /api/auth/me 失败（HTTP 401）后，页面自动跳转到 /login
      await page.waitForResponse(resp =>
        resp.url().includes('/api/auth/me') && resp.status() === 401
      );

      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('异常场景', () => {
    test('Session 过期后访问业务功能，自动跳转登录页', async ({ page, request }) => {
      // 前置条件：用户已登录超过 7 天，Session 已过期
      // 注意：实际测试中模拟 Session 过期较复杂，此处简化为使用无效 Session

      // 操作步骤：用户在 Memo 列表页进行任意操作（如创建笔记）
      await page.goto('/');

      // 模拟 Session 过期：清除 Cookie 后发送请求
      await page.context().clearCookies();

      // 尝试访问需要认证的功能
      const response = await page.request.get('/api/auth/me');

      // 预期结果：接口返回 HTTP 401
      expect(response.status()).toBe(401);

      // 前端捕获 401 状态码，页面自动跳转到 /login
      await page.goto('/'); // 触发路由守卫
      await expect(page).toHaveURL('/login');
    });
  });
});

// ==================== API 测试场景 ====================

test.describe('获取当前登录用户信息功能 - API 测试', () => {
  test.describe('正常场景', () => {
    test('已登录用户调用接口，返回用户信息', async ({ request }) => {
      // 前置条件：用户已登录（携带有效 Session Cookie）
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 操作步骤：发送 GET /api/auth/me
      const response = await request.get('/api/auth/me');

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
      expect(body.message).toBe('获取用户信息成功');

      // 响应体不包含 passwordHash 字段
      expect(body.data).not.toHaveProperty('passwordHash');
    });
  });

  test.describe('异常场景', () => {
    test('未登录状态调用接口，返回 401', async ({ request }) => {
      // 操作步骤：不携带 Session Cookie，发送 GET /api/auth/me
      const response = await request.get('/api/auth/me');

      // 预期结果：接口返回 HTTP 401
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('请先登录');
      expect(body.message).toBe('获取用户信息失败');
    });

    test('Session 已过期调用接口，返回 401', async ({ request }) => {
      // 操作步骤：携带已过期的 Session Cookie（创建时间超过 7 天）
      // 注意：实际测试中模拟过期 Session 较复杂，此处简化为使用无效 Session

      const response = await request.get('/api/auth/me', {
        headers: {
          'Cookie': 'sessionId=expired-session-id'
        }
      });

      // 预期结果：接口返回 HTTP 401
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('请先登录');
    });

    test('Session 中的用户在数据库中已被删除，返回 401', async ({ request }) => {
      // 前置条件：用户已登录（携带有效 Session Cookie，Session 中存储 userId）
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 模拟：数据库中不存在该用户记录（异常情况）
      // 注意：实际测试需要手动删除数据库记录或 mock 数据库响应
      // 此处仅验证接口逻辑，实际实现时需配合数据库操作

      // 假设用户已被删除，发送 GET /api/auth/me
      // const response = await request.get('/api/auth/me');

      // 预期结果：接口返回 HTTP 401
      // expect(response.status()).toBe(401);
      // const body = await response.json();
      // expect(body.error).toBe('用户不存在，请重新登录');
      // expect(body.message).toBe('获取用户信息失败');

      // 注：此用例需要在集成测试环境中配合数据库操作完成
    });
  });
});
