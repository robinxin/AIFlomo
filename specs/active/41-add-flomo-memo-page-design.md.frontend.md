# §4 前端页面与组件设计 — Flomo 笔记页面（Issue #41）

> 生成日期: 2026-03-11
> 负责角色: frontend-developer subagent
> 对应 Spec: specs/active/41-add-flomo-memo-page.md
> 依赖输入: specs/active/41-add-flomo-memo-page-design.md.architect.md

---

## 4.1 新增 Screen（路由页面）

所有页面文件位于 `apps/mobile/app/` 下，遵循 Expo Router 文件路由约定。

### 根布局

| 文件路径 | URL 路径 | 说明 |
|---------|---------|------|
| `apps/mobile/app/_layout.jsx` | — | 根布局，挂载 `AuthProvider` 和 `MemoProvider`，使用 `Stack` 导航 |
| `apps/mobile/app/index.jsx` | `/` | 入口重定向：已登录跳转 `/memo`，未登录跳转 `/login` |

### 认证路由组 `(auth)/`

| 文件路径 | URL 路径 | 说明 |
|---------|---------|------|
| `apps/mobile/app/(auth)/_layout.jsx` | — | 认证组布局，已登录用户自动重定向到 `/memo` |
| `apps/mobile/app/(auth)/login.jsx` | `/login` | 登录页：邮箱 + 密码表单，登录成功跳转 `/memo` |
| `apps/mobile/app/(auth)/register.jsx` | `/register` | 注册页：邮箱 + 昵称 + 密码表单，注册成功自动登录跳转 `/memo` |

### 主应用路由组 `(app)/`

| 文件路径 | URL 路径 | 说明 |
|---------|---------|------|
| `apps/mobile/app/(app)/_layout.jsx` | — | 主应用布局，未登录用户自动重定向到 `/login` |
| `apps/mobile/app/(app)/memo/index.jsx` | `/memo` | 笔记主页（核心落地页）：左侧筛选面板 + 右侧笔记列表 + 顶部输入区 |
| `apps/mobile/app/(app)/memo/search.jsx` | `/memo/search` | 搜索页：搜索框 + 实时搜索结果列表（300ms 防抖） |
| `apps/mobile/app/(app)/memo/trash.jsx` | `/memo/trash` | 回收站页：已软删除笔记列表，支持恢复和永久删除 |

---

## 4.2 新增组件

所有通用组件位于 `apps/mobile/components/` 下，使用具名 `export`，遵循 PascalCase 命名。

### 认证相关

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/AuthForm.jsx` | `AuthForm` | 通用认证表单容器，渲染邮箱/昵称/密码字段，处理前端校验（邮箱格式、密码 ≥ 8 字符），提交时调用外部 `onSubmit` 回调 |

### 布局结构

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/Sidebar.jsx` | `Sidebar` | 左侧筛选面板容器：含类型筛选区（全部/有标签/无标签/有图片/有链接）+ 标签树 + 回收站入口 + 用户信息区 |
| `apps/mobile/components/MainLayout.jsx` | `MainLayout` | 主页双栏布局：Web 端侧边栏 + 内容区水平排列；移动端底部 Tab 切换 |

### 笔记输入

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/MemoInput.jsx` | `MemoInput` | 笔记输入区：多行文本框（`TextInput` multiline）+ 工具栏（图片按钮/微信按钮/每日回顾/AI洞察/随机漫步）+ 发送按钮。处理前端校验：内容非空、长度 ≤ 10000 字符、标签数 ≤ 10 个、图片 ≤ 5MB |
| `apps/mobile/components/AttachmentPreview.jsx` | `AttachmentPreview` | 图片附件预览：显示已选图片缩略图 + 删除按钮。仅在有待上传图片时渲染 |

### 笔记列表与卡片

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/MemoList.jsx` | `MemoList` | 笔记列表：使用 `FlatList` 渲染 `MemoCard` 列表，处理加载状态和空状态 |
| `apps/mobile/components/MemoCard.jsx` | `MemoCard` | 单条笔记卡片：显示笔记内容（纯文本，防 XSS）+ 标签行（`#标签名` 高亮绿色）+ 图片缩略图（如有）+ 链接渲染 + 时间戳 + 菜单按钮。含 `data-testid="memo-card"` 和 `data-created-at` 属性 |
| `apps/mobile/components/MemoMenu.jsx` | `MemoMenu` | 笔记操作菜单（浮动）：包含「删除」选项，点击删除触发确认对话框 |
| `apps/mobile/components/EmptyState.jsx` | `EmptyState` | 空状态占位：显示提示文字（如「暂无笔记」「未找到相关笔记」「回收站为空」），可选渲染操作按钮 |

