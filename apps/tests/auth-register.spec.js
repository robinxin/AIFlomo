// 用户注册功能测试
// 关联测试用例文档: specs/active/43-feature-account-registration-login-3-testcases.md
// 包含 UI 测试和 API 测试

import { test, expect } from '@playwright/test';

// ==================== UI 测试场景 ====================

test.describe('用户注册功能 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('输入有效邮箱、昵称、密码并勾选隐私协议，注册成功并跳转到首页', async ({ page }) => {
      // 前置条件：用户未登录，访问 /register 页面
      await page.goto('/register');

      // 操作步骤
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="nickname-input"]', '小明');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.check('[data-testid="privacy-checkbox"]');

      // 监听 API 请求
      const responsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/auth/register') && resp.status() === 201
      );

      await page.click('[data-testid="submit-button"]');

      // 预期结果：按钮文字变为"注册中..."且禁用
      await expect(page.locator('[data-testid="submit-button"]')).toHaveText('注册中...');
      await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();

      // 所有输入框变为不可编辑状态
      await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="nickname-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

      // 等待接口返回成功
      await responsePromise;

      // 页面自动跳转到 Memo 列表页 /
      await expect(page).toHaveURL('/');
    });

    test('密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
      // 前置条件：用户停留在注册页面
      await page.goto('/register');

      // 操作步骤
      await page.fill('[data-testid="password-input"]', 'password123');

      // 第一次点击：密码变为明文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'text');

      // 第二次点击：密码恢复密文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');
    });

    test('注册页面点击"返回登录"链接跳转到登录页', async ({ page }) => {
      // 前置条件：用户停留在注册页面，已输入部分内容
      await page.goto('/register');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="nickname-input"]', '测试');
      await page.fill('[data-testid="password-input"]', 'test1234');

      // 操作步骤
      await page.click('[data-testid="login-link"]');

      // 预期结果：页面跳转到 /login 登录页面
      await expect(page).toHaveURL('/login');
    });

    test('昵称输入 20 字符后无法继续输入', async ({ page }) => {
      // 前置条件：用户停留在注册页面
      await page.goto('/register');

      // 操作步骤
      const nicknameInput = page.locator('[data-testid="nickname-input"]');
      await nicknameInput.fill('12345678901234567890'); // 20 个字符

      // 预期结果：输入框达到 maxLength 限制
      await expect(nicknameInput).toHaveValue('12345678901234567890');

      // 尝试继续输入第 21 个字符
      await nicknameInput.press('a');
      await expect(nicknameInput).toHaveValue('12345678901234567890'); // 仍为 20 字符
    });
  });

  test.describe('异常场景', () => {
    test('输入框为空时点击注册，前端给出提示', async ({ page }) => {
      // 前置条件：用户停留在注册页面，所有输入框为空
      await page.goto('/register');

      // 操作步骤：不输入任何内容，直接点击注册
      await page.click('[data-testid="submit-button"]');

      // 预期结果：发送请求未发出（前端拦截）
      // 各输入框下方显示错误提示
      await expect(page.locator('[data-testid="email-error"]')).toContainText('请输入有效的邮箱地址');
      await expect(page.locator('[data-testid="nickname-error"]')).toContainText('昵称长度为 2-20 字符');
      await expect(page.locator('[data-testid="password-error"]')).toContainText('密码长度为 8-20 字符');
      await expect(page.locator('[data-testid="privacy-error"]')).toContainText('请阅读并同意隐私协议');
    });

    test('邮箱格式不正确时失焦，显示格式错误提示', async ({ page }) => {
      // 前置条件：用户停留在注册页面
      await page.goto('/register');

      // 操作步骤
      await page.fill('[data-testid="email-input"]', 'test@');
      await page.locator('[data-testid="nickname-input"]').click(); // 失焦

      // 预期结果
      await expect(page.locator('[data-testid="email-error"]')).toContainText('请输入有效的邮箱地址');
      await expect(page.locator('[data-testid="email-input"]')).toHaveClass(/error|invalid/);
    });

    test('邮箱格式正确后失焦，错误提示消失', async ({ page }) => {
      // 前置条件：用户停留在注册页面，邮箱输入框显示格式错误提示
      await page.goto('/register');
      await page.fill('[data-testid="email-input"]', 'test@');
      await page.locator('[data-testid="nickname-input"]').click(); // 失焦触发错误

      // 操作步骤
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.locator('[data-testid="nickname-input"]').click(); // 再次失焦

      // 预期结果：错误提示消失
      await expect(page.locator('[data-testid="email-error"]')).not.toBeVisible();
    });

    test('昵称少于 2 字符时失焦，显示长度错误提示', async ({ page }) => {
      await page.goto('/register');

      await page.fill('[data-testid="nickname-input"]', 'a');
      await page.locator('[data-testid="email-input"]').click(); // 失焦

      await expect(page.locator('[data-testid="nickname-error"]')).toContainText('昵称长度为 2-20 字符');
    });

    test('昵称输入纯空格时失焦，显示错误提示', async ({ page }) => {
      await page.goto('/register');

      await page.fill('[data-testid="nickname-input"]', '   ');
      await page.locator('[data-testid="email-input"]').click(); // 失焦

      await expect(page.locator('[data-testid="nickname-error"]')).toContainText('昵称不能为空');
    });

    test('密码少于 8 字符时失焦，显示长度错误提示', async ({ page }) => {
      await page.goto('/register');

      await page.fill('[data-testid="password-input"]', 'abc123');
      await page.locator('[data-testid="email-input"]').click(); // 失焦

      await expect(page.locator('[data-testid="password-error"]')).toContainText('密码长度至少为 8 个字符');
    });

    test('未勾选隐私协议点击注册，高亮提示勾选框', async ({ page }) => {
      await page.goto('/register');

      // 填写有效内容但不勾选隐私协议
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="nickname-input"]', '小明');
      await page.fill('[data-testid="password-input"]', 'password123');

      await page.click('[data-testid="submit-button"]');

      // 预期结果：发送请求未发出（前端拦截）
      await expect(page.locator('[data-testid="privacy-error"]')).toContainText('请阅读并同意隐私协议');
      await expect(page.locator('[data-testid="privacy-checkbox"]')).toHaveClass(/error|invalid/);
    });

    test('邮箱已被注册时，表单顶部显示错误提示', async ({ page, request }) => {
      // 前置条件：数据库中已存在邮箱 user@example.com 的用户
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小张',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      await page.goto('/register');

      // 操作步骤：使用相同邮箱注册
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="nickname-input"]', '小红');
      await page.fill('[data-testid="password-input"]', 'password456');
      await page.check('[data-testid="privacy-checkbox"]');

      const responsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/auth/register') && resp.status() === 409
      );

      await page.click('[data-testid="submit-button"]');

      await responsePromise;

      // 预期结果
      await expect(page.locator('[data-testid="form-error"]')).toContainText('该邮箱已被注册');
      await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('user@example.com'); // 内容保持不变
    });

    test('网络异常时，表单顶部显示网络错误提示', async ({ page, context }) => {
      await page.goto('/register');

      // 填写有效内容
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="nickname-input"]', '测试');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.check('[data-testid="privacy-checkbox"]');

      // 模拟网络中断
      await context.setOffline(true);

      await page.click('[data-testid="submit-button"]');

      // 预期结果
      await expect(page.locator('[data-testid="form-error"]')).toContainText(/网络连接失败|请稍后重试/);
      await expect(page.locator('[data-testid="submit-button"]')).not.toBeDisabled();
    });
  });
});

