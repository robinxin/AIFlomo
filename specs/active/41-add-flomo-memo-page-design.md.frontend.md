# §4 前端页面与组件设计 — Flomo 笔记页面 (#41)

**生成时间**: 2026-03-10
**Spec 来源**: `specs/active/41-add-flomo-memo-page.md`
**数据模型来源**: `specs/active/41-add-flomo-memo-page-design.md.architect.md`
**设计范围**: §4 前端页面与组件

---

## 4.1 路由页面结构（Screens）

所有路由文件位于 `apps/mobile/app/`，遵循 Expo Router 文件路由约定（kebab-case + `.jsx`）。

### 4.1.1 目录结构总览

```
apps/mobile/app/
├── _layout.jsx                     # 根布局：挂载 AuthProvider + MemoProvider
├── index.jsx                       # / — 重定向入口（已登录 → /memo，未登录 → /login）
├── (auth)/
│   ├── _layout.jsx                 # 认证组路由布局（Stack，无顶栏）
│   ├── login.jsx                   # /login — 登录页
│   └── register.jsx                # /register — 注册页
└── (app)/
    ├── _layout.jsx                 # 主应用布局（Tabs：记录 / 搜索 / 我的）
    └── memo/
        ├── index.jsx               # /memo — 笔记主页（列表 + 侧边筛选 + 输入框）
        ├── search.jsx              # /memo/search — 全文搜索结果页
        └── trash.jsx               # /memo/trash — 回收站页
```

### 4.1.2 各 Screen 说明

#### `app/_layout.jsx` — 根布局

- **URL**: 无（布局文件）
- **职责**: 在最外层挂载 `AuthProvider` 和 `MemoProvider`，包裹整个 `Stack` 导航
- **关键逻辑**: 渲染 `<AuthProvider><MemoProvider><Stack /></MemoProvider></AuthProvider>`

#### `app/index.jsx` — 重定向入口

- **URL**: `/`
- **职责**: 读取 `AuthContext` 登录状态，已登录跳转 `/memo`，未登录跳转 `/login`
- **渲染内容**: 纯逻辑跳转，显示短暂加载指示器

#### `app/(auth)/_layout.jsx` — 认证组布局

- **URL**: 无（布局文件）
- **职责**: Stack 导航，`headerShown: false`，用于 `/login` 和 `/register`

#### `app/(auth)/login.jsx` — 登录页

- **URL**: `/login`
- **职责**: 用户输入邮箱 + 密码，调用 `/api/auth/login`，成功后跳转 `/memo`
- **使用组件**: `AuthForm`

#### `app/(auth)/register.jsx` — 注册页

- **URL**: `/register`
- **职责**: 用户输入邮箱 + 昵称 + 密码，调用 `/api/auth/register`，成功后跳转 `/login`
- **使用组件**: `AuthForm`

#### `app/(app)/_layout.jsx` — 主应用 Tab 布局

- **URL**: 无（布局文件）
- **职责**: 提供底部三 Tab 导航（记录 / 搜索 / 我的）
- **Guard**: 渲染前检查登录状态，未登录重定向 `/login`

```
Tab 配置：
- 记录（memo/index）   — 笔记列表主页
- 搜索（memo/search）  — 全文搜索页
- 我的（memo/trash）   — 回收站（或个人统计入口，视 UI 布局决定）
```

> 注：Flomo 参考产品主要是单页布局，侧边栏在大屏展示，小屏折叠。Tab 底栏为移动端导航方案。

#### `app/(app)/memo/index.jsx` — 笔记主页（P1 核心页面）

- **URL**: `/memo`
- **职责**: 应用核心页面，提供：
  1. 顶部快速输入框（常驻，点击展开编辑器）
  2. 左侧/顶部筛选侧边栏（标签列表 + 类型筛选）
  3. 笔记列表（按 `createdAt` 倒序）
  4. 统计信息 + 热力图入口
- **使用组件**: `MemoInput`, `MemoList`, `MemoCard`, `SidebarFilter`, `TagList`, `StatsBar`, `Heatmap`
- **使用 Hooks**: `useMemos`, `useTags`, `useStats`