### 筛选与标签

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/FilterPanel.jsx` | `FilterPanel` | 类型筛选面板：渲染「全部」「有标签」「无标签」「有图片」「有链接」五个筛选项，点击切换高亮并触发 `onFilterChange` |
| `apps/mobile/components/TagList.jsx` | `TagList` | 标签树列表：渲染每个标签名 + 笔记计数（格式 `标签名 (N)`），点击标签触发筛选回调 |
| `apps/mobile/components/TagBadge.jsx` | `TagBadge` | 单个标签徽章：绿色 `#标签名` 文本，用于笔记卡片内渲染 |

### 统计与热力图

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/StatsBar.jsx` | `StatsBar` | 统计信息条：显示用户昵称、全部笔记数（`全部笔记 N 条`）、有标签数（`有标签 N 条`）、使用天数（`已使用 N 天`）|
| `apps/mobile/components/Heatmap.jsx` | `Heatmap` | 热力图：将 90 天 `heatmap` 数组渲染为日历格子矩阵，颜色深浅反映当日笔记数量，悬停/长按显示工具提示（`{YYYY-MM-DD}: N 条笔记`）|

### 回收站

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/TrashMemoCard.jsx` | `TrashMemoCard` | 回收站笔记卡片：显示内容 + 删除时间 + 「恢复」按钮 + 「永久删除」按钮 |

### 通用 UI

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/ConfirmDialog.jsx` | `ConfirmDialog` | 通用二次确认对话框：标题 + 说明文本 + 「确认」和「取消」按钮，受控显示（`visible` prop） |
| `apps/mobile/components/ProUpgradeModal.jsx` | `ProUpgradeModal` | Pro 升级引导浮窗：标题「购买 Pro 会员」+ 功能介绍 + 「立即购买」按钮 + 「关闭」按钮 |
| `apps/mobile/components/Toast.jsx` | `Toast` | 轻提示组件：短暂显示操作结果文本（成功/错误），2 秒后自动消失 |
| `apps/mobile/components/UserMenu.jsx` | `UserMenu` | 用户头像/昵称下拉菜单：包含「登出」选项 |

### 搜索

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/components/SearchBar.jsx` | `SearchBar` | 搜索框：带清空按钮（`clear-search-btn`）的文本输入框，内部实现 300ms 防抖后触发 `onSearch` 回调 |

---

## 4.3 Context / Reducer 变更

### AuthContext（新增文件）

**文件路径**: `apps/mobile/context/AuthContext.jsx`

**初始状态**:
```js
{
  user: null,       // { id, email, nickname } 或 null
  isLoading: true,  // 初始化时检查 Session
  error: null,
}
```

**新增 Action Types**:

| Action Type | Payload | 触发时机 |
|------------|---------|---------|
| `AUTH_INIT_START` | — | 应用启动时调用 `GET /api/auth/me` 前 |
| `AUTH_INIT_SUCCESS` | `user` 对象 | `GET /api/auth/me` 返回 200，将用户信息写入状态 |
| `AUTH_INIT_FAILURE` | — | `GET /api/auth/me` 返回 401，确认未登录 |
| `LOGIN_SUCCESS` | `user` 对象 | 登录或注册成功后 |
| `LOGOUT` | — | 调用 `POST /api/auth/logout` 成功后 |

**导出**:
- `AuthProvider` — Provider 组件，包裹根布局
- `useAuth()` — 自定义 Hook，返回 `{ state, dispatch }`

---

### MemoContext（新增文件）

**文件路径**: `apps/mobile/context/MemoContext.jsx`

**初始状态**:
```js
{
  memos: [],
  tags: [],
  stats: null,         // { totalMemos, taggedMemos, usageDays, trashCount, heatmap }
  trashMemos: [],
  activeFilter: 'all', // 'all' | 'tagged' | 'untagged' | 'image' | 'link' | tagId（字符串）
  isLoading: false,
  error: null,
}
```

