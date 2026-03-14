import { test, expect } from '@playwright/test';

test.describe('用户注册功能', () => {
  test.describe('UI 测试场景 - 正常场景', () => {
    test('输入有效邮箱、昵称、密码并勾选隐私协议，注册成功并跳转到首页', async ({ page }) => {
      await page.goto('/register');

      // 填写表单
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="nickname-input"]', '小明');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.check('[data-testid="privacy-checkbox"]');

      // 点击注册按钮
      await page.click('[data-testid="submit-button"]');

      // 验证按钮状态
      await expect(page.locator('[data-testid="submit-button"]')).toHaveText('注册中...');
      await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();

      // 验证输入框不可编辑
      await expect(page.locator('[data-testid="email-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="nickname-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="password-input"]')).toBeDisabled();

      // 等待跳转到首页
      await expect(page).toHaveURL('/');
    });

    test('密码输入框点击眼睛图标可切换明文/密文显示', async ({ page }) => {
      await page.goto('/register');

      // 输入密码
      await page.fill('[data-testid="password-input"]', 'password123');

      // 第一次点击眼睛图标 - 显示明文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'text');

      // 第二次点击眼睛图标 - 恢复密文
      await page.click('[data-testid="password-toggle"]');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('type', 'password');
    });

    test('注册页面点击"返回登录"链接跳转到登录页', async ({ page }) => {
      await page.goto('/register');

      // 填写部分内容
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="nickname-input"]', '测试');

      // 点击返回登录
      await page.click('[data-testid="back-to-login"]');

      // 验证跳转到登录页
      await expect(page).toHaveURL('/login');

      // 验证注册页面内容已清空（通过返回注册页检查）
      await page.goto('/register');
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('');
      await expect(page.locator('[data-testid="nickname-input"]')).toHaveValue('');
    });

    test('昵称输入 20 字符后无法继续输入', async ({ page }) => {
      await page.goto('/register');

      const twentyChars = '12345678901234567890';
      await page.fill('[data-testid="nickname-input"]', twentyChars);

      // 验证无法输入第 21 个字符
      await expect(page.locator('[data-testid="nickname-input"]')).toHaveValue(twentyChars);
      await expect(page.locator('[data-testid="nickname-input"]')).toHaveAttribute('maxLength', '20');

      // 验证提示文字
      await expect(page.locator('text=昵称最多 20 个字符')).toBeVisible();
    });
  });

  test.describe('UI 测试场景 - 异常场景', () => {
    test('输入框为空时点击注册，前端给出提示', async ({ page }) => {
      await page.goto('/register');

      // 点击注册按钮（不填写任何内容）
      await page.click('[data-testid="submit-button"]');

      // 验证错误提示
      await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();
      await expect(page.locator('text=昵称长度为 2-20 字符')).toBeVisible();
      await expect(page.locator('text=密码长度为 8-20 字符')).toBeVisible();
      await expect(page.locator('text=请阅读并同意隐私协议')).toBeVisible();
    });

    test('邮箱格式不正确时失焦，显示格式错误提示', async ({ page }) => {
      await page.goto('/register');

      // 输入不完整邮箱并失焦
      await page.fill('[data-testid="email-input"]', 'test@');
      await page.locator('[data-testid="nickname-input"]').click(); // 失焦

      // 验证错误提示
      await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible();
      await expect(page.locator('[data-testid="email-input"]')).toHaveCSS('border-color', /red/i);
    });

    test('邮箱格式正确后失焦，错误提示消失', async ({ page }) => {
      await page.goto('/register');

      // 先输入错误邮箱
      await page.fill('[data-testid="email-input"]', 'test@');
      await page.locator('[data-testid="nickname-input"]').click(); // 失焦

      // 修正邮箱
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.locator('[data-testid="nickname-input"]').click(); // 失焦

      // 验证错误提示消失
      await expect(page.locator('text=请输入有效的邮箱地址')).not.toBeVisible();
    });

    test('昵称少于 2 字符时失焦，显示长度错误提示', async ({ page }) => {
      await page.goto('/register');

      // 输入 1 字符并失焦
      await page.fill('[data-testid="nickname-input"]', 'a');
      await page.locator('[data-testid="email-input"]').click(); // 失焦

      // 验证错误提示
      await expect(page.locator('text=昵称长度为 2-20 字符')).toBeVisible();
      await expect(page.locator('[data-testid="nickname-input"]')).toHaveCSS('border-color', /red/i);
    });

    test('昵称输入纯空格时失焦，显示错误提示', async ({ page }) => {
      await page.goto('/register');

      // 输入纯空格并失焦
      await page.fill('[data-testid="nickname-input"]', '   ');
      await page.locator('[data-testid="email-input"]').click(); // 失焦

      // 验证错误提示
      await expect(page.locator('text=昵称不能为空')).toBeVisible();
      await expect(page.locator('[data-testid="nickname-input"]')).toHaveCSS('border-color', /red/i);
    });

    test('密码少于 8 字符时失焦，显示长度错误提示', async ({ page }) => {
      await page.goto('/register');

      // 输入 6 字符并失焦
      await page.fill('[data-testid="password-input"]', 'abc123');
      await page.locator('[data-testid="email-input"]').click(); // 失焦

      // 验证错误提示
      await expect(page.locator('text=密码长度至少为 8 个字符')).toBeVisible();
      await expect(page.locator('[data-testid="password-input"]')).toHaveCSS('border-color', /red/i);
    });

    test('未勾选隐私协议点击注册，高亮提示勾选框', async ({ page }) => {
      await page.goto('/register');

      // 填写所有字段但不勾选隐私协议
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="nickname-input"]', '小明');
      await page.fill('[data-testid="password-input"]', 'password123');

      // 点击注册
      await page.click('[data-testid="submit-button"]');

      // 验证隐私协议错误提示
      await expect(page.locator('[data-testid="privacy-checkbox"]')).toHaveCSS('border-color', /red/i);
      await expect(page.locator('text=请阅读并同意隐私协议')).toBeVisible();
    });

    test('邮箱已被注册时，表单顶部显示错误提示', async ({ page, request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'user@example.com',
          nickname: '小红',
          password: 'password456',
          agreedToPrivacy: true,
        },
      });

      await page.goto('/register');

      // 使用已注册的邮箱尝试注册
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="nickname-input"]', '小红');
      await page.fill('[data-testid="password-input"]', 'password456');
      await page.check('[data-testid="privacy-checkbox"]');
      await page.click('[data-testid="submit-button"]');

      // 验证错误提示
      await expect(page.locator('[data-testid="form-error"]')).toHaveText('该邮箱已被注册');

      // 验证表单状态恢复
      await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled();
      await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();

      // 验证表单内容保留
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('user@example.com');
      await expect(page.locator('[data-testid="nickname-input"]')).toHaveValue('小红');
    });

    test('网络异常时，表单顶部显示网络错误提示', async ({ page, context }) => {
      await page.goto('/register');

      // 模拟网络异常（离线）
      await context.setOffline(true);

      // 填写表单并提交
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="nickname-input"]', '测试');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.check('[data-testid="privacy-checkbox"]');
      await page.click('[data-testid="submit-button"]');

      // 验证网络错误提示
      await expect(page.locator('[data-testid="form-error"]')).toHaveText('网络连接失败，请稍后重试');

      // 验证表单状态恢复
      await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled();
      await expect(page.locator('[data-testid="email-input"]')).toBeEnabled();

      // 恢复网络
      await context.setOffline(false);
    });
  });

  test.describe('API 测试场景 - 正常场景', () => {
    test('有效邮箱、昵称、密码和隐私协议同意，用户注册成功', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'newuser@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe('newuser@example.com');
      expect(body.data.nickname).toBe('小明');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.message).toBe('注册成功');

      // 验证 Set-Cookie 头
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
    });

    test('昵称包含前后空格时，后端 trim 后存储', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'trimtest@example.com',
          nickname: '  小红  ',
          password: 'password123',
          agreedToPrivacy: true,
        },
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
          agreedToPrivacy: true,
        },
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
          agreedToPrivacy: true,
        },
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
          agreedToPrivacy: true,
        },
      });

      expect(response.status()).toBe(201);
    });

    test('密码为 20 字符（边界值），注册成功', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'maxpw@example.com',
          nickname: '测试',
          password: '12345678901234567890',
          agreedToPrivacy: true,
        },
      });

      expect(response.status()).toBe(201);
    });
  });

  test.describe('API 测试场景 - 异常场景', () => {
    test('邮箱字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
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

    test('昵称字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('密码字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('agreedToPrivacy 字段缺失，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('邮箱格式不正确，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
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

    test('昵称少于 2 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('昵称超过 20 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('昵称为纯空格，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('密码少于 8 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('密码超过 20 字符，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('agreedToPrivacy 为 false，返回 400', async ({ request }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
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

    test('邮箱已被注册，返回 409', async ({ request }) => {
      // 先注册一个用户
      await request.post('/api/auth/register', {
        data: {
          email: 'existing@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      // 尝试用相同邮箱再次注册
      const response = await request.post('/api/auth/register', {
        data: {
          email: 'existing@example.com',
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
  });
});