// ==================== API 测试场景 ====================

test.describe('用户注册功能 - API 测试', () => {
  test.describe('正常场景', () => {
    test('有效邮箱、昵称、密码和隐私协议同意，用户注册成功', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'newuser@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 预期结果：接口返回 HTTP 201
      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body.data).toMatchObject({
        email: 'newuser@example.com',
        nickname: '小明'
      });
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.message).toBe('注册成功');

      // 响应 Set-Cookie 头包含有效 Session Cookie
      const headers = response.headers();
      expect(headers['set-cookie']).toBeTruthy();
    });

    test('昵称包含前后空格时，后端 trim 后存储', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'trimtest@example.com',
          nickname: '  小红  ',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.nickname).toBe('小红');
    });

    test('昵称为 2 字符（边界值），注册成功', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'min@example.com',
          nickname: 'ab',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.nickname).toBe('ab');
    });

    test('昵称为 20 字符（边界值），注册成功', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'max@example.com',
          nickname: '12345678901234567890',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.nickname).toBe('12345678901234567890');
    });

    test('密码为 8 字符（边界值），注册成功', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'minpw@example.com',
          nickname: '测试',
          password: 'abcd1234',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(201);
    });

    test('密码为 20 字符（边界值），注册成功', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'maxpw@example.com',
          nickname: '测试',
          password: '12345678901234567890',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(201);
    });
  });

  test.describe('异常场景', () => {
    test('邮箱字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('请求参数格式错误');
      expect(body.message).toBe('注册失败');
    });

    test('昵称字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('请求参数格式错误');
    });

    test('密码字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '小明',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
    });

    test('agreedToPrivacy 字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '小明',
          password: 'password123'
        }
      });

      expect(response.status()).toBe(400);
    });

    test('邮箱格式不正确，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'invalid-email',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('请输入有效的邮箱地址');
    });

    test('昵称少于 2 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: 'a',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('昵称长度为 2-20 字符');
    });

    test('昵称超过 20 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '123456789012345678901',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('昵称长度为 2-20 字符');
    });

    test('昵称为纯空格，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '   ',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('昵称长度为 2-20 字符');
    });

    test('密码少于 8 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '小明',
          password: 'abc123',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('密码长度为 8-20 字符');
    });

    test('密码超过 20 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '小明',
          password: '123456789012345678901',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('密码长度为 8-20 字符');
    });

    test('agreedToPrivacy 为 false，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: false
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('请阅读并同意隐私协议');
    });

    test('邮箱已被注册，返回 409', async ({ request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'existing@example.com',
          nickname: '已存在',
          password: 'password123',
          agreedToPrivacy: true
        }
      });

      // 尝试使用相同邮箱注册
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'existing@example.com',
          nickname: '小红',
          password: 'password456',
          agreedToPrivacy: true
        }
      });

      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.error).toBe('该邮箱已被注册');
    });

    test('并发注册同一邮箱，仅一个成功，其他返回 409', async ({ request }) => {
      const email = 'concurrent@example.com';

      // 并发发送两个注册请求
      const [response1, response2] = await Promise.all([
        request.post('/api/auth/register', {
          data: {
            email,
            nickname: '用户1',
            password: 'password123',
            agreedToPrivacy: true
          }
        }),
        request.post('/api/auth/register', {
          data: {
            email,
            nickname: '用户2',
            password: 'password123',
            agreedToPrivacy: true
          }
        })
      ]);

      // 其中一个成功，一个失败
      const statuses = [response1.status(), response2.status()].sort();
      expect(statuses).toEqual([201, 409]);
    });
  });
});