**新增 Action Types**:

| Action Type | Payload | 触发时机 |
|------------|---------|---------|
| `FETCH_MEMOS_START` | — | 开始拉取笔记列表 |
| `FETCH_MEMOS_SUCCESS` | `memos[]` | 拉取笔记列表成功 |
| `FETCH_MEMOS_ERROR` | `errorMsg` | 拉取笔记列表失败 |
| `ADD_MEMO` | `memo` 对象 | 创建笔记成功后，prepend 到列表头部 |
| `DELETE_MEMO` | `memoId` | 软删除成功后，从 `memos` 中移除 |
| `FETCH_TAGS_SUCCESS` | `tags[]` | 拉取标签列表成功 |
| `FETCH_STATS_SUCCESS` | `stats` 对象 | 拉取统计数据成功 |
| `FETCH_TRASH_SUCCESS` | `trashMemos[]` | 拉取回收站列表成功 |
| `RESTORE_MEMO` | `memoId` | 恢复笔记成功后，从 `trashMemos` 中移除 |
| `PERMANENT_DELETE_MEMO` | `memoId` | 永久删除成功后，从 `trashMemos` 中移除 |
| `SET_FILTER` | `filterValue` | 用户点击筛选项或标签，更新 `activeFilter` |

**导出**:
- `MemoProvider` — Provider 组件
- `useMemoContext()` — 自定义 Hook，返回 `{ state, dispatch }`

---

## 4.4 自定义 Hook 变更

所有 Hook 文件位于 `apps/mobile/hooks/`，使用 `use-` 前缀命名。

### 新增 Hook

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/hooks/use-auth.js` | `useAuth` | 封装 `AuthContext`；提供 `login(email, password)`、`register(email, nickname, password)`、`logout()`、`checkSession()` 方法；所有方法内部 dispatch 对应 action |
| `apps/mobile/hooks/use-memos.js` | `useMemos` | 封装笔记列表加载：根据 `activeFilter` 构建查询参数，调用 `GET /api/memos` 并 dispatch `FETCH_MEMOS_SUCCESS`；返回 `{ memos, isLoading, refetch }` |
| `apps/mobile/hooks/use-create-memo.js` | `useCreateMemo` | 封装创建笔记逻辑：前端校验（内容非空、长度、标签数）→ 若有图片先上传附件 → `POST /api/memos` → dispatch `ADD_MEMO` + `FETCH_TAGS_SUCCESS` + `FETCH_STATS_SUCCESS`；返回 `{ createMemo, isLoading }` |
| `apps/mobile/hooks/use-tags.js` | `useTags` | 调用 `GET /api/tags` 并 dispatch `FETCH_TAGS_SUCCESS`；返回 `{ tags, refetch }` |
| `apps/mobile/hooks/use-stats.js` | `useStats` | 调用 `GET /api/stats` 并 dispatch `FETCH_STATS_SUCCESS`；返回 `{ stats, refetch }` |
| `apps/mobile/hooks/use-trash.js` | `useTrash` | 调用 `GET /api/memos/trash`；提供 `restoreMemo(id)` 和 `permanentDeleteMemo(id)` 方法；返回 `{ trashMemos, isLoading, restoreMemo, permanentDeleteMemo }` |
| `apps/mobile/hooks/use-search.js` | `useSearch` | 管理搜索页状态：本地 `query` state + 300ms 防抖 → 调用 `GET /api/memos?q={query}` → 返回搜索结果；返回 `{ query, setQuery, results, isLoading }` |

---

## 4.5 API Client 工具库

**文件路径**: `apps/mobile/lib/api-client.js`

统一封装 `fetch`，携带 `credentials: 'include'`（Session Cookie），统一处理错误，返回 `json.data`。

**文件路径**: `apps/mobile/lib/parse-tags.js`

工具函数 `parseTags(content: string): string[]`，使用正则 `/#([^\s#]+)/g` 从笔记内容中提取标签名列表，用于前端实时预览标签和校验标签数量。

---

## 4.6 用户交互流程

### 流程 1 — 登录

