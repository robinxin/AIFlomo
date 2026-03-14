/**
 * 用户登录功能 E2E 测试
 *
 * 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
 * 覆盖模块: 用户登录功能 — UI 测试场景 & API 测试场景
 *
 * UI 测试使用 page fixture（浏览器页面交互）
 * API 测试使用 request fixture（直接 HTTP 请求）
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 测试辅助常量与工具函数
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// 测试专用的固定账号（每次 suite 运行前由 beforeAll 创建）
const TEST_USER = {
  email: `login_test_${Date.now()}@example.com`,
  nickname: '登录测试用户',
  password: 'password123',
};

function uniqueEmail(prefix = 'login') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/**
 * 通过 API 注册一个用户，返回注册结果 body。
 */
async function registerUser(request, { email, nickname, password }) {
  const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
    data: { email, nickname, password, agreedToPrivacy: true },
  });
  return response;
}

// ---------------------------------------------------------------------------
// 登录功能 — UI 测试场景
// ---------------------------------------------------------------------------

test.describe('用户登录 — UI 测试', () => {
  // 在整个 describe 块前，通过 API 预创建测试用户
  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_USER);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-LOGIN-UI-001: 输入正确的邮箱和密码，登录成功并跳转到首页', async ({ page }) => {
    await page.getByTestId('input-email').fill(TEST_USER.email);
    await page.getByTestId('input-password').fill(TEST_USER.password);
    await page.getByTestId('btn-submit').click();

    // 验证按钮进入加载状态
    await expect(page.getByTestId('btn-submit')).toBeDisabled();

    // 验证跳转到首页（Memo 列表页）
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 10000 });
  });

  test('TC-LOGIN-UI-002: 登录页面点击"立即注册"链接跳转到注册页', async ({ page }) => {
    // 输入部分内容
    await page.getByTestId('input-email').fill('partial@example.com');
    await page.getByTestId('input-password').fill('partialpass');

    // 点击立即注册链接
    await page.getByTestId('link-to-register').click();

    // 验证跳转到注册页
    await expect(page).toHaveURL(`${BASE_URL}/register`);
  });

  test('TC-LOGIN-UI-003: 密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
    await page.getByTestId('input-password').fill('password123');

    const passwordInput = page.getByTestId('input-password');

    // 初始状态：密文
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 第一次点击眼睛图标 → 明文
    await page.getByTestId('btn-toggle-password').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // 第二次点击眼睛图标 → 密文
    await page.getByTestId('btn-toggle-password').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-LOGIN-UI-004: 输入错误密码，表单顶部显示错误提示', async ({ page }) => {
    await page.getByTestId('input-email').fill(TEST_USER.email);
    await page.getByTestId('input-password').fill('wrongpassword');
    await page.getByTestId('btn-submit').click();

    // 验证错误提示
    await expect(page.getByTestId('form-error')).toContainText('邮箱或密码错误，请重试', {
      timeout: 8000,
    });

    // 验证按钮恢复可点击
    await expect(page.getByTestId('btn-submit')).toBeEnabled();

    // 验证密码输入框自动清空
    await expect(page.getByTestId('input-password')).toHaveValue('');

    // 验证邮箱输入框保持原内容
    await expect(page.getByTestId('input-email')).toHaveValue(TEST_USER.email);
  });

  test('TC-LOGIN-UI-005: 输入不存在的邮箱，表单顶部显示统一错误提示（不泄露用户不存在）', async ({ page }) => {
    await page.getByTestId('input-email').fill('nonexistent@example.com');
    await page.getByTestId('input-password').fill('password123');
    await page.getByTestId('btn-submit').click();

    // 验证统一错误提示（不区分"用户不存在"还是"密码错误"）
    await expect(page.getByTestId('form-error')).toContainText('邮箱或密码错误，请重试', {
      timeout: 8000,
    });

    // 验证密码输入框自动清空
    await expect(page.getByTestId('input-password')).toHaveValue('');

    // 验证邮箱输入框保持原内容
    await expect(page.getByTestId('input-email')).toHaveValue('nonexistent@example.com');
  });

  test('TC-LOGIN-UI-006: 网络异常时，表单顶部显示网络错误提示', async ({ page }) => {
    await page.getByTestId('input-email').fill(TEST_USER.email);
    await page.getByTestId('input-password').fill(TEST_USER.password);

    // 拦截登录请求，模拟网络失败
    await page.route('**/api/auth/login', (route) => route.abort('failed'));

    await page.getByTestId('btn-submit').click();

    await expect(page.getByTestId('form-error')).toContainText('网络连接失败，请稍后重试', {
      timeout: 8000,
    });

    // 验证按钮恢复可点击
    await expect(page.getByTestId('btn-submit')).toBeEnabled();

    // 验证表单内容保持不变
    await expect(page.getByTestId('input-email')).toHaveValue(TEST_USER.email);
  });
});

// ---------------------------------------------------------------------------
// 登录功能 — API 测试场景
// ---------------------------------------------------------------------------

test.describe('用户登录 — API 测试', () => {
  // 在整个 describe 块前，通过 API 预创建测试用户
  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_USER);
  });

  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-LOGIN-API-001: 有效邮箱和密码，用户登录成功', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.message).toBe('登录成功');
    expect(body.data).toBeTruthy();
    expect(body.data.email).toBe(TEST_USER.email);
    expect(body.data.nickname).toBe(TEST_USER.nickname);
    expect(body.data.id).toBeTruthy();
    expect(typeof body.data.createdAt).toBe('number');

    // 验证响应中不含密码哈希
    expect(body.data.passwordHash).toBeUndefined();
    expect(body.data.password_hash).toBeUndefined();

    // 验证响应头包含 Set-Cookie（Session Cookie）
    const setCookieHeader = response.headers()['set-cookie'];
    expect(setCookieHeader).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-LOGIN-API-002: 邮箱字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        password: 'password123',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('登录失败');
  });

  test('TC-LOGIN-API-003: 密码字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_USER.email,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('登录失败');
  });

  test('TC-LOGIN-API-004: 邮箱不存在，返回 401 且不泄露具体原因', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    // 统一提示，不区分"用户不存在"和"密码错误"
    expect(body.error).toMatch(/邮箱或密码错误[,，]请重试/);
    expect(body.message).toBe('登录失败');
  });

  test('TC-LOGIN-API-005: 密码错误，返回 401 且不泄露具体原因', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_USER.email,
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toMatch(/邮箱或密码错误[,，]请重试/);
    expect(body.message).toBe('登录失败');
  });

  test('TC-LOGIN-API-006: 密码长度为 0 字符时提交登录，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_USER.email,
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