#### `app/(app)/memo/search.jsx` — 搜索页（P2）

- **URL**: `/memo/search`（或 Tab 中的搜索 Tab 直接渲染）
- **职责**: 顶部搜索输入框 + 搜索结果列表 + 关键词高亮
- **使用组件**: `SearchBar`, `MemoList`, `MemoCard`, `EmptyState`
- **使用 Hooks**: `useSearch`

#### `app/(app)/memo/trash.jsx` — 回收站页（P2）

- **URL**: `/memo/trash`
- **职责**: 展示已软删除笔记列表，提供「恢复」和「永久删除」操作
- **使用组件**: `TrashMemoCard`, `EmptyState`
- **使用 Hooks**: `useTrash`

---

## 4.2 需要新增的组件

所有组件位于 `apps/mobile/components/`，具名 `export`，文件名 PascalCase + `.jsx`。

### 4.2.1 认证相关

#### `components/AuthForm.jsx`

- **具名 export**: `AuthForm`
- **职责**: 登录/注册表单通用组件，通过 `mode` prop 控制显示字段（`'login'` | `'register'`）
- **Props**:
  - `mode`: `'login' | 'register'`
  - `onSubmit(formData)`: 提交回调
  - `isLoading`: 加载状态
  - `error`: 错误信息字符串
- **内容**: 邮箱输入框、密码输入框（register 还有昵称输入框）、提交按钮、错误提示文本

### 4.2.2 笔记输入相关

#### `components/MemoInput.jsx`

- **具名 export**: `MemoInput`
- **职责**: 常驻顶部的笔记输入区，支持文本输入、添加图片、识别链接、提交笔记
- **Props**:
  - `onSubmit(content, attachments)`: 提交后回调
  - `isLoading`: 提交中状态
- **内部状态** (useState):
  - `content`: 文本内容
  - `attachments`: 附件列表 `[{ type: 'image'|'link', url: string }]`
  - `isExpanded`: 输入框是否展开
- **关键行为**:
  - 输入 `#标签名` 时实时高亮（纯文本匹配 `/#+[^\s#]+/g`）
  - 粘贴 URL 时自动检测并追加到 `attachments`（type: `'link'`）
  - 点击图片按钮调用系统图片选择器（`expo-image-picker`，已有依赖）
  - 提交时内容不得超过 10,000 字符（前端校验）

#### `components/AttachmentPreview.jsx`

- **具名 export**: `AttachmentPreview`
- **职责**: 展示输入框下方的附件预览行（图片缩略图 + 链接卡片），支持删除单个附件
- **Props**:
  - `attachments`: 附件列表
  - `onRemove(index)`: 删除回调

### 4.2.3 笔记列表与卡片

#### `components/MemoList.jsx`

- **具名 export**: `MemoList`
- **职责**: 渲染笔记列表，处理加载状态、空状态、分页（若需要）
- **Props**:
  - `memos`: 笔记数组
  - `isLoading`: 加载状态
  - `onDelete(id)`: 删除回调
  - `emptyText`: 空状态提示文本（默认「还没有笔记，记录第一条吧」）
- **实现**: 使用 `FlatList`（React Native 高性能列表），`keyExtractor` 使用 `memo.id`

#### `components/MemoCard.jsx`

- **具名 export**: `MemoCard`
- **职责**: 单条笔记卡片，展示内容摘要、标签、附件图标、创建时间、操作菜单
- **Props**:
  - `id`: 笔记 ID
  - `content`: 笔记正文
  - `tags`: 标签名数组 `[string]`
  - `hasImage`: boolean
  - `hasLink`: boolean
  - `createdAt`: ISO 字符串
  - `highlight`: 搜索高亮关键词（可选，search 页面传入）
  - `onDelete(id)`: 删除回调
- **关键行为**:
  - 正文超过 5 行时截断，显示「展开」
  - `#标签名` 文本以绿色高亮显示
  - 长按弹出操作菜单（删除确认对话框）
  - 纯文本渲染（防 XSS，禁止 dangerouslySetInnerHTML 或 HTML 解析）

