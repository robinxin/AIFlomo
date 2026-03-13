/**
 * 用户注册功能 E2E 测试
 *
 * 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
 * 覆盖模块: 用户注册功能 — UI 测试场景 & API 测试场景
 *
 * UI 测试使用 page fixture（浏览器页面交互）
 * API 测试使用 request fixture（直接 HTTP 请求）
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 测试辅助常量
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || 'http://localhost:8082';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// 用于生成唯一邮箱，避免测试间互相干扰
function uniqueEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
}

// ---------------------------------------------------------------------------
// 注册功能 — UI 测试场景
// ---------------------------------------------------------------------------

test.describe('用户注册 — UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
  });

  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-REG-UI-001: 输入有效邮箱、昵称、密码并勾选隐私协议，注册成功并跳转到首页', async ({ page }) => {
    const email = uniqueEmail('reg_success');

    // 填写表单
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-nickname').fill('小明');
    await page.getByTestId('input-password').fill('password123');
    await page.getByTestId('checkbox-privacy').click();

    // 点击注册按钮
    await page.getByTestId('btn-submit').click();

    // 验证按钮进入加载状态
    await expect(page.getByTestId('btn-submit')).toBeDisabled();

    // 验证跳转到首页（Memo 列表页）
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 10000 });
  });

  test('TC-REG-UI-002: 密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
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

  test('TC-REG-UI-003: 注册页面点击"返回登录"链接跳转到登录页', async ({ page }) => {
    // 输入部分内容
    await page.getByTestId('input-email').fill('partial@example.com');
    await page.getByTestId('input-nickname').fill('用户');
    await page.getByTestId('input-password').fill('pass1234');

    // 点击返回登录链接
    await page.getByTestId('link-to-login').click();

    // 验证跳转到登录页
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('TC-REG-UI-004: 昵称输入 20 字符后无法继续输入', async ({ page }) => {
    const twentyChars = '12345678901234567890';
    const nicknameInput = page.getByTestId('input-nickname');

    await nicknameInput.fill(twentyChars);

    // 尝试输入第 21 个字符
    await nicknameInput.press('End');
    await nicknameInput.type('X');

    // 输入框值仍应为 20 字符
    const value = await nicknameInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-REG-UI-005: 输入框为空时点击注册，前端给出提示', async ({ page }) => {
    // 不输入任何内容，直接点击注册
    await page.getByTestId('btn-submit').click();

    // 验证各字段错误提示
    await expect(page.getByTestId('error-email')).toContainText('请输入有效的邮箱地址');
    await expect(page.getByTestId('error-nickname')).toContainText('昵称长度为 2-20 字符');
    await expect(page.getByTestId('error-password')).toContainText('密码长度为 8-20 字符');
    await expect(page.getByTestId('error-privacy')).toContainText('请阅读并同意隐私协议');

    // 验证未发起网络请求（前端拦截）
    // 页面 URL 保持不变
    await expect(page).toHaveURL(`${BASE_URL}/register`);
  });

  test('TC-REG-UI-006: 邮箱格式不正确时失焦，显示格式错误提示', async ({ page }) => {
    const emailInput = page.getByTestId('input-email');

    await emailInput.fill('test@');
    // 触发失焦
    await page.getByTestId('input-nickname').click();

    await expect(page.getByTestId('error-email')).toContainText('请输入有效的邮箱地址');
  });

  test('TC-REG-UI-007: 邮箱格式正确后失焦，错误提示消失', async ({ page }) => {
    const emailInput = page.getByTestId('input-email');

    // 先输入错误格式触发错误提示
    await emailInput.fill('test@');
    await page.getByTestId('input-nickname').click();
    await expect(page.getByTestId('error-email')).toBeVisible();

    // 修正为正确格式
    await emailInput.fill('test@example.com');
    await page.getByTestId('input-nickname').click();

    await expect(page.getByTestId('error-email')).not.toBeVisible();
  });

  test('TC-REG-UI-008: 昵称少于 2 字符时失焦，显示长度错误提示', async ({ page }) => {
    const nicknameInput = page.getByTestId('input-nickname');

    await nicknameInput.fill('a');
    // 触发失焦
    await page.getByTestId('input-email').click();

    await expect(page.getByTestId('error-nickname')).toContainText('昵称长度为 2-20 字符');
  });

  test('TC-REG-UI-009: 昵称输入纯空格时失焦，显示错误提示', async ({ page }) => {
    const nicknameInput = page.getByTestId('input-nickname');

    await nicknameInput.fill('   ');
    await page.getByTestId('input-email').click();

    // 期望出现昵称不能为空或等效错误提示
    const errorEl = page.getByTestId('error-nickname');
    await expect(errorEl).toBeVisible();
    const errorText = await errorEl.textContent();
    expect(
      errorText.includes('昵称不能为空') || errorText.includes('昵称长度为 2-20 字符')
    ).toBe(true);
  });

  test('TC-REG-UI-010: 密码少于 8 字符时失焦，显示长度错误提示', async ({ page }) => {
    const passwordInput = page.getByTestId('input-password');

    await passwordInput.fill('abc123');
    await page.getByTestId('input-email').click();

    await expect(page.getByTestId('error-password')).toContainText('密码长度至少为 8 个字符');
  });

  test('TC-REG-UI-011: 未勾选隐私协议点击注册，高亮提示勾选框', async ({ page }) => {
    await page.getByTestId('input-email').fill('user@example.com');
    await page.getByTestId('input-nickname').fill('小明');
    await page.getByTestId('input-password').fill('password123');
    // 不勾选隐私协议
    await page.getByTestId('btn-submit').click();

    // 验证隐私协议区域有错误提示
    await expect(page.getByTestId('error-privacy')).toContainText('请阅读并同意隐私协议');
    // 页面 URL 保持不变（未提交）
    await expect(page).toHaveURL(`${BASE_URL}/register`);
  });

  test('TC-REG-UI-012: 邮箱已被注册时，表单顶部显示错误提示', async ({ page, request }) => {
    // 先通过 API 注册一个用户，确保邮箱已存在
    const existingEmail = uniqueEmail('existing');
    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email: existingEmail,
        nickname: '已有用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 在 UI 上使用相同邮箱注册
    await page.getByTestId('input-email').fill(existingEmail);
    await page.getByTestId('input-nickname').fill('小红');
    await page.getByTestId('input-password').fill('password456');
    await page.getByTestId('checkbox-privacy').click();
    await page.getByTestId('btn-submit').click();

    // 等待接口响应后验证错误提示
    await expect(page.getByTestId('form-error')).toContainText('该邮箱已被注册', {
      timeout: 8000,
    });

    // 验证按钮恢复可点击
    await expect(page.getByTestId('btn-submit')).toBeEnabled();

    // 验证表单内容保持不变
    await expect(page.getByTestId('input-email')).toHaveValue(existingEmail);
    await expect(page.getByTestId('input-nickname')).toHaveValue('小红');
  });

  test('TC-REG-UI-013: 网络异常时，表单顶部显示网络错误提示', async ({ page }) => {
    const email = uniqueEmail('netfail');

    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-nickname').fill('测试用户');
    await page.getByTestId('input-password').fill('password123');
    await page.getByTestId('checkbox-privacy').click();

    // 拦截注册请求，模拟网络失败
    await page.route('**/api/auth/register', (route) => route.abort('failed'));

    await page.getByTestId('btn-submit').click();

    await expect(page.getByTestId('form-error')).toContainText('网络连接失败，请稍后重试', {
      timeout: 8000,
    });

    // 验证按钮恢复可点击
    await expect(page.getByTestId('btn-submit')).toBeEnabled();

    // 验证表单内容保持不变
    await expect(page.getByTestId('input-email')).toHaveValue(email);
  });
});

