## §4 前端页面与组件

---

### 4.1 新增 Screen

| 文件路径 | URL 路径 | 职责 |
|---------|---------|------|
| `apps/mobile/app/memo.jsx` | `/memo` | 笔记主页面（已存在，需完整实现）：输入框、笔记列表、顶部统计、搜索入口 |
| `apps/mobile/app/trash.jsx` | `/trash` | 回收站页面：展示已软删除笔记列表及数量 |

> `app/index.jsx` 已有逻辑：已登录 → Redirect `/memo`，未登录 → Redirect `/login`，无需改动。

---

### 4.2 新增组件

所有组件放在 `apps/mobile/components/` 下，使用具名 export。

---

#### `MemoInput.jsx` — 笔记输入框

**职责**：主页面顶部的笔记输入区域，支持文本输入、标签插入、图片上传触发、发送。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `onSubmit` | `(content: string) => Promise<void>` | 是 | 提交笔记回调 |
| `tags` | `Array<{id, name}>` | 是 | 已有标签列表，用于 `#` 联想 |
| `disabled` | `boolean` | 否 | 提交中状态 |

**用户交互**：
- 默认单行显示，点击后展开多行并显示工具栏
- 输入 `#` 时弹出标签联想列表（从 `tags` prop 中过滤）
- 工具栏：`#标签`、图片上传、链接
- 内容为空时发送按钮置灰不可点击（`!!str && ...` 判断，避免空字符串渲染问题）
- 点击发送调用 `onSubmit`，成功后清空输入框

---

#### `MemoCard.jsx` — 单条笔记卡片

**职责**：展示单条笔记内容，含标签高亮、图片缩略图、删除操作。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `memo` | `object` | 是 | 笔记对象 `{id, content, tags, hasImage, createdAt}` |
| `onDelete` | `(id: string) => void` | 是 | 软删除回调 |

**用户交互**：
- `#标签名` 以高亮颜色（`#4caf50`）内联展示
- 长按或点击右上角菜单触发删除确认
- 图片以缩略图展示（`hasImage=true` 时从 attachments 获取）

---

#### `MemoList.jsx` — 笔记列表

**职责**：虚拟滚动渲染笔记列表，处理空状态和加载状态。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `memos` | `Array` | 是 | 笔记数组 |
| `isLoading` | `boolean` | 是 | 加载状态 |
| `error` | `string\|null` | 否 | 错误信息 |
| `emptyText` | `string` | 否 | 空状态文案，默认 `写下你的第一条想法` |
| `onDelete` | `(id: string) => void` | 是 | 传递给 MemoCard |
| `onLoadMore` | `() => void` | 否 | 触底加载更多 |

**用户交互**：
- 加载中显示骨架屏（3条占位卡片）
- 空状态显示 `emptyText`
- 错误状态显示 `加载失败，点击重试`
- 使用 `FlatList` 实现，`onEndReached` 触发 `onLoadMore`

---

#### `SideNav.jsx` — 左侧导航栏

**职责**：筛选器入口、标签列表、Pro 功能入口、回收站入口。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tags` | `Array<{id, name, memoCount}>` | 是 | 标签列表含数量 |
| `activeFilter` | `string\|null` | 是 | 当前激活筛选 `no_tag\|has_image\|has_link\|tag:<id>` |
| `trashCount` | `number` | 是 | 回收站笔记数量 |
| `onFilterChange` | `(filter: string\|null) => void` | 是 | 切换筛选回调 |

**用户交互**：
- 快速筛选器（无标签、有图片、有链接）：点击高亮，再次点击取消
- 标签列表超过 5 个时折叠，显示「展开全部」
- 点击 Pro 功能入口（微信输入、每日回顾、AI 洞察、随机漫步）弹出 `ProModal`
- 点击回收站跳转 `/trash`，角标显示 `trashCount`

---

#### `StatsBar.jsx` — 顶部统计栏

**职责**：展示用户昵称、全部笔记数、有标签笔记数、使用天数。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nickname` | `string` | 是 | 登录用户昵称 |
| `stats` | `{totalMemos, taggedMemos, activeDays}` | 是 | 统计数据 |
| `onLogout` | `() => void` | 是 | 登出回调 |

---

#### `HeatmapCalendar.jsx` — 热力图日历

**职责**：展示近 90 天每日笔记数量热力图。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `Array<{date: string, count: number}>` | 是 | 热力图数据 |

**用户交互**：
- 每格代表一天，颜色深浅映射笔记数（0条最浅 `#e8f5e9`，≥5条最深 `#1b5e20`）
- 点击某天格子显示当天笔记数 tooltip

---

#### `SearchBar.jsx` — 搜索栏

**职责**：全文搜索输入，触发实时筛选。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `value` | `string` | 是 | 搜索词 |
| `onChangeText` | `(text: string) => void` | 是 | 输入回调 |
| `onClear` | `() => void` | 是 | 清空搜索回调 |

---

#### `ProModal.jsx` — Pro 会员浮窗

**职责**：点击 Pro 功能入口时展示的购买引导浮窗。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `visible` | `boolean` | 是 | 是否显示 |
| `onClose` | `() => void` | 是 | 关闭回调 |

**用户交互**：点击遮罩层或关闭按钮调用 `onClose`，MVP 阶段无实际支付逻辑。

---

### 4.3 Context / Reducer 变更

#### 新增：`apps/mobile/context/MemoContext.jsx`

