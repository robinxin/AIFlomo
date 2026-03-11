import { test, expect } from '@playwright/test';

/**
 * 用户故事 2 E2E 测试：创建和编辑笔记
 *
 * 验收场景：
 * 1. 用户点击「新建笔记」按钮并输入内容，笔记被创建并显示在列表顶部
 * 2. 用户正在创建笔记时输入 #标签名 格式的文本，系统自动识别为标签
 * 3. 用户正在创建笔记时点击插入图片按钮并选择图片，图片被添加到笔记中
 * 4. 用户正在创建笔记时粘贴链接地址，系统识别并标记该笔记为「有链接」类型
 * 5. 用户创建了一条带图片的笔记，返回列表页后「有图片」筛选项计数增加 1
 */

test.describe('用户故事 2：创建和编辑笔记', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
    await page.click('button:has-text("登录")');
    await page.waitForURL('/memo');
  });

  test.describe('验收场景 1：用户点击新建笔记按钮并输入内容，笔记被创建并显示在列表顶部', () => {
    test('输入纯文本内容并提交，笔记出现在列表顶部，输入框清空', async ({ page }) => {
      const content = `今天学习新知识 ${Date.now()}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      await expect(page.locator('[data-testid="memo-input"]')).toHaveValue('');

      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo).toContainText(content);
    });

    test('创建成功后显示成功提示', async ({ page }) => {
      const content = `创建提示测试 ${Date.now()}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      await expect(page.locator('text=创建成功')).toBeVisible();
    });

    test('通过 API 创建笔记，返回 201 并包含 id 和 createdAt', async ({ page }) => {
      const content = `API 创建测试 ${Date.now()}`;

      const response = await page.request.post('/api/memos', {
        data: { content }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.content).toBe(content);
      expect(body.data).toHaveProperty('createdAt');
      expect(body.message).toBe('创建成功');
    });

    test('新创建的笔记排在列表最顶部（最新在前）', async ({ page }) => {
      const content = `置顶验证测试 ${Date.now()}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo).toContainText(content);

      const firstTime = await firstMemo.getAttribute('data-created-at');
      const secondMemo = page.locator('[data-testid="memo-card"]').nth(1);
      const secondTime = await secondMemo.getAttribute('data-created-at');

      if (firstTime && secondTime) {
        expect(new Date(firstTime) >= new Date(secondTime)).toBeTruthy();
      }
    });
  });

  test.describe('验收场景 2：输入 #标签名 格式的文本，系统自动识别为标签', () => {
    test('创建带单个标签的笔记，标签在卡片中可见', async ({ page }) => {
      const content = `今天完成 #工作 任务 ${Date.now()}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator('[data-testid="tag"]:has-text("工作")')).toBeVisible();
    });

    test('创建带多个标签的笔记，所有标签在卡片中可见', async ({ page }) => {
      const content = `学习 #技术 和 #编程 知识 ${Date.now()}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator('[data-testid="tag"]:has-text("技术")')).toBeVisible();
      await expect(firstMemo.locator('[data-testid="tag"]:has-text("编程")')).toBeVisible();
    });

    test('创建带标签的笔记后，左侧标签树新增该标签', async ({ page }) => {
      const tagName = `标签${Date.now()}`;
      const content = `测试标签树 #${tagName}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      await expect(page.locator(`[data-testid="tag-list"] >> text=${tagName}`)).toBeVisible();
    });

    test('通过 API 创建带标签笔记，返回数据中包含标签', async ({ page }) => {
      const response = await page.request.post('/api/memos', {
        data: { content: '今天参加 #工作 会议' }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data.tags).toBeDefined();
      expect(body.data.tags.some(tag => tag.name === '工作')).toBeTruthy();
    });

    test('「有标签」类型筛选计数在创建带标签笔记后增加', async ({ page }) => {
      const filterTagged = page.locator('[data-testid="filter-tagged"]');
      const beforeText = await filterTagged.textContent();
      const beforeCount = parseInt(beforeText.match(/\d+/)?.[0] ?? '0', 10);

      const content = `计数验证 #测试标签 ${Date.now()}`;
      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      await expect(filterTagged).toContainText(String(beforeCount + 1));
    });
  });

  test.describe('验收场景 3：点击插入图片按钮并选择图片，图片被添加到笔记中', () => {
    test('选择图片后，附件预览出现在输入区域下方', async ({ page }) => {
      await page.fill('[data-testid="memo-input"]', '测试图片笔记');

      await page.click('[data-testid="insert-image-btn"]');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
      });

      await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="remove-attachment-btn"]')).toBeVisible();
    });

    test('带图片的笔记提交后，笔记卡片显示图片附件', async ({ page }) => {
      await page.fill('[data-testid="memo-input"]', '带图片的笔记');

      await page.click('[data-testid="insert-image-btn"]');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
      });

      await page.click('button:has-text("发送")');

      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator('[data-testid="memo-image"]')).toBeVisible();
    });

    test('可以删除已选择的图片附件', async ({ page }) => {
      await page.fill('[data-testid="memo-input"]', '测试删除图片');

      await page.click('[data-testid="insert-image-btn"]');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
      });

      await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();

      await page.click('[data-testid="remove-attachment-btn"]');

      await expect(page.locator('[data-testid="attachment-preview"]')).not.toBeVisible();
    });

    test('选择超过 5MB 图片时，前端拦截并提示错误', async ({ page }) => {
      await page.fill('[data-testid="memo-input"]', '测试大图片');

      await page.click('[data-testid="insert-image-btn"]');

      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
      await page.locator('input[type="file"]').setInputFiles({
        name: 'large.jpg',
        mimeType: 'image/jpeg',
        buffer: largeBuffer
      });

      await expect(page.locator('text=图片大小不得超过 5MB')).toBeVisible();
      await expect(page.locator('[data-testid="attachment-preview"]')).not.toBeVisible();
    });
  });

  test.describe('验收场景 4：粘贴链接地址，系统识别并标记笔记为「有链接」类型', () => {
    test('输入含 URL 的笔记，提交后笔记卡片显示链接', async ({ page }) => {
      const content = `查看资料 https://example.com ${Date.now()}`;

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      const firstMemo = page.locator('[data-testid="memo-card"]').first();
      await expect(firstMemo.locator('a[href="https://example.com"]')).toBeVisible();
    });

    test('含链接的笔记提交后，「有链接」筛选项计数增加', async ({ page }) => {
      const filterLink = page.locator('[data-testid="filter-link"]');
      const beforeText = await filterLink.textContent();
      const beforeCount = parseInt(beforeText.match(/\d+/)?.[0] ?? '0', 10);

      const content = `测试链接笔记 https://playwright.dev ${Date.now()}`;
      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      await expect(filterLink).toContainText(String(beforeCount + 1));
    });

    test('通过 API 创建含链接笔记，返回数据中 hasLink 为 1', async ({ page }) => {
      const response = await page.request.post('/api/memos', {
        data: { content: '参考链接 https://example.com' }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data.hasLink).toBe(1);
    });
  });

  test.describe('验收场景 5：创建带图片笔记后，「有图片」筛选项计数增加 1', () => {
    test('创建带图片笔记前后，「有图片」计数差为 1', async ({ page }) => {
      const filterImage = page.locator('[data-testid="filter-image"]');
      const beforeText = await filterImage.textContent();
      const beforeCount = parseInt(beforeText.match(/\d+/)?.[0] ?? '0', 10);

      await page.fill('[data-testid="memo-input"]', '带图片的统计测试');

      await page.click('[data-testid="insert-image-btn"]');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
      });

      await page.click('button:has-text("发送")');

      await expect(filterImage).toContainText(String(beforeCount + 1));
    });

    test('通过 API 创建带图片笔记，返回数据中 hasImage 为 1', async ({ page }) => {
      const response = await page.request.post('/api/memos', {
        data: {
          content: '带图片的 API 测试',
          attachments: [{ type: 'image', url: '/uploads/test.png' }]
        }
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data.hasImage).toBe(1);
    });
  });

  test.describe('异常场景：输入校验', () => {
    test('输入框为空时点击发送，前端给出"内容不能为空"提示', async ({ page }) => {
      await page.click('button:has-text("发送")');

      await expect(page.locator('text=内容不能为空')).toBeVisible();
      await expect(page.locator('[data-testid="memo-input"]')).toBeFocused();
    });

    test('输入内容超过 10,000 字符时，前端拦截并提示', async ({ page }) => {
      const longContent = 'a'.repeat(10001);

      await page.fill('[data-testid="memo-input"]', longContent);
      await page.click('button:has-text("发送")');

      await expect(page.locator('text=内容不得超过 10,000 字符')).toBeVisible();
    });

    test('标签数量超过 10 个时，前端拦截并提示', async ({ page }) => {
      const content = '#1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #11';

      await page.fill('[data-testid="memo-input"]', content);
      await page.click('button:has-text("发送")');

      await expect(page.locator('text=每条笔记最多 10 个标签')).toBeVisible();
    });

    test('通过 API 提交空内容，返回 400 VALIDATION_ERROR', async ({ page }) => {
      const response = await page.request.post('/api/memos', {
        data: { content: '' }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    test('通过 API 提交超长内容，返回 400 VALIDATION_ERROR', async ({ page }) => {
      const response = await page.request.post('/api/memos', {
        data: { content: 'a'.repeat(10001) }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    test('通过 API 提交超过 10 个标签，返回 400 TOO_MANY_TAGS', async ({ page }) => {
      const response = await page.request.post('/api/memos', {
        data: { content: '#1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #11' }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('TOO_MANY_TAGS');
      expect(body.message).toBe('每条笔记最多 10 个标签');
    });
  });

  test.describe('认证保护', () => {
    test('未登录用户直接访问 /memo，跳转到登录页', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/memo');
      await page.waitForURL('/login');
      await expect(page.locator('text=请先登录')).toBeVisible();
    });

    test('未登录状态下调用 POST /api/memos，返回 401', async ({ request }) => {
      const response = await request.post('/api/memos', {
        data: { content: '未登录测试' }
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });
  });
});
