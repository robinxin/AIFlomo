# Feature Spec: Memo 标签过滤

**作者**: Claude AI
**日期**: 2026-03-03
**状态**: 已批准
**关联 Issue**: #16

---

## 1. 背景

当前用户可以为 Memo 添加标签（例如 #工作、#想法），但无法通过标签快速筛选和回顾特定主题的 Memo。为了提升内容组织能力和回顾效率，需要支持点击标签后过滤列表的功能。

## 2. 用户故事

```
作为用户
我希望点击标签后只看到该标签的 Memo
以便快速回顾特定主题的内容
```

## 3. 功能描述

### 交互流程
1. 用户在主页看到 Memo 列表和标签云（或 Memo 中的标签）
2. 用户点击任意标签（例如点击 #工作）
3. 页面 URL 更新为 `/?tag=工作`
4. 列表仅展示包含该标签的 Memo
5. 用户可以点击"清除筛选"或返回首页查看所有 Memo

### 页面布局
- **首页** (`apps/flomo/app/page.tsx`)
  - 顶部：筛选状态提示（例如"正在筛选：#工作"）+ 清除按钮
  - 中间：Memo 列表（根据 URL 参数 `tag` 过滤）
  - Memo 内标签可点击，点击后触发过滤

### 详细需求
- 标签点击后通过 URL 参数传递（`?tag=<标签名>`）
- 支持浏览器前进/后退（URL 驱动）
- 无匹配 Memo 时显示空状态："暂无「#<标签名>」相关记录"
- 过滤时保持时间倒序排列
- 清除筛选后恢复展示全部 Memo

## 4. 数据模型

无需修改现有 Prisma schema，当前 `Memo` 表已包含 `tags` 字段：

```prisma
model Memo {
  id        Int      @id @default(autoincrement())
  content   String
  tags      String   // JSON 数组字符串，例如 '["工作", "想法"]'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 5. API 设计

### 5.1 获取 Memo 列表（支持标签过滤）

**Endpoint**: `GET /api/memos`

**请求参数**（Query Params）:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tag  | string | 否   | 标签名（不带 # 符号） |

**成功响应** (200):
```json
{
  "data": [
    {
      "id": 1,
      "content": "今天完成了功能开发 #工作",
      "tags": ["工作"],
      "createdAt": "2026-03-03T10:00:00.000Z",
      "updatedAt": "2026-03-03T10:00:00.000Z"
    }
  ],
  "error": null,
  "message": "成功获取 Memo 列表"
}
```

**空结果响应** (200):
```json
{
  "data": [],
  "error": null,
  "message": "成功获取 Memo 列表"
}
```

**错误响应** (500):
```json
{
  "data": null,
  "error": "DATABASE_ERROR",
  "message": "查询失败"
}
```

### 5.2 实现逻辑

- 后端接收 `tag` 参数后，使用 Prisma `where` 子句过滤
- 由于 `tags` 字段存储为 JSON 字符串，需要使用 `contains` 或解析后过滤
- 示例查询（Prisma）:
  ```typescript
  const memos = await prisma.memo.findMany({
    where: tag ? {
      tags: {
        contains: tag  // SQLite 字符串包含查询
      }
    } : {},
    orderBy: { createdAt: 'desc' }
  });
  ```

## 6. 边界条件

### 禁止场景
- 不支持同时筛选多个标签（本次仅单标签过滤）
- 不支持模糊搜索标签（必须完全匹配）

### 错误处理
- 如果 `tag` 参数为空字符串，视为无过滤条件
- 如果 `tag` 参数包含特殊字符（例如 `#`），需要 URL 编码
- 数据库查询失败时返回 500 错误

### 输入验证
- 前端：URL 参数通过 `useSearchParams` 读取，无需额外验证
- 后端：`tag` 参数长度限制 ≤ 50 字符

## 7. 不包含

本次 **不做** 以下功能：
- 多标签组合过滤（AND/OR 逻辑）
- 标签模糊搜索或自动补全
- 标签管理页面（重命名、合并、删除标签）
- 标签使用频率统计
- 保存筛选条件到用户偏好

## 8. 验证标准

### 功能验证
- [ ] 点击 Memo 中的标签后，URL 更新为 `/?tag=<标签名>`
- [ ] 列表仅展示包含该标签的 Memo
- [ ] 显示筛选状态提示（例如"正在筛选：#工作"）
- [ ] 点击"清除筛选"后恢复全部 Memo
- [ ] 无匹配 Memo 时显示空状态
- [ ] 浏览器前进/后退按钮正常工作

### 技术验证
- [ ] API `/api/memos?tag=<标签名>` 返回正确过滤结果
- [ ] 空标签参数时返回全部 Memo
- [ ] 不存在的标签返回空数组（非错误）
- [ ] TypeScript 无类型错误
- [ ] `npm run build` 成功通过

### 性能验证
- [ ] 列表过滤响应时间 < 500ms（假设数据量 < 1000 条）
- [ ] URL 参数变化时页面无全量刷新（使用 Next.js 客户端导航）