1. 用户访问 `/login`，看到邮箱 + 密码表单
2. 输入邮箱格式错误 → 前端实时显示「请输入有效邮箱」，按钮保持禁用
3. 密码少于 8 字符 → 前端显示「密码至少 8 个字符」
4. 点击「登录」按钮 → 按钮禁用（防重复提交）→ 调用 `POST /api/auth/login`
5. 成功 → dispatch `LOGIN_SUCCESS` → 跳转 `/memo` → Toast 显示「登录成功」
6. 失败（401）→ 显示「邮箱或密码错误」，按钮恢复

### 流程 2 — 创建笔记

1. 用户在 `/memo` 主页顶部看到多行输入框（`data-testid="memo-input"`）
2. 输入内容（含 `#标签名` 自动高亮预览）
3. 点击图片图标（`data-testid="insert-image-btn"`）→ 触发隐藏的 `input[type="file"]`
4. 选择图片后，`AttachmentPreview` 显示缩略图；若图片 > 5MB → Toast「图片大小不得超过 5MB」且不添加
5. 点击「发送」按钮：
   - 若内容为空 → Toast「内容不能为空」，输入框保持聚焦
   - 若内容超 10000 字符 → Toast「内容不得超过 10,000 字符」
   - 若标签数 > 10 → Toast「每条笔记最多 10 个标签」
   - 校验通过 → 按钮禁用 + 显示加载状态
6. 若有图片，先上传附件（`POST /api/attachments` 或 multipart），获取 URL
7. 调用 `POST /api/memos { content }`
8. 成功 → dispatch `ADD_MEMO`（新笔记 prepend 到列表顶部）→ 输入框清空 → 更新标签树和统计 → Toast「创建成功」
9. 失败 → Toast 显示错误信息，输入框内容保留（网络断开时显示「网络连接失败，请稍后重试」）

### 流程 3 — 筛选笔记

1. 用户在左侧 `Sidebar` 看到筛选面板（`data-testid="sidebar-filter"`）
2. 点击「全部/有标签/无标签/有图片/有链接」→ 对应筛选项高亮（active class）→ dispatch `SET_FILTER`
3. `useMemos` Hook 检测到 `activeFilter` 变化 → 重新调用 `GET /api/memos?type={type}` 或 `GET /api/memos?tagId={id}`
4. 列表更新，顶部显示当前筛选名称（如 `有标签`）

### 流程 4 — 标签筛选

1. 用户点击 `TagList`（`data-testid="tag-list"`）中的某个标签
2. 标签项高亮 → dispatch `SET_FILTER` payload 为 tagId
3. 调用 `GET /api/memos?tagId={tagId}` → 更新列表
4. 页面顶部显示 `h1` 标签名称

### 流程 5 — 删除笔记

1. 用户点击 `MemoCard` 上的菜单按钮（`data-testid="memo-menu-btn"`）→ 弹出 `MemoMenu`
2. 点击「删除」→ 弹出 `ConfirmDialog`（`data-testid="confirm-dialog"`）
3. 点击「取消」→ 对话框关闭，笔记保留
4. 点击「确认」→ 调用 `DELETE /api/memos/:id` → dispatch `DELETE_MEMO` → 笔记从列表消失 → 更新统计（`trashCount+1`）→ Toast「已移至回收站」

### 流程 6 — 回收站

1. 用户点击左侧侧边栏「回收站」入口（`data-testid="trash-link"`）→ 跳转 `/memo/trash`
2. 调用 `GET /api/memos/trash`，显示 `TrashMemoCard` 列表
3. 点击某卡片的「恢复」→ 调用 `POST /api/memos/:id/restore` → dispatch `RESTORE_MEMO` → 卡片消失 → Toast「恢复成功」
4. 点击「永久删除」→ 弹出 `ConfirmDialog` → 确认后调用 `DELETE /api/memos/:id/permanent` → dispatch `PERMANENT_DELETE_MEMO` → 卡片消失 → Toast「已永久删除」
5. 回收站为空时，显示 `EmptyState`（「回收站为空」）

### 流程 7 — 全文搜索

1. 用户访问 `/memo/search`（或点击搜索入口跳转）
2. 看到 `SearchBar`（`data-testid="search-input"`）+ 搜索结果列表
3. 输入关键词 → 300ms 防抖后调用 `GET /api/memos?q={keyword}`
4. 结果显示为 `MemoCard` 列表，倒序排列
5. 无结果 → 显示 `EmptyState`（`data-testid="empty-state"`，文字「未找到相关笔记」）+ 「清空搜索」按钮
6. 点击清空按钮（`data-testid="clear-search-btn"`）→ 搜索框清空 → 返回全部笔记

