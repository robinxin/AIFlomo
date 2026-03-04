# 前端代码规范 — Expo (React Native) + JavaScript

> 适用范围：`apps/mobile/`
> 技术栈：Expo SDK + Expo Router + React Native + JavaScript + React Context

---

## 语言约定

- **默认使用 JavaScript**（`.js` / `.jsx`），不引入 TypeScript
- 文件扩展名：JSX 组件用 `.jsx`，纯逻辑用 `.js`
- 无需 `tsconfig.json`，无需类型注解

---

## 1. 目录与文件结构

### 1.1 Expo Router 文件路由约定

```
apps/mobile/
├── app/                        # 路由根目录（Expo Router 自动识别）
│   ├── _layout.jsx             # 根布局（Stack / Tabs 导航）
│   ├── index.jsx               # 对应路径 /
│   ├── (auth)/                 # 路由分组（不影响 URL）
│   │   ├── _layout.jsx
│   │   ├── login.jsx           # 对应路径 /login
│   │   └── register.jsx
│   └── (app)/                  # 需登录的主应用路由组
│       ├── _layout.jsx
│       └── memo/
│           ├── index.jsx       # 对应路径 /memo
│           └── [id].jsx        # 对应路径 /memo/:id（动态路由）
├── components/                 # 通用 UI 组件（无路由绑定）
├── context/                    # React Context + useReducer
├── hooks/                      # 自定义 Hooks
├── lib/                        # API client、工具函数、常量
└── assets/                     # 字体、图片等静态资源
```

**命名规则**：
- 路由文件：`kebab-case`（如 `memo-detail.jsx`）
- 组件文件：`PascalCase`（如 `MemoCard.jsx`）
- Hook 文件：`use-` 前缀 + camelCase（如 `use-memo-list.js`）
- 工具函数文件：`kebab-case`（如 `api-client.js`）

### 1.2 路径别名

在 `babel.config.js` 中配置（无需 tsconfig）：

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        alias: {
          '@': './',
          '@/components': './components',
          '@/lib': './lib',
          '@/context': './context',
          '@/hooks': './hooks',
          '@/assets': './assets',
        },
      }],
    ],
  };
};
```

---

## 2. 组件规范

### 2.1 组件结构模板

```jsx
// components/MemoCard.jsx
import { View, Text, Pressable, StyleSheet } from 'react-native';

// 组件函数（具名导出，PascalCase）
export function MemoCard({ id, content, tags, onPress }) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Text style={styles.content}>{content}</Text>
      <View style={styles.tagRow}>
        {tags.map((tag) => (
          <Text key={tag} style={styles.tag}>#{tag}</Text>
        ))}
      </View>
    </Pressable>
  );
}

// 样式（必须在文件末尾用 StyleSheet.create 定义）
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  tag: {
    fontSize: 12,
    color: '#4caf50',
  },
});
```

### 2.2 组件规则

- **禁止**内联 style 对象（`style={{ color: 'red' }}`），必须用 `StyleSheet.create`
- **禁止**在组件内部声明 `StyleSheet`，必须放在文件末尾
- 页面组件（`app/` 下）用 `export default`，通用组件用具名 `export`
- 用 JSDoc 注释说明 props 含义（可选，复杂组件推荐）

### 2.3 平台差异隔离

```js
// ✅ 方式一：Platform.select
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
    },
    android: {
      elevation: 4,
    },
    web: {
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
  }),
});

// ✅ 方式二：平台文件后缀
// components/InputToolbar.web.jsx   ← Web 专用实现
// components/InputToolbar.native.jsx ← iOS/Android 共用实现
// 引用时统一 import InputToolbar from '@/components/InputToolbar'
```

---

## 3. Expo Router 布局规范

### 3.1 根布局

```jsx
// app/_layout.jsx
import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { MemoProvider } from '@/context/MemoContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <MemoProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </MemoProvider>
    </AuthProvider>
  );
}
```

### 3.2 Tab 布局

```jsx
// app/(app)/_layout.jsx
import { Tabs } from 'expo-router';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#4caf50' }}>
      <Tabs.Screen name="index" options={{ title: '记录' }} />
      <Tabs.Screen name="search" options={{ title: '搜索' }} />
      <Tabs.Screen name="profile" options={{ title: '我的' }} />
    </Tabs>
  );
}
```

---

## 4. 状态管理规范（React Context + useReducer）

### 4.1 Context 文件结构模板

```jsx
// context/MemoContext.jsx
import { createContext, useContext, useReducer } from 'react';

// 初始状态
const initialState = {
  memos: [],
  isLoading: false,
  error: null,
};

// Reducer（纯函数，无副作用）
function memoReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, isLoading: false, memos: action.payload };
    case 'FETCH_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'ADD_MEMO':
      return { ...state, memos: [action.payload, ...state.memos] };
    case 'DELETE_MEMO':
      return { ...state, memos: state.memos.filter((m) => m.id !== action.payload) };
    default:
      return state;
  }
}

// Context 创建
const MemoContext = createContext(null);

// Provider
export function MemoProvider({ children }) {
  const [state, dispatch] = useReducer(memoReducer, initialState);
  return (
    <MemoContext.Provider value={{ state, dispatch }}>
      {children}
    </MemoContext.Provider>
  );
}

// 自定义 Hook（统一访问入口）
export function useMemoContext() {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error('useMemoContext must be used within MemoProvider');
  return ctx;
}
```

### 4.2 Context 使用规则

- 每个业务域一个 Context 文件（`AuthContext.jsx`、`MemoContext.jsx`）
- Context 只存**全局共享**状态，页面内部状态用 `useState`
- 必须通过自定义 Hook（`useAuth()`、`useMemoContext()`）访问，**禁止**直接 `useContext`
- 异步操作（API 调用）放在组件中发起，结果通过 `dispatch` 更新状态

---

## 5. 自定义 Hook 规范

```js
// hooks/use-memos.js
import { useEffect, useCallback } from 'react';
import { useMemoContext } from '@/context/MemoContext';
import { api } from '@/lib/api-client';

// Hook 只做一件事：封装某个业务操作的逻辑
export function useMemos() {
  const { state, dispatch } = useMemoContext();

  const fetchMemos = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const data = await api.get('/memos');
      dispatch({ type: 'FETCH_SUCCESS', payload: data });
    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: '加载失败' });
    }
  }, [dispatch]);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  return { memos: state.memos, isLoading: state.isLoading, refetch: fetchMemos };
}
```

---

## 6. API Client 规范

```js
// lib/api-client.js
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',               // 发送 Cookie（Session 认证）
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
```

**规则**：
- 环境变量必须使用 `EXPO_PUBLIC_` 前缀（Expo 约定，才能在客户端访问）
- 所有请求必须带 `credentials: 'include'`（Session Cookie 传递）
- 统一在 `api-client.js` 处理错误，组件只处理业务逻辑