#### `components/TrashMemoCard.jsx`

- **具名 export**: `TrashMemoCard`
- **职责**: 回收站笔记卡片，在 `MemoCard` 基础上替换操作区为「恢复」和「永久删除」按钮
- **Props**:
  - `id`, `content`, `tags`, `deletedAt`（显示删除时间）
  - `onRestore(id)`: 恢复回调
  - `onPermanentDelete(id)`: 永久删除回调

### 4.2.4 筛选侧边栏

#### `components/SidebarFilter.jsx`

- **具名 export**: `SidebarFilter`
- **职责**: 左侧/顶部筛选面板，包含类型筛选区和标签树，高亮当前选中筛选项
- **Props**:
  - `activeFilter`: 当前筛选 `{ type: 'all'|'tagged'|'untagged'|'image'|'link'|'voice', tagId: string|null }`
  - `typeCounts`: 各类型计数 `{ total, tagged, untagged, image, link }`
  - `tags`: 标签列表含计数 `[{ id, name, count }]`
  - `trashCount`: 回收站数量
  - `onFilterChange(filter)`: 筛选变更回调
  - `onTrashPress()`: 进入回收站回调

#### `components/TagList.jsx`

- **具名 export**: `TagList`
- **职责**: 标签树列表，每项显示标签名 + 笔记数量，点击触发筛选
- **Props**:
  - `tags`: `[{ id, name, count }]`
  - `activeTagId`: 当前选中标签 ID
  - `onTagPress(tagId)`: 点击回调

### 4.2.5 统计与热力图

#### `components/StatsBar.jsx`

- **具名 export**: `StatsBar`
- **职责**: 展示用户统计信息（昵称、全部笔记数、有标签笔记数、使用天数）
- **Props**:
  - `nickname`: 用户昵称
  - `totalCount`: 全部笔记数
  - `taggedCount`: 有标签笔记数
  - `activeDays`: 使用天数

#### `components/Heatmap.jsx`

- **具名 export**: `Heatmap`
- **职责**: 展示最近 90 天笔记热力图（网格形式，按天着色，深浅表示笔记数量）
- **Props**:
  - `data`: `[{ day: 'YYYY-MM-DD', count: number }]`（最多 90 条）
- **实现**: 纯 React Native View 网格，不依赖第三方图表库（保持零新增包原则）
- **着色逻辑**: count=0 → 浅灰，count 1-3 → 浅绿，count 4-7 → 中绿，count 8+ → 深绿

### 4.2.6 搜索相关

#### `components/SearchBar.jsx`

- **具名 export**: `SearchBar`
- **职责**: 搜索输入框，支持防抖（300ms）触发搜索、清空按钮
- **Props**:
  - `value`: 当前搜索词
  - `onChangeText(text)`: 输入变更回调
  - `onClear()`: 清空回调
  - `placeholder`: 占位文本

### 4.2.7 通用 UI

#### `components/EmptyState.jsx`

- **具名 export**: `EmptyState`
- **职责**: 空状态占位组件（列表为空时展示）
- **Props**:
  - `text`: 提示文字
  - `icon`: 可选图标名（使用系统 emoji 或内置资源，无第三方图标库）

#### `components/ConfirmDialog.jsx`

- **具名 export**: `ConfirmDialog`
- **职责**: 通用确认对话框（删除确认、永久删除确认）
- **Props**:
  - `visible`: 是否显示
  - `title`: 标题
  - `message`: 正文
  - `onConfirm()`: 确认回调
  - `onCancel()`: 取消回调
  - `confirmText`: 确认按钮文字（默认「确认」）
  - `cancelText`: 取消按钮文字（默认「取消」）

#### `components/ProUpgradeModal.jsx`

- **具名 export**: `ProUpgradeModal`
- **职责**: Pro 会员购买引导浮窗（FR-010），展示 Pro 功能说明和购买按钮
- **Props**:
  - `visible`: 是否显示
  - `feature`: 触发来源功能名（如「微信输入」）
  - `onClose()`: 关闭回调
  - `onBuy()`: 「立即购买」回调（当前跳转占位页）