### 流程 8 — 查看统计与热力图

1. `/memo` 主页顶部渲染 `StatsBar`（`data-testid="stats-bar"`）
2. 显示用户昵称（`data-testid="user-nickname"`）+ 全部笔记数（`data-testid="total-memos"`）+ 有标签数（`data-testid="tagged-memos"`）+ 使用天数（`data-testid="usage-days"`）
3. 下方渲染 `Heatmap`（`data-testid="heatmap"`），格子（`data-testid="heatmap-cell"`）按日期颜色深浅排列
4. 鼠标悬停/长按格子 → 显示工具提示（`data-testid="heatmap-tooltip"`，内容：`YYYY-MM-DD: N 条笔记`）
5. 数据来源：`GET /api/stats`，页面加载时拉取一次

### 流程 9 — Pro 功能引导

1. 用户点击工具栏中的「微信输入」（`data-testid="wechat-input-btn"`）/ 每日回顾 / AI 洞察 / 随机漫步 → 弹出 `ProUpgradeModal`（`data-testid="pro-upgrade-modal"`）
2. 浮窗显示：标题「购买 Pro 会员」+ 功能介绍（`data-testid="pro-features"`）+ 「立即购买」按钮 + 关闭按钮（`data-testid="close-modal-btn"`）
3. 点击关闭 → 浮窗消失，停留在 `/memo`
4. 点击「立即购买」→ 显示「功能开发中」（`data-testid="pro-placeholder"`）占位提示

### 流程 10 — 登出

1. 用户点击页面右上角用户昵称/头像区域（`data-testid="user-menu"`）→ 弹出 `UserMenu`
2. 点击「登出」→ 调用 `POST /api/auth/logout` → dispatch `LOGOUT` → 清空 `user` 状态 → 跳转 `/login` → Toast「已登出」

---

## 4.7 调用的 API 端点

以下端点由前端调用，依据数据模型和 REST 惯例推断，与 backend-developer 设计保持一致。

### 认证

| 方法 | 路径 | 调用场景 | 请求体 | 响应 `data` 结构 |
|------|------|---------|-------|----------------|
| `POST` | `/api/auth/register` | 注册 | `{ email, password, nickname }` | `{ id, email, nickname }` |
| `POST` | `/api/auth/login` | 登录 | `{ email, password }` | `{ id, email, nickname }` |
| `POST` | `/api/auth/logout` | 登出 | — | `null` |
| `GET` | `/api/auth/me` | 应用启动检查 Session | — | `{ id, email, nickname }` |

### 笔记

| 方法 | 路径 | 查询参数 | 调用场景 |
|------|------|---------|---------|
| `GET` | `/api/memos` | 无 | 加载全部正常笔记 |
| `GET` | `/api/memos` | `?type=tagged` | 筛选「有标签」 |
| `GET` | `/api/memos` | `?type=untagged` | 筛选「无标签」 |
| `GET` | `/api/memos` | `?type=image` | 筛选「有图片」 |
| `GET` | `/api/memos` | `?type=link` | 筛选「有链接」 |
| `GET` | `/api/memos` | `?tagId={tagId}` | 按标签筛选 |
| `GET` | `/api/memos` | `?q={keyword}` | 全文搜索（空字符串返回全部） |
| `POST` | `/api/memos` | — | 创建笔记，body: `{ content }` |
| `DELETE` | `/api/memos/:id` | — | 软删除（移入回收站） |
| `GET` | `/api/memos/trash` | — | 获取回收站列表 |
| `POST` | `/api/memos/:id/restore` | — | 从回收站恢复笔记 |
| `DELETE` | `/api/memos/:id/permanent` | — | 永久删除笔记 |

### 标签

| 方法 | 路径 | 调用场景 | 响应 `data` 结构 |
|------|------|---------|----------------|
| `GET` | `/api/tags` | 加载标签树 | `[{ id, name, count }]` |

### 统计

| 方法 | 路径 | 调用场景 | 响应 `data` 结构 |
|------|------|---------|----------------|
| `GET` | `/api/stats` | 加载统计信息和热力图 | `{ totalMemos, taggedMemos, usageDays, trashCount, heatmap: [{ day, count }] }` |

