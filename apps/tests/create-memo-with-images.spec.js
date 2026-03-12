// 测试用例：创建带图片的笔记
// 对应文档：specs/active/45-create-memo-and-memo-list-1-testcases.md

import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带图片的笔记 - UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('选择本地图片（1.5MB JPG），预览显示正常', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const imageBtn = page.locator('[data-testid="image-btn"]');

    // 1. 在输入框中输入"今天的美食"
    await input.fill('今天的美食');

    // 2. 点击"📷图片"按钮
    await imageBtn.click();

    // 3. 从本地相册选择一张 1.5MB 的 JPG 图片
    // 使用 Playwright 的文件选择器模拟
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1.5 * 1024 * 1024), // 1.5MB
    });

    // 预期结果：本地图片选择器关闭
    // 预期结果：输入框下方显示图片缩略图
    const thumbnail = page.locator('[data-testid="image-thumbnail"]');
    await expect(thumbnail).toBeVisible();

    // 预期结果：缩略图右上角显示删除按钮（× 图标）
    const deleteBtn = thumbnail.locator('[data-testid="image-delete-btn"]');
    await expect(deleteBtn).toBeVisible();

    // 预期结果：图片未上传时可能显示上传进度条
    // （此处根据实际实现验证）
  });

  test('添加图片后点击删除按钮，图片从笔记中移除', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const imageBtn = page.locator('[data-testid="image-btn"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 前置条件：用户已添加一张图片
    await input.fill('测试删除图片');
    await imageBtn.click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1 * 1024 * 1024), // 1MB
    });

    const thumbnail = page.locator('[data-testid="image-thumbnail"]');
    await expect(thumbnail).toBeVisible();

    // 1. 点击图片缩略图右上角的删除按钮（× 图标）
    const deleteBtn = thumbnail.locator('[data-testid="image-delete-btn"]');
    await deleteBtn.click();

    // 预期结果：图片缩略图从界面消失
    await expect(thumbnail).not.toBeVisible();

    // 预期结果：点击"发布"后，笔记不包含该图片
    await publishBtn.click();

    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    await expect(firstMemoCard.locator('[data-testid="memo-image"]')).not.toBeVisible();
  });

  test('添加多张图片（最多 9 张），全部显示在笔记中', async ({ page }) => {
    const input = page.locator('[data-testid="memo-input"]');
    const imageBtn = page.locator('[data-testid="image-btn"]');
    const publishBtn = page.locator('[data-testid="publish-btn"]');

    // 1. 在输入框中输入"今天的相册"
    await input.fill('今天的相册');

    // 2. 点击"📷图片"按钮，连续选择 9 张图片
    await imageBtn.click();

    const fileInput = page.locator('input[type="file"]');

    // 创建 9 张模拟图片
    const files = Array.from({ length: 9 }, (_, i) => ({
      name: `image-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1 * 1024 * 1024), // 1MB each
    }));

    await fileInput.setInputFiles(files);

    // 预期结果：输入框下方显示 9 张图片缩略图
    const thumbnails = page.locator('[data-testid="image-thumbnail"]');
    await expect(thumbnails).toHaveCount(9);

    // 3. 点击"发布"按钮
    await publishBtn.click();

    // 预期结果：笔记成功发布
    await expect(page.locator('[data-testid="toast"]')).toContainText(/发布成功|创建成功/);

    // 预期结果：笔记卡片显示 9 张图片缩略图
    const firstMemoCard = page.locator('[data-testid="memo-card"]').first();
    const memoImages = firstMemoCard.locator('[data-testid="memo-image"]');
    await expect(memoImages).toHaveCount(9);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// UI 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带图片的笔记 - UI 异常场景', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('选择第 10 张图片时，系统提示"最多添加 9 张图片"', async ({ page }) => {
    const imageBtn = page.locator('[data-testid="image-btn"]');

    // 前置条件：用户已添加 9 张图片
    await imageBtn.click();

    const fileInput = page.locator('input[type="file"]');
    const files = Array.from({ length: 9 }, (_, i) => ({
      name: `image-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1 * 1024 * 1024),
    }));

    await fileInput.setInputFiles(files);

    const thumbnails = page.locator('[data-testid="image-thumbnail"]');
    await expect(thumbnails).toHaveCount(9);

    // 1. 点击"📷图片"按钮
    await imageBtn.click();

    // 2. 尝试选择第 10 张图片
    await fileInput.setInputFiles({
      name: 'image-10.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1 * 1024 * 1024),
    });

    // 预期结果：显示提示："最多添加 9 张图片"
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toContainText('最多添加 9 张图片');

    // 预期结果：第 10 张图片未添加
    await expect(thumbnails).toHaveCount(9);
  });

  test('上传的图片超过 5MB，系统提示错误', async ({ page }) => {
    const imageBtn = page.locator('[data-testid="image-btn"]');

    // 1. 点击"📷图片"按钮
    await imageBtn.click();

    // 2. 选择一张 6MB 的图片
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'large-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(6 * 1024 * 1024), // 6MB
    });

    // 预期结果：显示提示："图片大小不能超过 5MB"
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toContainText('图片大小不能超过 5MB');

    // 预期结果：图片未添加到笔记
    const thumbnails = page.locator('[data-testid="image-thumbnail"]');
    await expect(thumbnails).toHaveCount(0);
  });

  test('上传不支持的图片格式（如 PSD、TIFF），系统提示错误', async ({ page }) => {
    const imageBtn = page.locator('[data-testid="image-btn"]');

    // 1. 点击"📷图片"按钮
    await imageBtn.click();

    // 2. 选择一张 PSD 格式的文件
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'design.psd',
      mimeType: 'image/vnd.adobe.photoshop',
      buffer: Buffer.alloc(1 * 1024 * 1024),
    });

    // 预期结果：显示提示："仅支持 JPG、PNG、GIF 格式"
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toContainText(/仅支持.*JPG.*PNG.*GIF/);

    // 预期结果：图片未添加到笔记
    const thumbnails = page.locator('[data-testid="image-thumbnail"]');
    await expect(thumbnails).toHaveCount(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 正常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带图片的笔记 - API 测试', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
    // TODO: 登录获取 Session Cookie
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('创建笔记时传入图片 URL 数组（9 张以内），关联成功', async () => {
    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        imageUrls: ['/uploads/images/img1.jpg', '/uploads/images/img2.jpg'],
      },
    });

    // 预期结果：接口返回 201
    expect(response.status()).toBe(201);

    const body = await response.json();

    // 预期结果：响应体 data.images 数组包含 2 个图片对象
    expect(body.data.images.length).toBe(2);

    // TODO: 验证数据库 memo_images 表中新增 2 条记录
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API 测试场景 - 异常场景
// ────────────────────────────────────────────────────────────────────────────

test.describe('创建带图片的笔记 - API 异常场景', () => {
  let apiContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
    // TODO: 登录获取 Session Cookie
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('imageUrls 数组超过 9 项，返回 400', async () => {
    const imageUrls = Array.from({ length: 10 }, (_, i) => `/uploads/images/img${i + 1}.jpg`);

    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        imageUrls,
      },
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);

    const body = await response.json();

    // 预期结果：响应体包含错误信息
    expect(body).toMatchObject({
      data: null,
      error: 'VALIDATION_ERROR',
      message: expect.stringContaining('请求参数不合法'),
    });
  });

  test('imageUrls 数组中包含非法 URL 格式，返回 400', async () => {
    const response = await apiContext.post('/api/memos', {
      data: {
        content: '测试',
        imageUrls: ['not-a-url'],
      },
    });

    // 预期结果：接口返回 400
    expect(response.status()).toBe(400);
  });
});
