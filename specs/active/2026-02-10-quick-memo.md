# Feature Spec: 快速记录 Memo

**作者**: 方世研
**日期**: 2026-02-10
**状态**: 已批准
**关联 Issue**: #1

---

## 1. 背景

Flomo 的核心价值是"无压力记录想法"。用户需要一个极简的输入框，
像发微博一样快速记下脑中闪过的想法。这个功能是 Flomo 的基石，
所有其他功能（标签管理、每日回顾等）都建立在它之上。

## 2. 用户故事

```
作为一个想记录想法的用户，
我希望打开应用后可以立即在输入框中写下我的想法，并支持用 #标签 分类，
点击发送后想法立即保存并显示在下方的时间线中，
以便我可以无负担地持续记录，并通过标签找回这些想法。
```

## 3. 功能描述

### 3.1 核心交互流程

```
用户打开页面
    ↓
看到顶部的输入框（自动聚焦）
    ↓
输入内容，可包含 #标签（如"今天的会议很有收获 #工作 #复盘"）
    ↓
点击「记下来」按钮（或 Ctrl/Cmd + Enter）
    ↓
Memo 存入数据库，标签自动解析并关联
    ↓
输入框清空，新 Memo 出现在下方列表顶部
    ↓
列表按时间倒序展示所有 Memo
```

### 3.2 页面布局

```
┌─────────────────────────────────────┐
│             Flomo MVP               │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 现在的想法是...              │   │
│  │                             │   │
│  │              [记下来]        │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─────── 2026年2月10日 ───────     │
│  ┌─────────────────────────────┐   │
│  │ 今天和团队讨论了AI开发流程    │   │
│  │ #工作 #AI                   │   │
│  │                    14:30    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 3.3 详细需求

**输入框**：
- [ ] 多行文本域（textarea），最少3行高度
- [ ] placeholder: "现在的想法是..."
- [ ] 页面加载后自动聚焦
- [ ] 支持 Ctrl/Cmd + Enter 快捷提交
- [ ] 输入长度限制：10,000 字符，超出时显示字数提示
- [ ] 空内容或纯空白时不允许提交（按钮变灰）

**标签解析**：
- [ ] 支持 `#标签` 格式自动识别
- [ ] 标签规则：`#` 后跟连续的非空白字符
- [ ] 支持中文标签：`#工作`、`#读书笔记`
- [ ] 支持英文标签：`#todo`、`#idea`
- [ ] 支持嵌套标签：`#工作/会议`
- [ ] 一条 Memo 可以有多个标签
- [ ] 标签在 Memo 中原位显示，渲染为高亮可点击样式

**Memo 展示**：
- [ ] 按创建时间倒序排列（最新在上）
- [ ] 每条 Memo 显示：正文内容 + 标签（高亮）+ 创建时间
- [ ] 同一天的 Memo 用日期分隔线分组
- [ ] 页面初始加载20条，滚动到底部时加载更多（无限滚动）

**「记下来」按钮**：
- [ ] 位于输入框右下角
- [ ] 无内容时禁用（灰色）
- [ ] 提交时显示 loading 状态
- [ ] 提交成功后清空输入框

## 4. 数据模型

```sql
CREATE TABLE memos (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memo_tags (
  memo_id     TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (memo_id, tag_id)
);
```

## 5. API 设计

- POST /api/v1/memos — 创建 Memo
- GET /api/v1/memos — 获取 Memo 列表

### 5.1 API 详细契约

**统一响应结构**
```json
{
  "success": true,
  "data": {},
  "error": {
    "code": "STRING",
    "message": "STRING"
  }
}
```

**创建 Memo**
```
POST /api/v1/memos
Content-Type: application/json
```

请求体：
```json
{
  "content": "今天的会议很有收获 #工作 #复盘"
}
```

成功响应：
```json
{
  "success": true,
  "data": {
    "id": "01JBAZ8K8Q1X4J2F9M1R7QW3A1",
    "content": "今天的会议很有收获 #工作 #复盘",
    "created_at": "2026-02-10T14:30:12.000Z",
    "tags": ["工作", "复盘"]
  },
  "error": null
}
```

错误响应示例（空内容）：
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEMO_EMPTY",
    "message": "内容不能为空"
  }
}
```

错误响应示例（超长）：
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEMO_TOO_LONG",
    "message": "内容长度不能超过10000字符"
  }
}
```

**获取 Memo 列表**
```
GET /api/v1/memos?limit=20&cursor=2026-02-10T14:30:12.000Z
```

参数：
- `limit`：每页条数，默认 20，最大 50
- `cursor`：可选，分页游标（上一页最后一条的 `created_at`）

成功响应：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "01JBAZ8K8Q1X4J2F9M1R7QW3A1",
        "content": "今天的会议很有收获 #工作 #复盘",
        "created_at": "2026-02-10T14:30:12.000Z",
        "tags": ["工作", "复盘"]
      }
    ],
    "next_cursor": "2026-02-10T14:30:12.000Z"
  },
  "error": null
}
```

## 6. 边界条件

- 空内容：拒绝提交
- 超长内容：超过 10,000 字符时前端阻止提交
- 相同标签：同一 Memo 中重复出现只存一次

### 6.1 标签解析细则（补充）
- `#` 后跟连续非空白字符，允许中文、英文、数字、`_`、`-`、`/`
- 标签与中文标点相邻时，标点不计入标签（例如 `#工作，` 解析为 `工作`）
- 标签大小写不敏感：`#Todo` 与 `#todo` 视为同一标签（存储为首次出现的原样）

### 6.2 时间与分组规则（补充）
- API 时间均使用 UTC ISO 8601
- UI 展示按浏览器本地时区显示
- 列表分组按本地日期（`YYYY年M月D日`）

### 6.3 数据库与 ORM 约束（补充）
- `id` 使用 ULID
- `tags.name` 唯一索引
- `memo_tags(memo_id, tag_id)` 复合主键
- `updated_at` 在更新时自动刷新

### 6.4 前端交互细则（补充）
- 提交中按钮禁用并显示 loading
- 提交失败在输入框下方提示错误信息
- 无限滚动触发：距离底部 200px 内加载下一页

## 7. 不包含

- ❌ 编辑/删除 Memo
- ❌ 搜索
- ❌ 用户认证
- ❌ 图片上传

## 8. 验证标准

- [ ] 功能流程完整跑通
- [ ] API 符合 Spec
- [ ] 构建成功
- [ ] 基础用例通过（空输入、超长、标签解析、分页）

<!-- pipeline-check: trigger CI workflows (v3) -->