---

## 4.8 关键 UI 元素的 data-testid

以下 `data-testid` 与 E2E 测试文件中的断言严格对应。

### 认证页

| data-testid | 所在组件/文件 | 说明 |
|-------------|-------------|------|
| — | `app/(auth)/login.jsx` | 登录表单使用原生 `input[name="email"]`、`input[name="password"]`、`button:has-text("登录")` 选择器 |
| — | `app/(auth)/register.jsx` | 注册表单使用原生 `input[name="email"]`、`input[name="nickname"]`、`input[name="password"]`、`button:has-text("注册")` |

### 笔记主页 `/memo`

| data-testid | 所在组件 | 说明 |
|-------------|---------|------|
| `memo-list` | `MemoList.jsx` | 笔记列表容器，可见即表示列表已加载 |
| `sidebar-filter` | `Sidebar.jsx` | 左侧筛选面板整体容器 |
| `tag-list` | `TagList.jsx` | 标签树列表容器 |
| `tag-item` | `TagList.jsx` | 单个标签项（含名称和计数，格式 `标签名 (N)`） |
| `tag` | `TagBadge.jsx` | 笔记卡片内的单个标签徽章 |
| `memo-card` | `MemoCard.jsx` | 单条笔记卡片（含 `data-created-at` 属性用于时序验证） |
| `memo-menu-btn` | `MemoCard.jsx` | 笔记卡片菜单触发按钮（三点图标） |
| `memo-image` | `MemoCard.jsx` | 笔记卡片内的图片元素（`img` 或 `Image` 组件） |
| `memo-input` | `MemoInput.jsx` | 笔记输入框（`TextInput` multiline） |
| `insert-image-btn` | `MemoInput.jsx` | 插入图片按钮 |
| `attachment-preview` | `AttachmentPreview.jsx` | 图片附件预览区 |
| `remove-attachment-btn` | `AttachmentPreview.jsx` | 删除预览图片按钮 |
| `filter-tagged` | `FilterPanel.jsx` | 「有标签」筛选项（active 时添加 `active` class） |
| `filter-untagged` | `FilterPanel.jsx` | 「无标签」筛选项 |
| `filter-image` | `FilterPanel.jsx` | 「有图片」筛选项 |
| `filter-link` | `FilterPanel.jsx` | 「有链接」筛选项（含笔记计数文本） |
| `trash-link` | `Sidebar.jsx` | 回收站入口链接 |
| `trash-count` | `Sidebar.jsx` | 回收站笔记计数文本（如「回收站 (5)」） |
| `stats-bar` | `StatsBar.jsx` | 统计信息条容器 |
| `user-nickname` | `StatsBar.jsx` | 显示当前登录用户昵称 |
| `total-memos` | `StatsBar.jsx` | 全部笔记数文本（格式：`全部笔记 N 条`） |
| `tagged-memos` | `StatsBar.jsx` | 有标签笔记数文本（格式：`有标签 N 条`） |
| `usage-days` | `StatsBar.jsx` | 使用天数文本（格式：`已使用 N 天`） |
| `heatmap` | `Heatmap.jsx` | 热力图整体容器 |
| `heatmap-cell` | `Heatmap.jsx` | 热力图单日格子 |
| `heatmap-tooltip` | `Heatmap.jsx` | 热力图格子工具提示（悬停/长按触发） |
| `user-menu` | `UserMenu.jsx` | 用户头像/昵称点击区域，触发下拉菜单 |
| `confirm-dialog` | `ConfirmDialog.jsx` | 二次确认对话框（含「确认」和「取消」按钮） |
| `loading-spinner` | `MemoInput.jsx` | 发送时显示的加载指示器 |

### Pro 功能

| data-testid | 所在组件 | 说明 |
|-------------|---------|------|
| `wechat-input-btn` | `MemoInput.jsx` 工具栏 | 「微信输入」入口按钮 |
| `pro-upgrade-modal` | `ProUpgradeModal.jsx` | Pro 升级浮窗容器 |
| `pro-features` | `ProUpgradeModal.jsx` | Pro 功能介绍区域 |
| `close-modal-btn` | `ProUpgradeModal.jsx` | 关闭浮窗按钮 |
| `pro-placeholder` | `ProUpgradeModal.jsx` 或占位页 | 「功能开发中」占位元素 |

