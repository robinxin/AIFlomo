import { test, expect } from '@playwright/test';

/**
 * 用户故事 4 E2E 测试：管理删除的笔记
 *
 * 验收场景：
 * 1. 用户在笔记列表删除一条笔记，该笔记从列表消失，回收站计数增加 1
 * 2. 用户进入回收站，点击「恢复」按钮，笔记回到正常列表
 * 3. 用户进入回收站，点击「永久删除」按钮，笔记不可恢复
 * 4. 回收站有 5 条已删除笔记时，进入回收站页面显示「回收站 (5)」
 */

test.describe('用户故事 4：管理删除的笔记', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
    await page.click('button:has-text("登录")');
    await page.waitForURL('/memo');
  });

  test.describe('验收场景 1：删除笔记后，该笔记从列表消失，回收站计数增加 1', () => {
    test('通过 UI 删除笔记，笔记从列表中消失', async ({ page }) => {
      const content = `待删除的笔记 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.reload();
      await page.waitForURL('/memo');

      const memoCard = page.locator(`[data-testid="memo-card-${createdMemo.id}"]`);
      await expect(memoCard).toBeVisible();

      await page.click(`[data-testid="memo-menu-btn-${createdMemo.id}"]`);

      const deleteBtn = page.locator(`[data-testid="memo-delete-btn-${createdMemo.id}"]`);
      await expect(deleteBtn).toBeVisible();
      await deleteBtn.click();

      const confirmDialog = page.locator('[data-testid="delete-confirm-dialog-confirm"]');
      await expect(confirmDialog).toBeVisible();
      await confirmDialog.click();

      await expect(memoCard).not.toBeVisible();
    });

    test('通过 API 软删除笔记，笔记在正常列表中不可见，在回收站中可见', async ({ page }) => {
      const content = `API 软删除测试 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const deleteResponse = await page.request.delete(`/api/memos/${createdMemo.id}`);
      expect(deleteResponse.status()).toBe(200);

      const memosResponse = await page.request.get('/api/memos');
      expect(memosResponse.status()).toBe(200);
      const memosBody = await memosResponse.json();
      const isInList = memosBody.data.some(m => m.id === createdMemo.id);
      expect(isInList).toBeFalsy();

      const trashResponse = await page.request.get('/api/memos/trash');
      expect(trashResponse.status()).toBe(200);
      const trashBody = await trashResponse.json();
      const isInTrash = trashBody.data.some(m => m.id === createdMemo.id);
      expect(isInTrash).toBeTruthy();
    });

    test('删除笔记后，回收站 API 返回的笔记中包含该条目', async ({ page }) => {
      const content = `回收站计数测试 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const trashBefore = await page.request.get('/api/memos/trash');
      const trashBodyBefore = await trashBefore.json();
      const countBefore = trashBodyBefore.data.length;

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      const trashAfter = await page.request.get('/api/memos/trash');
      const trashBodyAfter = await trashAfter.json();
      expect(trashBodyAfter.data.length).toBe(countBefore + 1);
    });

    test('DELETE /api/memos/:id 返回 200 并带有成功消息', async ({ page }) => {
      const content = `删除响应格式测试 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const deleteResponse = await page.request.delete(`/api/memos/${createdMemo.id}`);
      expect(deleteResponse.status()).toBe(200);

      const body = await deleteResponse.json();
      expect(body.data).toBeTruthy();
      expect(body.message).toBeTruthy();
    });
  });

  test.describe('验收场景 2：进入回收站，点击「恢复」按钮，笔记回到正常列表', () => {
    test('通过 UI 恢复回收站中的笔记，笔记出现在正常笔记列表', async ({ page }) => {
      const content = `待恢复的笔记 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      const restoreBtn = page.locator(`[data-testid="trash-restore-btn-${createdMemo.id}"]`);
      await expect(restoreBtn).toBeVisible();
      await restoreBtn.click();

      const restoreDialog = page.locator('[data-testid="trash-restore-dialog-confirm"]');
      await expect(restoreDialog).toBeVisible();
      await restoreDialog.click();

      await expect(page.locator(`[data-testid="trash-card-${createdMemo.id}"]`)).not.toBeVisible();

      const memosResponse = await page.request.get('/api/memos');
      const memosBody = await memosResponse.json();
      const isRestored = memosBody.data.some(m => m.id === createdMemo.id);
      expect(isRestored).toBeTruthy();
    });

    test('通过 API 恢复笔记，返回 200，笔记从回收站消失', async ({ page }) => {
      const content = `API 恢复测试 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      const restoreResponse = await page.request.post(`/api/memos/${createdMemo.id}/restore`);
      expect(restoreResponse.status()).toBe(200);

      const body = await restoreResponse.json();
      expect(body.message).toBeTruthy();

      const trashResponse = await page.request.get('/api/memos/trash');
      const trashBody = await trashResponse.json();
      const isStillInTrash = trashBody.data.some(m => m.id === createdMemo.id);
      expect(isStillInTrash).toBeFalsy();

      const memosResponse = await page.request.get('/api/memos');
      const memosBody = await memosResponse.json();
      const isInMemos = memosBody.data.some(m => m.id === createdMemo.id);
      expect(isInMemos).toBeTruthy();
    });

    test('恢复笔记后，笔记内容完整保留', async ({ page }) => {
      const content = `内容完整性验证 #标签测试 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);
      await page.request.post(`/api/memos/${createdMemo.id}/restore`);

      const memosResponse = await page.request.get('/api/memos');
      const memosBody = await memosResponse.json();
      const restoredMemo = memosBody.data.find(m => m.id === createdMemo.id);
      expect(restoredMemo).toBeTruthy();
      expect(restoredMemo.content).toBe(content);
    });
  });

  test.describe('验收场景 3：进入回收站，点击「永久删除」按钮，笔记不可恢复', () => {
    test('通过 UI 永久删除笔记，笔记从回收站消失', async ({ page }) => {
      const content = `待永久删除的笔记 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      const permanentDeleteBtn = page.locator(`[data-testid="trash-permanent-delete-btn-${createdMemo.id}"]`);
      await expect(permanentDeleteBtn).toBeVisible();
      await permanentDeleteBtn.click();

      const confirmBtn = page.locator(`[data-testid="trash-confirm-dialog-${createdMemo.id}-confirm"]`);
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();

      await expect(page.locator(`[data-testid="trash-card-${createdMemo.id}"]`)).not.toBeVisible();
    });

    test('通过 API 永久删除笔记，返回 200，笔记从回收站彻底消失', async ({ page }) => {
      const content = `API 永久删除测试 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      const permanentDeleteResponse = await page.request.delete(`/api/memos/${createdMemo.id}/permanent`);
      expect(permanentDeleteResponse.status()).toBe(200);

      const trashResponse = await page.request.get('/api/memos/trash');
      const trashBody = await trashResponse.json();
      const isInTrash = trashBody.data.some(m => m.id === createdMemo.id);
      expect(isInTrash).toBeFalsy();

      const memosResponse = await page.request.get('/api/memos');
      const memosBody = await memosResponse.json();
      const isInMemos = memosBody.data.some(m => m.id === createdMemo.id);
      expect(isInMemos).toBeFalsy();
    });

    test('永久删除后无法通过恢复接口找回笔记（返回 404）', async ({ page }) => {
      const content = `不可恢复验证 ${Date.now()}`;

      const createResponse = await page.request.post('/api/memos', {
        data: { content }
      });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);
      await page.request.delete(`/api/memos/${createdMemo.id}/permanent`);

      const restoreResponse = await page.request.post(`/api/memos/${createdMemo.id}/restore`);
      expect(restoreResponse.status()).toBe(404);
    });
  });

  test.describe('验收场景 4：回收站有 N 条笔记时，显示「回收站 (N)」', () => {
    test('进入回收站页面，标题头部显示正确的笔记数量', async ({ page }) => {
      const note1 = await page.request.post('/api/memos', { data: { content: `回收站计数测试1 ${Date.now()}` } });
      const { data: memo1 } = await note1.json();

      const note2 = await page.request.post('/api/memos', { data: { content: `回收站计数测试2 ${Date.now()}` } });
      const { data: memo2 } = await note2.json();

      await page.request.delete(`/api/memos/${memo1.id}`);
      await page.request.delete(`/api/memos/${memo2.id}`);

      const trashResponse = await page.request.get('/api/memos/trash');
      const trashBody = await trashResponse.json();
      const totalInTrash = trashBody.data.length;

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      if (totalInTrash > 0) {
        const countLabel = page.locator('[data-testid="trash-count-label"]');
        await expect(countLabel).toBeVisible();
        await expect(countLabel).toContainText(`回收站 (${totalInTrash})`);
      }
    });

    test('GET /api/memos/trash 返回 200 并包含回收站笔记数组', async ({ page }) => {
      const response = await page.request.get('/api/memos/trash');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.message).toBe('ok');

      for (const memo of body.data) {
        expect(memo.deletedAt).toBeTruthy();
      }
    });

    test('回收站为空时，显示空状态提示「回收站为空」', async ({ page }) => {
      const trashResponse = await page.request.get('/api/memos/trash');
      const trashBody = await trashResponse.json();

      for (const memo of trashBody.data) {
        await page.request.delete(`/api/memos/${memo.id}/permanent`);
      }

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      const emptyState = page.locator('[data-testid="trash-empty"]');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('回收站为空');
    });
  });

  test.describe('补充场景：回收站页面结构与导航', () => {
    test('进入回收站页面，显示回收站标题和笔记列表', async ({ page }) => {
      await page.goto('/memo/trash');

      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();
      await expect(page.locator('[data-testid="trash-page-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="trash-page-title"]')).toContainText('回收站');
    });

    test('回收站中每条笔记卡片显示「已删除」标签', async ({ page }) => {
      const content = `显示已删除标签 ${Date.now()}`;
      const createResponse = await page.request.post('/api/memos', { data: { content } });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      const deletedLabel = page.locator(`[data-testid="trash-deleted-label-${createdMemo.id}"]`);
      await expect(deletedLabel).toBeVisible();
      await expect(deletedLabel).toContainText('已删除');
    });

    test('回收站中每条笔记显示恢复和永久删除两个操作按钮', async ({ page }) => {
      const content = `操作按钮验证 ${Date.now()}`;
      const createResponse = await page.request.post('/api/memos', { data: { content } });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      await expect(page.locator(`[data-testid="trash-restore-btn-${createdMemo.id}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="trash-permanent-delete-btn-${createdMemo.id}"]`)).toBeVisible();
    });

    test('回收站笔记内容在卡片中可读，标签信息保留', async ({ page }) => {
      const tag = `回收站标签${Date.now()}`;
      const content = `回收站内容完整性 #${tag}`;
      const createResponse = await page.request.post('/api/memos', { data: { content } });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      const trashCard = page.locator(`[data-testid="trash-card-${createdMemo.id}"]`);
      await expect(trashCard).toBeVisible();

      const trashContent = page.locator(`[data-testid="trash-content-${createdMemo.id}"]`);
      await expect(trashContent).toBeVisible();
    });
  });

  test.describe('认证保护', () => {
    test('未登录用户直接访问 /memo/trash，跳转到登录页', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/memo/trash');
      await page.waitForURL('/login');
      await expect(page.locator('text=请先登录')).toBeVisible();
    });

    test('未登录状态下调用 GET /api/memos/trash，返回 401', async ({ request }) => {
      const response = await request.get('/api/memos/trash');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('请先登录');
    });

    test('未登录状态下调用 DELETE /api/memos/:id，返回 401', async ({ request }) => {
      const response = await request.delete('/api/memos/non-existent-id');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
    });

    test('未登录状态下调用 POST /api/memos/:id/restore，返回 401', async ({ request }) => {
      const response = await request.post('/api/memos/non-existent-id/restore');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
    });

    test('未登录状态下调用 DELETE /api/memos/:id/permanent，返回 401', async ({ request }) => {
      const response = await request.delete('/api/memos/non-existent-id/permanent');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('边界场景', () => {
    test('删除回收站中最后一条笔记后，显示「回收站为空」提示', async ({ page }) => {
      const content = `最后一条笔记 ${Date.now()}`;
      const createResponse = await page.request.post('/api/memos', { data: { content } });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      await page.request.delete(`/api/memos/${createdMemo.id}`);

      const trashResponse = await page.request.get('/api/memos/trash');
      const trashBody = await trashResponse.json();

      for (const memo of trashBody.data) {
        if (memo.id !== createdMemo.id) {
          await page.request.delete(`/api/memos/${memo.id}/permanent`);
        }
      }

      await page.goto('/memo/trash');
      await expect(page.locator('[data-testid="trash-screen"]')).toBeVisible();

      const permanentDeleteBtn = page.locator(`[data-testid="trash-permanent-delete-btn-${createdMemo.id}"]`);
      await expect(permanentDeleteBtn).toBeVisible();
      await permanentDeleteBtn.click();

      const confirmBtn = page.locator(`[data-testid="trash-confirm-dialog-${createdMemo.id}-confirm"]`);
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();

      const emptyState = page.locator('[data-testid="trash-empty"]');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('回收站为空');
    });

    test('操作不属于自己的笔记返回 403 或 404', async ({ page }) => {
      const deleteResponse = await page.request.delete('/api/memos/definitely-not-my-memo-id');
      expect([403, 404]).toContain(deleteResponse.status());
    });

    test('对不在回收站的笔记调用 restore 接口，返回 404', async ({ page }) => {
      const content = `未删除的笔记 ${Date.now()}`;
      const createResponse = await page.request.post('/api/memos', { data: { content } });
      expect(createResponse.status()).toBe(201);
      const { data: createdMemo } = await createResponse.json();

      const restoreResponse = await page.request.post(`/api/memos/${createdMemo.id}/restore`);
      expect(restoreResponse.status()).toBe(404);

      await page.request.delete(`/api/memos/${createdMemo.id}/permanent`).catch(() => {});
    });
  });
});