---

## 4.3 Context / Reducer 变更

### 4.3.1 `context/AuthContext.jsx`（新建）

**文件路径**: `apps/mobile/context/AuthContext.jsx`

**initialState**:
```js
{
  user: null,           // { id, email, nickname } | null
  isLoading: true,      // 初始化时检查 Session
  isAuthenticated: false,
}
```

**Action Types**:

| Action Type | Payload | 说明 |
|-------------|---------|------|
| `AUTH_INIT` | `{ user }` | 应用启动时从 `/api/auth/me` 获取当前用户 |
| `AUTH_INIT_DONE` | — | Session 检查完成（无论是否登录） |
| `LOGIN_SUCCESS` | `{ user }` | 登录成功，存储用户信息 |
| `LOGOUT` | — | 退出登录，清空用户信息 |
| `UPDATE_NICKNAME` | `{ nickname }` | 更新昵称（如有编辑功能） |

**导出**:
- `AuthProvider` — 包裹全局
- `useAuth()` — 返回 `{ state, dispatch, login, logout }` 辅助方法

---

### 4.3.2 `context/MemoContext.jsx`（新建）

**文件路径**: `apps/mobile/context/MemoContext.jsx`

**initialState**:
```js
{
  memos: [],              // 当前筛选结果（正常笔记）
  isLoading: false,
  error: null,
  filter: {
    type: 'all',          // 'all' | 'tagged' | 'untagged' | 'image' | 'link' | 'voice'
    tagId: null,          // string | null
  },
  searchQuery: '',        // 全文搜索关键词
  searchResults: [],      // 搜索结果列表
  isSearching: false,
  stats: null,            // { totalCount, taggedCount, activeDays, typeCounts }
  heatmapData: [],        // [{ day, count }]
  tags: [],               // [{ id, name, count }]
  trashMemos: [],         // 回收站笔记列表
  trashCount: 0,
}
```

**Action Types**:

| Action Type | Payload | 触发场景 |
|-------------|---------|---------|
| `FETCH_MEMOS_START` | — | 开始加载笔记列表 |
| `FETCH_MEMOS_SUCCESS` | `{ memos }` | 笔记列表加载完成 |
| `FETCH_MEMOS_ERROR` | `{ error }` | 笔记加载失败 |
| `ADD_MEMO` | `{ memo }` | 创建笔记成功，插入列表顶部 |
| `DELETE_MEMO` | `{ id }` | 软删除笔记，从 `memos` 移除，`trashCount +1` |
| `SET_FILTER` | `{ filter }` | 切换类型筛选或标签筛选 |
| `FETCH_TAGS_SUCCESS` | `{ tags }` | 标签列表（含计数）加载完成 |
| `FETCH_STATS_SUCCESS` | `{ stats }` | 统计信息加载完成 |
| `FETCH_HEATMAP_SUCCESS` | `{ heatmapData }` | 热力图数据加载完成 |
| `SEARCH_START` | — | 开始搜索 |
| `SEARCH_SUCCESS` | `{ results }` | 搜索完成 |
| `SEARCH_CLEAR` | — | 清空搜索，回到全部列表 |
| `FETCH_TRASH_SUCCESS` | `{ trashMemos, trashCount }` | 回收站列表加载完成 |
| `RESTORE_MEMO` | `{ id }` | 恢复笔记，从 `trashMemos` 移除，`trashCount -1` |
| `PERMANENT_DELETE_MEMO` | `{ id }` | 永久删除，从 `trashMemos` 移除，`trashCount -1` |
| `UPDATE_TRASH_COUNT` | `{ count }` | 更新回收站计数（与 `DELETE_MEMO` 配合） |

**导出**:
- `MemoProvider` — 包裹全局
- `useMemoContext()` — 返回 `{ state, dispatch }`

---

## 4.4 自定义 Hook

所有 Hook 文件位于 `apps/mobile/hooks/`，命名 `use-` 前缀 + camelCase + `.js`。

### `hooks/use-auth.js`

