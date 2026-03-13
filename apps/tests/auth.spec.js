/**
 * 认证状态管理 E2E 测试
 *
 * 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
 * 覆盖模块:
 *   - 用户登出功能 — UI 测试场景 & API 测试场景
 *   - 获取当前登录用户信息功能 — UI 测试场景 & API 测试场景
 *   - 全局认证状态管理 — UI 测试场景
 *   - 边界场景与特殊情况 — API 测试场景
 *
 * UI 测试使用 page fixture（浏览器页面交互）
 * API 测试使用 request fixture（直接 HTTP 请求）
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 测试辅助常量与工具函数
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || 'http://localhost:8082';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

function uniqueEmail(prefix = 'auth') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/**
 * 通过 API 注册并登录，返回携带 Session Cookie 的 APIRequestContext 可用 headers。
 * 在 API 测试中，直接用 request.post 注册即可获得 cookie，Playwright 的 request
 * context 会自动保持 cookie。
 */
async function registerAndGetSession(request, { email, nickname, password } = {}) {
  email = email || uniqueEmail('session');
  nickname = nickname || '会话测试用户';
  password = password || 'password123';

  const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
    data: { email, nickname, password, agreedToPrivacy: true },
  });
  return { email, nickname, password, response };
}

/**
 * 在浏览器页面中通过 UI 完成登录，等待跳转到首页。
 */
async function loginViaUI(page, { email, password }) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-submit').click();
  await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// 用户登出功能 — UI 测试场景
// ---------------------------------------------------------------------------

test.describe('用户登出 — UI 测试', () => {
  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-LOGOUT-UI-001: 已登录用户点击登出，Session 销毁并跳转登录页', async ({ page, request }) => {
    // 注册并获取测试用户
    const email = uniqueEmail('logout_ui');
    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, nickname: '登出测试', password: 'password123', agreedToPrivacy: true },
    });

    // 通过 UI 登录
    await loginViaUI(page, { email, password: 'password123' });
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // 点击登出按钮（位于个人中心或导航栏）
    await page.getByTestId('btn-logout').click();

    // 验证跳转到登录页
    await expect(page).toHaveURL(`${BASE_URL}/login`, { timeout: 8000 });

    // 验证 Session Cookie 已被清除（尝试访问需要认证的页面会被重定向）
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-LOGOUT-UI-002: 未登录用户访问登出接口，返回 401', async ({ request }) => {
    // 使用全新的无 Cookie 的 request context（不依赖任何已注册账号的 session）
    const response = await request.post(`${API_BASE_URL}/api/auth/logout`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('登出失败');
  });
});

// ---------------------------------------------------------------------------
// 用户登出功能 — API 测试场景
// ---------------------------------------------------------------------------

