import { test, expect } from '@playwright/test';

/**
 * 创建和编辑笔记测试
 * 对应测试用例文档：§ 创建和编辑笔记
 */

// 测试前登录
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', '12345678');
  await page.click('button:has-text("登录")');
  await page.waitForURL('/memo');
});

test.describe('创建笔记 - UI 测试', () => {
  test.describe('正常场景', () => {
    test('用户在输入框输入纯文本内容并点击发送，笔记出现在列表顶部', async ({ page }) => {
      const content = `今天学习新知识 ${Date.now()}`;

      // 在输入框输入内容
      await page.fill('[data-testid="memo-input"]', content);

      // 点击发送按钮
      await page.click('button:has-text("发送")');

      // 验证输入框清空
      await expect(page.locator('[data-testid="memo-input"]')).toHaveValue('');

      // 验证笔记出现在列表顶部
      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo).toContainText(content);

      // 验证成功提示
      await expect(page.locator('text=创建成功')).toBeVisible();
    });

    test('用户在输入框输入带标签的内容，标签被自动识别', async ({ page }) => {
      const content = `今天参加 #工作 会议，学到 #技术 新知识 ${Date.now()}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      // 验证笔记卡片显示标签高亮
      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator('[data-testid="tag"]:has-text("工作")')).toBeVisible();
      await expect(firstMemo.locator('[data-testid="tag"]:has-text("技术")')).toBeVisible();

      // 验证左侧标签树新增标签
      await expect(page.locator('[data-testid="tag-list"] >> text=工作')).toBeVisible();
      await expect(page.locator('[data-testid="tag-list"] >> text=技术')).toBeVisible();
    });

    test('用户点击插入图片按钮，选择图片后预览显示在输入区下方', async ({ page }) => {
      // 输入文本
      await page.fill('[data-testid="memo-input"]', '测试图片笔记');

      // 点击插入图片按钮
      await page.click('[data-testid="insert-image-btn"]');

      // 选择图片（模拟文件上传）
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
      });

      // 验证预览显示
      await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();

      // 验证删除按钮存在
      await expect(page.locator('[data-testid="remove-attachment-btn"]')).toBeVisible();

      // 点击发送
      await page.click('button:has-text("发送")');

      // 验证笔记带有图片附件
      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator('[data-testid="memo-image"]')).toBeVisible();
    });

    test('用户在输入框粘贴 URL 链接，笔记被标记为"有链接"类型', async ({ page }) => {
      const content = '测试链接 https://example.com';

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      // 验证笔记卡片显示链接
      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator('a[href="https://example.com"]')).toBeVisible();

      // 验证左侧筛选面板"有链接"计数增加
      const linkFilter = page.locator('[data-testid="filter-link"]');
      await expect(linkFilter).toContainText(/\d+/);
    });
  });

  test.describe('异常场景', () => {
    test('输入框为空时点击发送，前端给出提示', async ({ page }) => {
      // 不输入任何内容，直接点击发送
      await page.click('button:has-text("发送")');

      // 验证错误提示
      await expect(page.locator('text=内容不能为空')).toBeVisible();

      // 验证输入框保持聚焦
      await expect(page.locator('[data-testid="memo-input"]')).toBeFocused();
    });

    test('输入框内容超过 10,000 字符，前端拦截并提示', async ({ page }) => {
      // 生成 10,001 字符的文本
      const longContent = 'a'.repeat(10001);

      await page.fill('[data-testid="memo-input"]', longContent);
      await page.click('button:has-text("发送")');

      // 验证错误提示
      await expect(page.locator('text=内容不得超过 10,000 字符')).toBeVisible();
    });

    test('用户选择图片大小超过 5MB，前端拦截并提示', async ({ page }) => {
      await page.fill('[data-testid="memo-input"]', '测试大图片');

      await page.click('[data-testid="insert-image-btn"]');

      // 模拟选择 6MB 图片（实际环境中需要真实文件）
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
      await page.locator('input[type="file"]').setInputFiles({
        name: 'large.jpg',
        mimeType: 'image/jpeg',
        buffer: largeBuffer
      });

      // 验证错误提示
      await expect(page.locator('text=图片大小不得超过 5MB')).toBeVisible();

      // 验证图片未添加到预览区
      await expect(page.locator('[data-testid="attachment-preview"]')).not.toBeVisible();
    });

    test('用户添加标签超过 10 个，前端拦截并提示', async ({ page }) => {
      const content = '#1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #11';

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      // 验证错误提示
      await expect(page.locator('text=每条笔记最多 10 个标签')).toBeVisible();
    });
  });
});

test.describe('创建笔记 - API 测试', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:3000'
    });

    // 登录获取 Session
    await apiContext.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: '12345678'
      }
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('正常场景', () => {
    test('有效内容和已登录用户，笔记创建成功', async () => {
      const response = await apiContext.post('/api/memos', {
        data: {
          content: '今天学习新知识'
        }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.content).toBe('今天学习新知识');
      expect(body.data).toHaveProperty('userId');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.message).toBe('创建成功');
    });

    test('带标签的笔记创建，标签被正确解析并关联', async () => {
      const response = await apiContext.post('/api/memos', {
        data: {
          content: '今天参加 #工作 会议'
        }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data.tags).toContain('工作');
    });

    test('笔记内容最大长度 10,000 字符，创建成功', async () => {
      const longContent = 'a'.repeat(10000);

      const response = await apiContext.post('/api/memos', {
        data: {
          content: longContent
        }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data.content.length).toBe(10000);
    });
  });

  test.describe('异常场景', () => {
    test('未登录时访问创建接口，返回 401', async ({ request }) => {
      const response = await request.post('/api/memos', {
        data: {
          content: '测试'
        }
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });

    test('content 为空字符串，返回 400', async () => {
      const response = await apiContext.post('/api/memos', {
        data: {
          content: ''
        }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('请求参数不合法');
    });

    test('content 缺失（未提供字段），返回 400', async () => {
      const response = await apiContext.post('/api/memos', {
        data: {}
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    test('content 超过 10,000 字符，返回 400', async () => {
      const longContent = 'a'.repeat(10001);

      const response = await apiContext.post('/api/memos', {
        data: {
          content: longContent
        }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    test('标签数量超过 10 个，返回 400', async () => {
      const response = await apiContext.post('/api/memos', {
        data: {
          content: '#1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #11'
        }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('TOO_MANY_TAGS');
      expect(body.message).toBe('每条笔记最多 10 个标签');
    });
  });
});