- **导出**: `useAuthActions`
- **职责**: 封装 `login`、`logout`、`register`、`checkSession` 异步操作，调用 API 后 `dispatch` 对应 Action
- **调用的 API**:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

### `hooks/use-memos.js`

- **导出**: `useMemos`
- **职责**: 根据 `filter` 和 `searchQuery` 拉取笔记列表，封装 `fetchMemos`、`createMemo`、`deleteMemo`
- **调用的 API**:
  - `GET /api/memos?type=<type>&tagId=<tagId>` — 按筛选条件拉取笔记列表
  - `POST /api/memos` — 创建笔记（body: `{ content, attachments }`）
  - `DELETE /api/memos/:id` — 软删除笔记
- **返回值**: `{ memos, isLoading, error, createMemo, deleteMemo, refetch }`

### `hooks/use-tags.js`

- **导出**: `useTags`
- **职责**: 拉取当前用户的所有标签（含各标签笔记数）
- **调用的 API**:
  - `GET /api/tags` — 返回 `[{ id, name, count }]`
- **返回值**: `{ tags, isLoading, refetch }`

### `hooks/use-stats.js`

- **导出**: `useStats`
- **职责**: 拉取用户统计信息和热力图数据
- **调用的 API**:
  - `GET /api/stats` — 返回 `{ totalCount, taggedCount, activeDays, typeCounts, heatmapData }`
- **返回值**: `{ stats, heatmapData, isLoading, refetch }`

### `hooks/use-search.js`

- **导出**: `useSearch`
- **职责**: 封装搜索逻辑，防抖 300ms 触发 API 请求，管理搜索词和结果状态
- **调用的 API**:
  - `GET /api/memos/search?q=<keyword>` — 全文搜索
- **返回值**: `{ query, setQuery, results, isSearching, clearSearch }`

### `hooks/use-trash.js`

- **导出**: `useTrash`
- **职责**: 管理回收站列表，封装 `restoreMemo`、`permanentDeleteMemo`
- **调用的 API**:
  - `GET /api/memos/trash` — 获取回收站列表
  - `POST /api/memos/:id/restore` — 恢复笔记
  - `DELETE /api/memos/:id/permanent` — 永久删除
- **返回值**: `{ trashMemos, trashCount, isLoading, restoreMemo, permanentDeleteMemo, refetch }`

---

## 4.5 调用的 API 端点

根据数据模型推断，遵循 REST 惯例，所有路径均以 `/api` 为前缀。

### 认证 (`/api/auth`)

| 方法 | 路径 | 请求体 | 成功响应 `data` | 说明 |
|------|------|--------|----------------|------|
| POST | `/api/auth/register` | `{ email, nickname, password }` | `{ id, email, nickname }` | 注册 |
| POST | `/api/auth/login` | `{ email, password }` | `{ id, email, nickname }` | 登录，写 Session Cookie |
| POST | `/api/auth/logout` | — | `null` | 退出，销毁 Session |
| GET | `/api/auth/me` | — | `{ id, email, nickname }` | 获取当前登录用户 |

### 笔记 (`/api/memos`)

| 方法 | 路径 | 参数 | 成功响应 `data` | 说明 |
|------|------|------|----------------|------|
| GET | `/api/memos` | `?type=all|tagged|untagged|image|link&tagId=<id>` | `[{ id, content, tags, hasImage, hasLink, createdAt }]` | 获取笔记列表（按筛选），`deletedAt IS NULL` |
| POST | `/api/memos` | body: `{ content, attachments: [{ type, url }] }` | `{ id, content, tags, hasImage, hasLink, createdAt }` | 创建笔记，后端解析 `#标签名` |
| DELETE | `/api/memos/:id` | — | `null` | 软删除（设置 `deletedAt`） |
| GET | `/api/memos/search` | `?q=<keyword>` | `[{ id, content, tags, ... }]` | 全文搜索（不区分大小写，部分匹配） |
| GET | `/api/memos/trash` | — | `[{ id, content, tags, deletedAt }]` | 回收站列表（`deletedAt IS NOT NULL`） |
| POST | `/api/memos/:id/restore` | — | `{ id, content, ... }` | 恢复笔记（清空 `deletedAt`） |
| DELETE | `/api/memos/:id/permanent` | — | `null` | 物理删除笔记 |