test.describe('用户登出 — API 测试', () => {
  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-LOGOUT-API-001: 已登录用户调用登出接口，Session 销毁成功', async ({ request }) => {
    // 先注册（自动获得 session cookie）
    await registerAndGetSession(request);

    // 调用登出
    const response = await request.post(`${API_BASE_URL}/api/auth/logout`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.message).toBe('已成功登出');

    // 验证 Session 已失效：再次调用 /api/auth/me 应返回 401
    const meResponse = await request.get(`${API_BASE_URL}/api/auth/me`);
    expect(meResponse.status()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-LOGOUT-API-002: 未登录状态调用登出接口，返回 401', async ({ request }) => {
    // 使用全新的 request context（无任何 Cookie）
    // 注意：Playwright 的 request fixture 在每个 test 内共享同一 context，
    // 为确保无 Cookie，此测试不依赖任何前置登录步骤
    const freshRequest = request;

    const response = await freshRequest.post(`${API_BASE_URL}/api/auth/logout`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('登出失败');
  });

  test('TC-LOGOUT-API-003: Session 已过期调用登出接口，返回 401', async ({ request }) => {
    // 使用一个伪造的过期 Session Cookie 调用登出
    const response = await request.post(`${API_BASE_URL}/api/auth/logout`, {
      headers: {
        Cookie: 'sessionId=expired_fake_session_id_12345',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('登出失败');
  });
});

// ---------------------------------------------------------------------------
// 获取当前登录用户信息 — UI 测试场景
// ---------------------------------------------------------------------------

test.describe('获取当前登录用户信息 — UI 测试', () => {
  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-ME-UI-001: App 启动时，已登录用户自动恢复登录状态', async ({ page, request }) => {
    const email = uniqueEmail('restore_session');

    // 注册并通过 UI 登录（建立浏览器 Cookie）
    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, nickname: '会话恢复', password: 'password123', agreedToPrivacy: true },
    });
    await loginViaUI(page, { email, password: 'password123' });

    // 刷新页面（模拟重新打开 App）
    await page.reload();

    // 验证仍在首页（登录状态已恢复，无需重新登录）
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 10000 });
  });

  test('TC-ME-UI-002: App 启动时，未登录用户跳转到登录页', async ({ page }) => {
    // 确保没有任何 Cookie（清除浏览器存储）
    await page.context().clearCookies();

    // 访问首页
    await page.goto(`${BASE_URL}/`);

    // 验证被重定向到登录页
    await expect(page).toHaveURL(`${BASE_URL}/login`, { timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-ME-UI-003: Session 过期后访问业务功能，自动跳转登录页', async ({ page, request }) => {
    const email = uniqueEmail('session_expire');

    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, nickname: '过期测试', password: 'password123', agreedToPrivacy: true },
    });
    await loginViaUI(page, { email, password: 'password123' });

    // 拦截下一次 API 请求，模拟返回 401（Session 过期）
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      // 只拦截非 auth/me 的业务请求，注入 401 响应
      if (!request.url().includes('/api/auth/me')) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            data: null,
            error: '请先登录',
            message: '未授权访问',
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 触发一个业务操作（如访问首页刷新触发 API 调用）
    await page.reload();

    // 验证被跳转到登录页
    await expect(page).toHaveURL(`${BASE_URL}/login`, { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 获取当前登录用户信息 — API 测试场景
// ---------------------------------------------------------------------------

test.describe('获取当前登录用户信息 — API 测试', () => {
  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-ME-API-001: 已登录用户调用接口，返回用户信息', async ({ request }) => {
    const email = uniqueEmail('me_success');
    const { nickname } = { nickname: '获取用户信息测试' };

    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, nickname, password: 'password123', agreedToPrivacy: true },
    });

    const response = await request.get(`${API_BASE_URL}/api/auth/me`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.message).toBe('获取用户信息成功');
    expect(body.data).toBeTruthy();
    expect(body.data.email).toBe(email);
    expect(body.data.id).toBeTruthy();
    expect(typeof body.data.createdAt).toBe('number');

    // 验证响应中不含密码哈希
    expect(body.data.passwordHash).toBeUndefined();
    expect(body.data.password_hash).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-ME-API-002: 未登录状态调用接口，返回 401', async ({ request }) => {
    // 使用携带无效/空 Cookie 的请求
    const response = await request.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Cookie: '' },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('获取用户信息失败');
  });

  test('TC-ME-API-003: Session 已过期调用接口，返回 401', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Cookie: 'sessionId=expired_fake_session_id_67890',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('获取用户信息失败');
  });

  test('TC-ME-API-004: Session 中的用户在数据库中已被删除，返回 401', async ({ request }) => {
    // 使用一个在数据库中不存在的 userId 对应的 Session Cookie
    // 这是一种异常情况，用伪造的 Session ID 模拟
    const response = await request.get(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        // 伪造一个 Session，其中 userId 指向不存在的用户
        Cookie: 'sessionId=valid_looking_but_deleted_user_session',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    // 可能是"请先登录"或"用户不存在，请重新登录"
    expect(
      body.error === '请先登录' || body.error === '用户不存在，请重新登录'
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 全局认证状态管理 — UI 测试场景
// ---------------------------------------------------------------------------

test.describe('全局认证状态管理 — UI 测试', () => {
  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-AUTH-UI-001: 未登录用户访问需要认证的页面（首页），自动跳转登录页', async ({ page }) => {
    // 清除所有 Cookie，确保未登录状态
    await page.context().clearCookies();

    // 直接访问首页
    await page.goto(`${BASE_URL}/`);

    // 验证自动跳转到登录页
    await expect(page).toHaveURL(`${BASE_URL}/login`, { timeout: 10000 });
  });

  test('TC-AUTH-UI-002: 已登录用户访问登录页，自动跳转首页', async ({ page, request }) => {
    const email = uniqueEmail('already_logged');

    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, nickname: '已登录用户', password: 'password123', agreedToPrivacy: true },
    });

    // 通过 UI 登录
    await loginViaUI(page, { email, password: 'password123' });
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // 已登录状态下访问登录页
    await page.goto(`${BASE_URL}/login`);

    // 验证自动跳转到首页
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 8000 });
  });

  test('TC-AUTH-UI-003: 已登录用户访问注册页，自动跳转首页', async ({ page, request }) => {
    const email = uniqueEmail('already_logged_reg');

    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, nickname: '已登录用户2', password: 'password123', agreedToPrivacy: true },
    });

    // 通过 UI 登录
    await loginViaUI(page, { email, password: 'password123' });
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // 已登录状态下访问注册页
    await page.goto(`${BASE_URL}/register`);

    // 验证自动跳转到首页
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// 边界场景与特殊情况 — API 测试场景
// ---------------------------------------------------------------------------

test.describe('边界场景与特殊情况 — API 测试', () => {
  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-EDGE-API-001: 注册成功后自动登录，无需二次输入密码', async ({ request }) => {
    const email = uniqueEmail('auto_login');

    // 注册
    const registerResponse = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '自动登录测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(registerResponse.status()).toBe(201);

    // 立即调用 GET /api/auth/me（使用注册接口返回的 Cookie，由 Playwright request context 自动携带）
    const meResponse = await request.get(`${API_BASE_URL}/api/auth/me`);

    expect(meResponse.status()).toBe(200);

    const meBody = await meResponse.json();
    expect(meBody.data.email).toBe(email);
    expect(meBody.data.nickname).toBe('自动登录测试');
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-EDGE-API-002: GET /api/auth/me 请求超时或网络中断，前端降级为未登录状态（UI 验证）', async ({ page, request }) => {
    const email = uniqueEmail('timeout_test');

    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, nickname: '超时测试', password: 'password123', agreedToPrivacy: true },
    });

    // 拦截 /api/auth/me 请求，模拟超时（5 秒后中止）
    await page.route('**/api/auth/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.abort('timedout');
    });

    // 访问首页，触发 AuthContext 初始化
    await page.goto(`${BASE_URL}/`);

    // 验证超时后降级为未登录，跳转到登录页
    await expect(page).toHaveURL(`${BASE_URL}/login`, { timeout: 15000 });
  });
});