### 搜索页 `/memo/search`

| data-testid | 所在组件 | 说明 |
|-------------|---------|------|
| `search-input` | `SearchBar.jsx` | 搜索文本输入框 |
| `clear-search-btn` | `SearchBar.jsx` | 清空搜索内容按钮 |
| `empty-state` | `EmptyState.jsx` | 空状态容器（「未找到相关笔记」场景下可见） |

### 回收站页 `/memo/trash`

| data-testid | 所在组件 | 说明 |
|-------------|---------|------|
| `trash-memo-card` | `TrashMemoCard.jsx` | 回收站单条笔记卡片（含「恢复」和「永久删除」按钮） |

---

## 4.9 前端校验规则汇总

| 校验项 | 规则 | 错误提示文本 |
|--------|------|------------|
| 邮箱格式 | 符合 `/.+@.+\..+/` | 请输入有效邮箱 |
| 密码长度 | ≥ 8 字符 | 密码至少 8 个字符 |
| 笔记内容非空 | `content.trim().length > 0` | 内容不能为空 |
| 笔记内容长度 | ≤ 10000 字符 | 内容不得超过 10,000 字符 |
| 标签数量 | `parseTags(content).length ≤ 10` | 每条笔记最多 10 个标签 |
| 图片大小 | 文件 ≤ 5MB（5 * 1024 * 1024 字节） | 图片大小不得超过 5MB |
| 网络请求失败 | `fetch` 抛出异常（离线） | 网络连接失败，请稍后重试 |

---

## 4.10 平台适配说明

本应用同时支持 Web 和移动端（React Native via Expo），以下组件需要平台差异处理：

- **`Heatmap.jsx`**: Web 端使用鼠标 `hover` 触发工具提示，移动端使用 `onLongPress`；通过 `Platform.OS` 区分
- **`MainLayout.jsx`**: Web 端左侧侧边栏 + 右侧内容区水平布局（`flexDirection: 'row'`）；移动端底部 Tab 导航隐藏侧边栏
- **`MemoInput.jsx`**: 图片上传使用 `input[type="file"]`（Web）；移动端需使用 `expo-image-picker`（MVP 阶段 Web 优先，移动端图片上传为后续迭代）
- **`ConfirmDialog.jsx`**: Web 端用绝对定位浮窗；移动端用 React Native `Modal` 组件

---

## 4.11 文件清单（完整）

```
apps/mobile/
├── app/
│   ├── _layout.jsx                    # 根布局（AuthProvider + MemoProvider）
│   ├── index.jsx                      # 入口重定向
│   ├── (auth)/
│   │   ├── _layout.jsx
│   │   ├── login.jsx                  # /login
│   │   └── register.jsx               # /register
│   └── (app)/
│       ├── _layout.jsx
│       └── memo/
│           ├── index.jsx              # /memo（笔记主页）
│           ├── search.jsx             # /memo/search
│           └── trash.jsx              # /memo/trash
├── components/
│   ├── AuthForm.jsx
│   ├── AttachmentPreview.jsx
│   ├── ConfirmDialog.jsx
│   ├── EmptyState.jsx
│   ├── FilterPanel.jsx
│   ├── Heatmap.jsx
│   ├── MainLayout.jsx
│   ├── MemoCard.jsx
│   ├── MemoInput.jsx
│   ├── MemoList.jsx
│   ├── MemoMenu.jsx
│   ├── ProUpgradeModal.jsx
│   ├── SearchBar.jsx
│   ├── Sidebar.jsx
│   ├── StatsBar.jsx
│   ├── TagBadge.jsx
│   ├── TagList.jsx
│   ├── Toast.jsx
│   ├── TrashMemoCard.jsx
│   └── UserMenu.jsx
├── context/
│   ├── AuthContext.jsx
│   └── MemoContext.jsx
├── hooks/
│   ├── use-auth.js
│   ├── use-create-memo.js
│   ├── use-memos.js
│   ├── use-search.js
│   ├── use-stats.js
│   ├── use-tags.js
│   └── use-trash.js
└── lib/
    ├── api-client.js
    └── parse-tags.js
```