**State 结构**：
```js
const initialState = {
  memos: [],          // 当前展示的笔记列表（已应用筛选/搜索）
  allMemos: [],       // 全量笔记缓存（前端搜索使用）
  tags: [],           // 标签列表 [{id, name, memoCount}]
  stats: {
    totalMemos: 0,
    taggedMemos: 0,
    activeDays: 0,
    trashCount: 0,
  },
  heatmap: [],        // [{date, count}]
  activeFilter: null, // 'no_tag' | 'has_image' | 'has_link' | 'tag:<id>' | null
  keyword: '',        // 搜索关键字
  page: 1,
  hasMore: true,
  isLoading: false,
  isSubmitting: false,
  error: null,
};
```

**Action Types**：
| Action Type | Payload | 说明 |
|-------------|---------|------|
| `FETCH_MEMOS_START` | — | 开始加载列表 |
| `FETCH_MEMOS_SUCCESS` | `{items, total, page}` | 加载成功，追加或替换列表 |
| `FETCH_MEMOS_ERROR` | `string` | 加载失败 |
| `CREATE_MEMO_START` | — | 开始提交 |
| `CREATE_MEMO_SUCCESS` | `memo` | 新笔记插入列表顶部，更新统计 |
| `CREATE_MEMO_ERROR` | `string` | 提交失败 |
| `DELETE_MEMO_SUCCESS` | `id` | 从列表中移除，trashCount++ |
| `SET_FILTER` | `string\|null` | 设置筛选条件，重置列表 |
| `SET_KEYWORD` | `string` | 设置搜索词，前端实时过滤 |
| `FETCH_TAGS_SUCCESS` | `tags[]` | 更新标签列表 |
| `FETCH_STATS_SUCCESS` | `stats` | 更新统计数据 |
| `FETCH_HEATMAP_SUCCESS` | `heatmap[]` | 更新热力图数据 |

---

### 4.4 自定义 Hook

#### `apps/mobile/hooks/use-memos.js`

**职责**：封装 MemoContext 操作，提供给 Screen 层调用。

**入参**：无

**返回值**：
```js
{
  memos,          // 当前列表
  tags,           // 标签列表
  stats,          // 统计数据
  heatmap,        // 热力图数据
  activeFilter,   // 当前筛选
  keyword,        // 搜索词
  isLoading,
  isSubmitting,
  error,
  hasMore,
  fetchMemos,     // () => Promise<void>  — 加载/重新加载列表
  loadMore,       // () => Promise<void>  — 加载下一页
  createMemo,     // (content: string) => Promise<void>
  deleteMemo,     // (id: string) => Promise<void>
  setFilter,      // (filter: string|null) => void
  setKeyword,     // (keyword: string) => void
  fetchTags,      // () => Promise<void>
  fetchStats,     // () => Promise<void>
  fetchHeatmap,   // () => Promise<void>
}
```

---

### 4.5 用户交互流程

#### 新建笔记流程

```
用户进入 /memo
  → StatsBar 展示昵称 + 统计
  → MemoInput 展示单行输入框（placeholder: "现在的想法是..."）
  → MemoList 展示笔记列表（倒序）

用户点击输入框
  → 展开多行，工具栏出现（#标签 / 图片 / 链接）

用户输入 "#React 今天学习笔记"
  → 输入 "#" 时 TagSuggest 浮层展示已有标签
  → 选择标签后补全标签名

用户点击发送
  → isSubmitting=true，发送按钮 Loading
  → POST /api/memos {content}
  → 成功：新 memo 插入列表顶部，输入框清空，stats 更新
  → 失败：Toast 提示"提交失败，请重试"，内容保留
```

#### 筛选流程

```
用户点击 SideNav "有图片"
  → SET_FILTER('has_image')
  → 重置列表，GET /api/memos?type=has_image
  → 筛选器高亮，列表只显示含图片笔记

用户再次点击"有图片"
  → SET_FILTER(null)
  → 恢复全量列表
```

#### 搜索流程（前端实时过滤）

```
用户点击顶部搜索图标
  → SearchBar 展开，键盘弹起

用户输入关键字
  → SET_KEYWORD('keyword')
  → 前端从 allMemos 中实时过滤 content.includes(keyword)
  → 结果为空显示"未找到相关笔记"

用户清空搜索框
  → SET_KEYWORD('')
  → 恢复显示全部笔记
```

---

### 4.6 调用的 API 端点

| Screen / Hook | Method | Path | 关键请求字段 | 关键响应字段 |
|--------------|--------|------|------------|------------|
| `use-memos` 初始化 | GET | `/api/memos` | `page, limit` | `items[], total` |
| `use-memos` 创建 | POST | `/api/memos` | `content` | `memo object` |
| `use-memos` 删除 | DELETE | `/api/memos/:id` | — | — |
| `use-memos` 标签 | GET | `/api/tags` | — | `[{id, name, memoCount}]` |
| `use-memos` 统计 | GET | `/api/memos/stats` | — | `{totalMemos, taggedMemos, activeDays, trashCount}` |
| `use-memos` 热力图 | GET | `/api/memos/heatmap` | — | `[{date, count}]` |
| `trash.jsx` | GET | `/api/memos/trash` | `page, limit` | `items[], total` |
| `MemoInput` 图片 | POST | `/api/attachments/upload` | `file (multipart)` | `{id, url}` |
| `StatsBar` 登出 | POST | `/api/auth/logout` | — | — |