// ---------------------------------------------------------------------------
// 注册功能 — API 测试场景
// ---------------------------------------------------------------------------

test.describe('用户注册 — API 测试', () => {
  // -------------------------------------------------------------------------
  // 正常场景
  // -------------------------------------------------------------------------

  test('TC-REG-API-001: 有效邮箱、昵称、密码和隐私协议同意，用户注册成功', async ({ request }) => {
    const email = uniqueEmail('api_success');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.message).toBe('注册成功');
    expect(body.data).toBeTruthy();
    expect(body.data.email).toBe(email);
    expect(body.data.nickname).toBe('小明');
    expect(body.data.id).toBeTruthy();
    expect(typeof body.data.createdAt).toBe('number');

    // 验证响应中不含密码哈希
    expect(body.data.passwordHash).toBeUndefined();
    expect(body.data.password_hash).toBeUndefined();

    // 验证响应头包含 Set-Cookie（Session Cookie）
    const setCookieHeader = response.headers()['set-cookie'];
    expect(setCookieHeader).toBeTruthy();
  });

  test('TC-REG-API-002: 昵称包含前后空格时，后端 trim 后存储', async ({ request }) => {
    const email = uniqueEmail('trim_test');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '  小红  ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('小红');
  });

  test('TC-REG-API-003: 昵称为 2 字符（边界值），注册成功', async ({ request }) => {
    const email = uniqueEmail('min_nick');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: 'ab',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('ab');
  });

  test('TC-REG-API-004: 昵称为 20 字符（边界值），注册成功', async ({ request }) => {
    const email = uniqueEmail('max_nick');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '12345678901234567890',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.nickname).toBe('12345678901234567890');
  });

  test('TC-REG-API-005: 密码为 8 字符（边界值），注册成功', async ({ request }) => {
    const email = uniqueEmail('min_pw');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '测试',
        password: 'abcd1234',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    // 验证响应不含明文密码
    expect(body.data.password).toBeUndefined();
    expect(body.data.passwordHash).toBeUndefined();
  });

  test('TC-REG-API-006: 密码为 20 字符（边界值），注册成功', async ({ request }) => {
    const email = uniqueEmail('max_pw');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '测试',
        password: '12345678901234567890',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 异常场景
  // -------------------------------------------------------------------------

  test('TC-REG-API-007: 邮箱字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-008: 昵称字段缺失，返回 400', async ({ request }) => {
    const email = uniqueEmail('no_nick');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-009: 密码字段缺失，返回 400', async ({ request }) => {
    const email = uniqueEmail('no_pw');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-010: agreedToPrivacy 字段缺失，返回 400', async ({ request }) => {
    const email = uniqueEmail('no_privacy');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请求参数格式错误');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-011: 邮箱格式不正确，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email: 'invalid-email',
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请输入有效的邮箱地址');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-012: 昵称少于 2 字符，返回 400', async ({ request }) => {
    const email = uniqueEmail('short_nick');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: 'a',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('昵称长度为 2-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-013: 昵称超过 20 字符，返回 400', async ({ request }) => {
    const email = uniqueEmail('long_nick');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '123456789012345678901',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('昵称长度为 2-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-014: 昵称为纯空格，返回 400', async ({ request }) => {
    const email = uniqueEmail('space_nick');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '   ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('昵称长度为 2-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-015: 密码少于 8 字符，返回 400', async ({ request }) => {
    const email = uniqueEmail('short_pw');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        password: 'abc123',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('密码长度为 8-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-016: 密码超过 20 字符，返回 400', async ({ request }) => {
    const email = uniqueEmail('long_pw');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        password: '123456789012345678901',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('密码长度为 8-20 字符');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-017: agreedToPrivacy 为 false，返回 400', async ({ request }) => {
    const email = uniqueEmail('false_privacy');

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: false,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请阅读并同意隐私协议');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-018: 邮箱已被注册，返回 409', async ({ request }) => {
    const email = uniqueEmail('dup_email');

    // 先注册一次
    await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 再次用同一邮箱注册
    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        email,
        nickname: '小红',
        password: 'password456',
        agreedToPrivacy: true,
      },
    });

    expect(response.status()).toBe(409);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('该邮箱已被注册');
    expect(body.message).toBe('注册失败');
  });

  test('TC-REG-API-019: 并发注册同一邮箱，仅一个成功，其他返回 409', async ({ request }) => {
    const email = uniqueEmail('concurrent');

    const payload = {
      data: {
        email,
        nickname: '并发用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    };

    // 并发发送两个注册请求
    const [res1, res2] = await Promise.all([
      request.post(`${API_BASE_URL}/api/auth/register`, payload),
      request.post(`${API_BASE_URL}/api/auth/register`, payload),
    ]);

    const statuses = [res1.status(), res2.status()];

    // 一个必须成功（201），一个必须冲突（409）
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // 失败的那个 error 必须是"该邮箱已被注册"
    const failedResponse = res1.status() === 409 ? res1 : res2;
    const failedBody = await failedResponse.json();
    expect(failedBody.error).toBe('该邮箱已被注册');
  });
});