### 标签 (`/api/tags`)

| 方法 | 路径 | 响应 `data` | 说明 |
|------|------|------------|------|
| GET | `/api/tags` | `[{ id, name, count }]` | 当前用户所有标签，含各标签笔记数 |

### 统计 (`/api/stats`)

| 方法 | 路径 | 响应 `data` | 说明 |
|------|------|------------|------|
| GET | `/api/stats` | `{ totalCount, taggedCount, activeDays, typeCounts: { image, link }, trashCount, heatmapData: [{ day, count }] }` | 用户全量统计（含热力图，最近 90 天） |

---

## 4.6 用户交互流程

### 流程 1：登录后进入笔记主页

```
用户打开 App
  → app/index.jsx 读取 AuthContext.isLoading
  → isLoading=true 显示加载指示器
  → useAuthActions.checkSession() 调用 GET /api/auth/me
  → 有效 Session → dispatch AUTH_INIT → isAuthenticated=true
  → 自动跳转 /memo
  → memo/index.jsx 挂载
    → useMemos() 调用 GET /api/memos?type=all
    → useTags()  调用 GET /api/tags
    → useStats() 调用 GET /api/stats
    → 数据到达：dispatch FETCH_MEMOS_SUCCESS + FETCH_TAGS_SUCCESS + FETCH_STATS_SUCCESS
    → 渲染 SidebarFilter（标签列表 + 类型计数）+ MemoList + StatsBar + Heatmap
```

### 流程 2：创建笔记

```
用户点击输入框
  → MemoInput 展开（isExpanded=true）
用户输入「今天开会 #工作 #产品」并点击图片按钮
  → AttachmentPreview 显示图片缩略图
用户点击「发送」
  → 前端校验：content 不超过 10,000 字符，标签 ≤ 10 个
  → 调用 POST /api/memos { content: '今天开会 #工作 #产品', attachments: [{ type: 'image', url: '...' }] }
  → 后端解析 #工作 #产品，写入 tags + memo_tags，更新 hasImage=1
  → 返回完整 memo 对象
  → dispatch ADD_MEMO → memos 列表顶部插入新笔记
  → 重新调用 GET /api/stats → dispatch FETCH_STATS_SUCCESS（统计实时更新）
  → MemoInput 清空内容，折叠
  → 新笔记出现在列表最顶部，标签旁显示 #工作 #产品
```

### 流程 3：按标签筛选

```
用户点击侧边栏中的「#工作」标签
  → SidebarFilter 调用 onFilterChange({ type: 'all', tagId: 'tag-uuid-工作' })
  → dispatch SET_FILTER
  → useMemos() 监听 filter 变化，调用 GET /api/memos?tagId=tag-uuid-工作
  → dispatch FETCH_MEMOS_SUCCESS
  → MemoList 仅展示「#工作」标签下的笔记
  → 标签旁高亮选中状态
用户点击「全部笔记」
  → dispatch SET_FILTER { type: 'all', tagId: null }
  → 恢复完整列表
```

### 流程 4：搜索笔记

```
用户切换到搜索 Tab（/memo/search）
  → SearchBar 获取焦点
用户输入「会议」
  → useSearch 防抖 300ms
  → dispatch SEARCH_START
  → 调用 GET /api/memos/search?q=会议
  → dispatch SEARCH_SUCCESS { results: [...] }
  → MemoList 渲染结果，MemoCard 中「会议」关键词高亮显示
用户清空搜索框
  → dispatch SEARCH_CLEAR
  → 显示「请输入关键词」提示
搜索结果为空
  → EmptyState 显示「未找到相关笔记」
```

### 流程 5：删除笔记（软删除 + 回收站）

