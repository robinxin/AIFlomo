// 全局认证状态管理测试
// 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
// 包含 UI 测试和边界场景测试

import { test, expect } from '@playwright/test';

// ==================== UI 测试场景 ====================

test.describe('全局认证状态管理 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('未登录用户访问需要认证的页面（如首页），自动跳转登录页', async ({ page }) => {
      // 前置条件：用户未登录（无有效 Session）
      // 操作步骤：直接访问 / Memo 列表页 URL
      await page.goto('/');

      // 预期结果：AuthContext 初始化时调用 GET /api/auth/me，返回 HTTP 401
      await page.waitForResponse(resp =>
        resp.url().includes('/api/auth/me') && resp.status() === 401
      );

      // 页面自动跳转到 /login 登录页面
      await expect(page).toHaveURL('/login');
    });

    test('已登录用户访问登录页或注册页，自动跳转首页', async ({ page, request }) => {
      // 前置条件：用户已登录（AuthContext.isAuthenticated=true）
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 操作步骤：用户手动访问 /login URL
      await page.goto('/login');

      // 预期结果：页面自动跳转到 / Memo 列表页
      await expect(page).toHaveURL('/');

      // 操作步骤：用户手动访问 /register URL
      await page.goto('/register');

      // 预期结果：页面自动跳转到 / Memo 列表页
      await expect(page).toHaveURL('/');
    });
  });
});

// ==================== 边界场景与特殊情况 ====================

test.describe('边界场景与特殊情况 - API 测试', () => {
  test.describe('正常场景', () => {
    test('注册成功后自动登录，无需二次输入密码', async ({ request }) => {
      // 操作步骤：发送 POST /api/auth/register
      const registerResponse = await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 接口返回 HTTP 201 且包含 Session Cookie
      expect(registerResponse.status()).toBe(201);
      const headers = registerResponse.headers();
      expect(headers['set-cookie']).toBeTruthy();

      // 立即发送 GET /api/auth/me（使用注册接口返回的 Cookie）
      const meResponse = await request.get('/api/auth/me');

      // 预期结果：GET /api/auth/me 返回 HTTP 200
      expect(meResponse.status()).toBe(200);
      const body = await meResponse.json();
      expect(body.data).toMatchObject({
        email: 'user@example.com',
        nickname: '小明'
      });

      // 无需再次调用 POST /api/auth/login
    });
  });

  test.describe('异常场景', () => {
    test('GET /api/auth/me 请求超时或网络中断，前端降级为未登录状态', async ({ page }) => {
      // 操作步骤：App 启动时调用 GET /api/auth/me
      // 模拟网络超时（5 秒未响应）

      // 设置路由拦截，模拟请求超时
      await page.route('**/api/auth/me', route => {
        // 延迟 6 秒响应（超过超时时间）
        setTimeout(() => route.abort(), 6000);
      });

      await page.goto('/');

      // 预期结果：前端在 5 秒后超时降级
      // AuthContext 设置 isAuthenticated=false, loading=false
      // 页面跳转到 /login 登录页面
      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });

    test('密码长度为 0 字符时提交登录，返回 400', async ({ request }) => {
      // 操作步骤：发送 POST /api/auth/login，密码为空字符串
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'user@example.com',
          password: ''
        }
      });

      // 预期结果：接口返回 HTTP 400
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('请求参数格式错误');
      expect(body.message).toBe('登录失败');
    });
  });
});

// ==================== 集成测试：完整用户旅程 ====================

test.describe('完整用户旅程 - E2E 集成测试', () => {
  test('用户注册 → 自动登录 → 刷新页面保持登录 → 登出 → 重新登录', async ({ page }) => {
    // 1. 用户访问注册页面
    await page.goto('/register');

    // 2. 填写注册表单
    await page.fill('[data-testid="email-input"]', 'journey@example.com');
    await page.fill('[data-testid="nickname-input"]', '旅程用户');
    await page.fill('[data-testid="password-input"]', 'journey123');
    await page.check('[data-testid="privacy-checkbox"]');

    // 3. 提交注册
    await page.click('[data-testid="submit-button"]');

    // 4. 注册成功，自动登录并跳转到首页
    await expect(page).toHaveURL('/');

    // 5. 刷新页面，验证登录状态保持
    await page.reload();
    await page.waitForResponse(resp =>
      resp.url().includes('/api/auth/me') && resp.status() === 200
    );
    await expect(page).toHaveURL('/');

    // 6. 点击登出按钮
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/login');

    // 7. 使用相同账号重新登录
    await page.fill('[data-testid="email-input"]', 'journey@example.com');
    await page.fill('[data-testid="password-input"]', 'journey123');
    await page.click('[data-testid="submit-button"]');

    // 8. 登录成功，跳转到首页
    await expect(page).toHaveURL('/');
  });

  test('未登录用户尝试访问受保护页面，自动重定向到登录页', async ({ page }) => {
    // 1. 清除所有 Cookie（确保未登录）
    await page.context().clearCookies();

    // 2. 尝试直接访问首页（受保护页面）
    await page.goto('/');

    // 3. AuthContext 调用 GET /api/auth/me 失败
    await page.waitForResponse(resp =>
      resp.url().includes('/api/auth/me') && resp.status() === 401
    );

    // 4. 自动重定向到登录页
    await expect(page).toHaveURL('/login');

    // 5. 完成登录后可正常访问首页
    const response = await page.request.post('/api/auth/register', {
      data: {
        email: 'protected@example.com',
        nickname: '保护',
        password: 'protected123',
        agreedToPrivacy: true
      }
    });

    // 设置 Cookie
    const cookies = response.headers()['set-cookie'];
    if (cookies) {
      await page.context().addCookies([{
        name: 'sessionId',
        value: cookies.split(';')[0].split('=')[1],
        domain: 'localhost',
        path: '/'
      }]);
    }

    await page.goto('/');
    await expect(page).toHaveURL('/');
  });
});