```
用户长按笔记卡片
  → 弹出操作菜单
用户点击「删除」
  → ConfirmDialog 显示「确认删除这条笔记？」
用户点击「确认」
  → 调用 DELETE /api/memos/:id（软删除）
  → dispatch DELETE_MEMO { id } → memos 列表移除该笔记
  → dispatch UPDATE_TRASH_COUNT → trashCount +1
  → SidebarFilter 中「回收站 (N)」计数更新
```

### 流程 6：回收站恢复笔记

```
用户点击侧边栏「回收站」
  → 导航到 /memo/trash
  → useTrash() 调用 GET /api/memos/trash
  → 展示已删除笔记列表（TrashMemoCard）
用户点击「恢复」
  → 调用 POST /api/memos/:id/restore
  → dispatch RESTORE_MEMO { id } → trashMemos 列表移除
  → trashCount -1
  → 返回 /memo 后列表重新 fetch 显示已恢复笔记
用户点击「永久删除」
  → ConfirmDialog 显示「此操作不可恢复，确认永久删除？」
  → 确认后调用 DELETE /api/memos/:id/permanent
  → dispatch PERMANENT_DELETE_MEMO { id }
```

### 流程 7：Pro 功能引导

```
用户点击「微信输入」/「每日回顾」/「AI 洞察」/「随机漫步」入口
  → ProUpgradeModal 弹出（visible=true）
  → 展示 Pro 功能说明 + 「立即购买」按钮
用户点击「立即购买」
  → 跳转到占位页（当前暂不实现购买流程）
用户点击关闭按钮或背景
  → ProUpgradeModal 关闭（visible=false）
  → 返回笔记页面
```

### 流程 8：查看统计与热力图

```
笔记主页加载完成
  → StatsBar 显示：「Robin · 全部笔记 100 条 · 有标签 60 条 · 已使用 30 天」
  → Heatmap 渲染最近 90 天格子
    → count=0 → 浅灰色格子
    → count 1-3 → 浅绿格子
    → count 4-7 → 中绿格子
    → count 8+ → 深绿格子
用户创建/删除笔记后
  → 重新调用 GET /api/stats
  → dispatch FETCH_STATS_SUCCESS → StatsBar 实时更新（SC-008）
```

---

## 4.7 安全约定（前端层面）

- **纯文本渲染**: 所有 `content`、`nickname`、`tagName` 通过 React Native `<Text>` 组件渲染，不使用 `dangerouslySetInnerHTML`，自动防 XSS
- **输入长度校验**: `MemoInput` 提交前检查 `content.length <= 10000`，标签数量 `<= 10`
- **图片大小**: 选择图片后检查文件大小 `<= 5MB`，超限提示用户
- **Session Cookie**: 所有 API 请求带 `credentials: 'include'`（`api-client.js` 统一处理）
- **环境变量**: API Base URL 使用 `EXPO_PUBLIC_API_URL`（不硬编码端口/地址）

---

## 4.8 文件清单（完整）

```
apps/mobile/
├── app/
│   ├── _layout.jsx
│   ├── index.jsx
│   ├── (auth)/
│   │   ├── _layout.jsx
│   │   ├── login.jsx
│   │   └── register.jsx
│   └── (app)/
│       ├── _layout.jsx
│       └── memo/
│           ├── index.jsx
│           ├── search.jsx
│           └── trash.jsx
├── components/
│   ├── AuthForm.jsx
│   ├── MemoInput.jsx
│   ├── AttachmentPreview.jsx
│   ├── MemoList.jsx
│   ├── MemoCard.jsx
│   ├── TrashMemoCard.jsx
│   ├── SidebarFilter.jsx
│   ├── TagList.jsx
│   ├── StatsBar.jsx
│   ├── Heatmap.jsx
│   ├── SearchBar.jsx
│   ├── EmptyState.jsx
│   ├── ConfirmDialog.jsx
│   └── ProUpgradeModal.jsx
├── context/
│   ├── AuthContext.jsx
│   └── MemoContext.jsx
├── hooks/
│   ├── use-auth.js
│   ├── use-memos.js
│   ├── use-tags.js
│   ├── use-stats.js
│   ├── use-search.js
│   └── use-trash.js
└── lib/
    └── api-client.js
```
