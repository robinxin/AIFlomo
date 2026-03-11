# §4 前端页面与组件设计 — 账号注册与登录（Issue #43）

> 作者: frontend-developer subagent
> 日期: 2026-03-11
> Spec 来源: specs/active/43-feature-account-registration-login-3.md
> Architect 数据模型来源: specs/active/43-feature-account-registration-login-3-design.md.architect.md

---

## 4.1 新增 Screen（路由页面）

所有新增页面位于 `apps/mobile/app/` 下，遵循 Expo Router 文件路由约定。

### 4.1.1 `apps/mobile/app/(auth)/_layout.jsx`

**URL 路径**: 路由分组布局，不对应独立 URL

**职责**:
- 作为 `(auth)` 路由分组的布局容器，统一管理登录/注册页面的导航栈
- 在布局层检测 `isAuthenticated` 状态：若用户已登录，立即重定向到主应用（`/`）
- 配置 Stack 导航，去掉默认 header（`headerShown: false`），由各页面自行控制视觉层次

**实现要点**:

```jsx
// app/(auth)/_layout.jsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function AuthLayout() {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 已登录用户不应访问认证页面，重定向到主界面
    if (!state.isLoading && state.isAuthenticated) {
      router.replace('/');
    }
  }, [state.isLoading, state.isAuthenticated]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

### 4.1.2 `apps/mobile/app/(auth)/login.jsx`

**URL 路径**: `/login`

**职责**:
- 用户身份验证的入口页面，收集邮箱和密码
- 仅在提交时进行前端格式验证（减少登录摩擦，符合 Spec 要求）
- 登录成功后通过 `router.replace('/')` 跳转主界面（替换历史栈，防止返回到登录页）
- 提供"立即注册"导航链接，跳转时清空表单状态

**页面状态（useState 管理，局部状态）**:

| 状态变量 | 类型 | 说明 |
|---------|------|------|
| `email` | string | 邮箱输入值 |
| `password` | string | 密码输入值 |
| `showPassword` | boolean | 密码是否明文显示 |
| `formError` | string \| null | 表单顶部统一错误提示（来自服务端） |

**UI 结构**:

```
LoginScreen
├── KeyboardAvoidingView（键盘避让容器）
│   └── ScrollView
│       ├── Text（页面标题："欢迎回来"）
│       ├── FormError（条件渲染，formError 非空时显示）
│       ├── TextInput（邮箱，keyboardType="email-address"）
│       ├── PasswordInput（密码 + 眼睛图标切换）
│       ├── AuthButton（登录按钮，加载状态时禁用）
│       └── Text + Pressable（"没有账号？立即注册"）
```

**关键交互**:

1. 用户点击"登录"按钮
2. 前端校验：邮箱格式 + 密码非空（不符合则在 formError 显示）
3. 调用 `useAuth` 提供的 `login(email, password)` 方法
4. 等待期间按钮显示"登录中..."且禁用，所有输入框禁用
5. 成功：`AuthContext` 状态更新，`(auth)/_layout.jsx` 检测到 `isAuthenticated=true` 触发重定向
6. 失败：`formError` 设置为错误信息（如"邮箱或密码错误，请重试"），密码框清空，邮箱框保留

---

### 4.1.3 `apps/mobile/app/(auth)/register.jsx`

**URL 路径**: `/register`

**职责**:
- 新用户注册入口，收集邮箱、昵称、密码、隐私协议同意状态
- 失焦时（blur）对各字段进行实时格式验证（符合 Spec P3 要求）
- 注册成功后自动登录，跳转主界面（服务端注册+登录一体，无需二次输入）
- 提供"返回登录"导航链接，跳转时清空表单状态

**页面状态（useState 管理，局部状态）**:

| 状态变量 | 类型 | 说明 |
|---------|------|------|
| `email` | string | 邮箱输入值 |
| `nickname` | string | 昵称输入值 |
| `password` | string | 密码输入值 |
| `showPassword` | boolean | 密码是否明文显示 |
| `agreedToPrivacy` | boolean | 隐私协议是否已勾选 |
| `fieldErrors` | object | 字段级错误：`{ email, nickname, password, privacy }` |
| `formError` | string \| null | 表单顶部统一错误提示（来自服务端） |

**UI 结构**:

```
RegisterScreen
├── KeyboardAvoidingView
│   └── ScrollView
│       ├── Text（页面标题："创建账号"）
│       ├── FormError（条件渲染，formError 非空时显示）
│       ├── TextInput（邮箱，keyboardType="email-address"，onBlur 触发验证）
│       │   └── FieldError（邮箱格式错误提示）
│       ├── TextInput（昵称，maxLength=20，onBlur 触发验证）
│       │   └── FieldError（昵称长度错误提示）
│       ├── PasswordInput（密码 + 眼睛图标，onBlur 触发验证）
│       │   └── FieldError（密码长度错误提示）
│       ├── PrivacyCheckbox（隐私协议勾选框 + 协议文字）
│       │   └── FieldError（未勾选时提示）
│       ├── AuthButton（注册按钮，加载状态时禁用）
│       └── Text + Pressable（"已有账号？返回登录"）
```

**字段验证规则（onBlur 触发）**:

| 字段 | 验证规则 | 错误提示 |
|------|---------|---------|
| email | 正则：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | "请输入有效的邮箱地址" |
| nickname | 长度 2-20 字符，非纯空格 | "昵称长度为 2-20 个字符" / "昵称最多 20 个字符" |
| password | 长度 8-20 字符 | "密码长度至少为 8 个字符" / "密码最多 20 个字符" |
| agreedToPrivacy | 必须为 true（提交时验证） | "请阅读并同意隐私协议" |

**关键交互**:

1. 用户填写字段 → 失焦时触发对应字段验证，立即显示错误提示（<200ms）
2. 用户点击"注册"按钮 → 全量验证所有字段（含未触碰字段）
3. 前端验证通过 → 调用 `useAuth` 提供的 `register(email, nickname, password, agreedToPrivacy)` 方法
4. 等待期间按钮显示"注册中..."且禁用，所有输入框禁用
5. 成功：`AuthContext` 更新（服务端返回已登录用户信息），重定向到主界面
6. 失败（邮箱已注册）：`formError` 显示"该邮箱已被注册"，表单内容保留，按钮恢复可点击

---

### 4.1.4 `apps/mobile/app/_layout.jsx`（修改现有根布局）

**变更说明**: 根布局需要包裹 `AuthProvider`，并在应用启动时调用 `GET /api/auth/me` 恢复登录状态。

**变更内容**:

```jsx
// app/_layout.jsx（在现有根布局基础上新增 AuthProvider 包裹）
import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* 其他已有 Provider（如 MemoProvider）保持不变 */}
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
```

**重要**: `AuthProvider` 必须是最外层 Provider，确保所有子路由（包括 `(auth)` 分组）都能访问认证状态。

---

## 4.2 新增组件

所有组件位于 `apps/mobile/components/` 下，使用具名 export（`export function ComponentName`）。

### 4.2.1 `apps/mobile/components/auth/FormError.jsx`

**职责**: 展示表单顶部的服务端错误提示框（红色背景，白色文字）

**Props**:

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 错误提示文字 |

**渲染逻辑**: 仅当 `message` 非空时渲染，否则返回 `null`。

```jsx
// components/auth/FormError.jsx
import { View, Text, StyleSheet } from 'react-native';

export function FormError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  text: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
});
```

---

### 4.2.2 `apps/mobile/components/auth/FieldError.jsx`

**职责**: 展示输入框下方的字段级验证错误提示（红色文字）

**Props**:

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 字段错误提示文字 |

**渲染逻辑**: 仅当 `message` 非空时渲染，否则返回 `null`。

```jsx
// components/auth/FieldError.jsx
import { Text, StyleSheet } from 'react-native';

export function FieldError({ message }) {
  if (!message) return null;
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
});
```

---

### 4.2.3 `apps/mobile/components/auth/PasswordInput.jsx`

**职责**: 带密码明文/密文切换功能的输入框组件（右侧眼睛图标）

**Props**:

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `value` | string | 是 | 输入框当前值 |
| `onChangeText` | function | 是 | 文字变化回调 |
| `onBlur` | function | 否 | 失焦回调（注册页用于触发验证） |
| `placeholder` | string | 否 | 占位文字，默认"请输入密码" |
| `editable` | boolean | 否 | 是否可编辑，默认 true（加载时禁用） |
| `error` | boolean | 否 | 是否处于错误状态（控制边框颜色） |

**内部状态**: `showPassword`（boolean，控制 `secureTextEntry`）

```jsx
// components/auth/PasswordInput.jsx
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';

export function PasswordInput({ value, onChangeText, onBlur, placeholder = '请输入密码', editable = true, error = false }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, error && styles.containerError]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        secureTextEntry={!showPassword}
        editable={editable}
        autoCapitalize="none"
      />
      <Pressable
        style={styles.eyeButton}
        onPress={() => setShowPassword((prev) => !prev)}
        accessibilityLabel={showPassword ? '隐藏密码' : '显示密码'}
      >
        {/* 眼睛图标用文字替代，保持零依赖原则 */}
        <View style={styles.eyeIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  containerError: {
    borderColor: '#dc2626',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
  },
  eyeButton: {
    width: 44,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    width: 20,
    height: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6b7280',
  },
});
```

---

### 4.2.4 `apps/mobile/components/auth/PrivacyCheckbox.jsx`

**职责**: 隐私协议勾选框组件，包含协议文字和勾选状态

**Props**:

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `checked` | boolean | 是 | 是否已勾选 |
| `onToggle` | function | 是 | 切换勾选状态的回调 |
| `error` | boolean | 否 | 是否处于错误状态（高亮显示提示） |

**渲染逻辑**: 默认未勾选（符合 Spec 规定"不预设为已勾选"），点击整行或勾选框均可切换状态。

```jsx
// components/auth/PrivacyCheckbox.jsx
import { View, Text, Pressable, StyleSheet } from 'react-native';

export function PrivacyCheckbox({ checked, onToggle, error = false }) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <View style={[styles.box, checked && styles.boxChecked, error && styles.boxError]}>
        {checked && <View style={styles.checkmark} />}
      </View>
      <Text style={[styles.label, error && styles.labelError]}>
        我已阅读并同意
        <Text style={styles.link}>《隐私协议》</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxChecked: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  boxError: {
    borderColor: '#dc2626',
  },
  checkmark: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    flexWrap: 'wrap',
  },
  labelError: {
    color: '#dc2626',
  },
  link: {
    color: '#4caf50',
    textDecorationLine: 'underline',
  },
});
```

---

### 4.2.5 `apps/mobile/components/auth/AuthButton.jsx`

**职责**: 认证页面统一提交按钮，处理加载状态和禁用状态

**Props**:

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 正常状态按钮文字（如"登录"、"注册"） |
| `loadingTitle` | string | 是 | 加载状态按钮文字（如"登录中..."、"注册中..."） |
| `onPress` | function | 是 | 点击回调 |
| `isLoading` | boolean | 是 | 是否处于加载状态 |
| `disabled` | boolean | 否 | 是否禁用（默认 false） |

```jsx
// components/auth/AuthButton.jsx
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';

export function AuthButton({ title, loadingTitle, onPress, isLoading, disabled = false }) {
  const isDisabled = isLoading || disabled;
  return (
    <Pressable
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={isLoading ? loadingTitle : title}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
    >
      {isLoading && <ActivityIndicator size="small" color="#fff" style={styles.spinner} />}
      <Text style={styles.text}>{isLoading ? loadingTitle : title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    backgroundColor: '#4caf50',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#a7d7a9',
  },
  spinner: {
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## 4.3 Context / Reducer 变更

### 4.3.1 新增文件：`apps/mobile/context/AuthContext.jsx`

**职责**: 管理全局用户认证状态，作为整个应用认证系统的单一来源（Single Source of Truth）

**初始状态**:

```js
const initialState = {
  user: null,           // { id, email, nickname } | null
  isLoading: true,      // 初始为 true，等待 GET /api/auth/me 完成
  isAuthenticated: false,
  error: null,          // 全局认证错误（如 Session 过期提示）
};
```

**Action Types（新增）**:

| Action Type | Payload | 说明 |
|------------|---------|------|
| `AUTH_INIT_START` | - | 应用启动，开始恢复 Session（`isLoading: true`） |
| `AUTH_INIT_SUCCESS` | `user` 对象 | Session 恢复成功，设置用户信息（`isAuthenticated: true`） |
| `AUTH_INIT_FAIL` | - | Session 不存在或已过期（`isAuthenticated: false`，`isLoading: false`） |
| `LOGIN_SUCCESS` | `user` 对象 | 登录成功，设置用户信息（`isAuthenticated: true`） |
| `REGISTER_SUCCESS` | `user` 对象 | 注册成功（同时自动登录），设置用户信息（`isAuthenticated: true`） |
| `LOGOUT_SUCCESS` | - | 退出登录，清除用户信息（`user: null`，`isAuthenticated: false`） |
| `AUTH_ERROR` | `errorMessage` 字符串 | 认证操作出错，更新 error 字段 |

**Reducer 结构**:

```js
function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_INIT_START':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_INIT_SUCCESS':
      return { ...state, isLoading: false, isAuthenticated: true, user: action.payload };
    case 'AUTH_INIT_FAIL':
      return { ...state, isLoading: false, isAuthenticated: false, user: null };
    case 'LOGIN_SUCCESS':
      return { ...state, isLoading: false, isAuthenticated: true, user: action.payload, error: null };
    case 'REGISTER_SUCCESS':
      return { ...state, isLoading: false, isAuthenticated: true, user: action.payload, error: null };
    case 'LOGOUT_SUCCESS':
      return { ...state, isLoading: false, isAuthenticated: false, user: null, error: null };
    case 'AUTH_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    default:
      return state;
  }
}
```

**Provider 职责**:
- 挂载时自动调用 `GET /api/auth/me`，dispatch `AUTH_INIT_START` -> `AUTH_INIT_SUCCESS` 或 `AUTH_INIT_FAIL`
- 通过 `value={{ state, dispatch }}` 向子组件暴露状态和 dispatch

**访问 Hook**:

```js
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
```

---

## 4.4 自定义 Hook 变更

### 4.4.1 新增文件：`apps/mobile/hooks/use-auth.js`

**职责**: 封装认证相关的业务操作（login、register、logout），将 API 调用与 dispatch 逻辑集中管理，页面组件只需调用方法，无需关心内部实现。

**对外暴露的接口**:

| 方法/属性 | 类型 | 说明 |
|---------|------|------|
| `state` | object | `{ user, isLoading, isAuthenticated, error }` |
| `login(email, password)` | async function | 调用登录 API，成功后 dispatch LOGIN_SUCCESS |
| `register(email, nickname, password, agreedToPrivacy)` | async function | 调用注册 API，成功后 dispatch REGISTER_SUCCESS |
| `logout()` | async function | 调用登出 API，成功后 dispatch LOGOUT_SUCCESS |

**实现概要**:

```js
// hooks/use-auth.js
import { useCallback } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

export function useAuth() {
  const { state, dispatch } = useAuthContext();

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'AUTH_INIT_START' });
    try {
      const user = await api.post('/api/auth/login', { email, password });
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (err) {
      dispatch({ type: 'AUTH_ERROR', payload: err.message });
      throw err; // 重新抛出，允许页面层捕获并设置 formError
    }
  }, [dispatch]);

  const register = useCallback(async (email, nickname, password, agreedToPrivacy) => {
    dispatch({ type: 'AUTH_INIT_START' });
    try {
      const user = await api.post('/api/auth/register', {
        email,
        nickname,
        password,
        agreedToPrivacy,
      });
      dispatch({ type: 'REGISTER_SUCCESS', payload: user });
    } catch (err) {
      dispatch({ type: 'AUTH_ERROR', payload: err.message });
      throw err;
    }
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
      dispatch({ type: 'LOGOUT_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'AUTH_ERROR', payload: err.message });
    }
  }, [dispatch]);

  return { state, login, register, logout };
}
```

**设计说明**:
- `login` 和 `register` 在捕获错误后重新抛出（`throw err`），使页面层可以区分 API 错误与网络错误，并相应设置 `formError`
- `logout` 不重新抛出，失败时仅记录 error 状态，用户可重试
- 所有方法使用 `useCallback` 防止不必要的重渲染

---

## 4.5 用户交互流程

### 4.5.1 完整注册流程

```
用户看到                    用户操作                      系统响应
──────────────────────────────────────────────────────────────────
注册页（空表单）           → 访问 /register             → 渲染 RegisterScreen
                                                          AuthLayout 确认未登录
                           → 输入邮箱 "test@"           → 更新 email state
                           → 失焦邮箱输入框              → 触发邮箱验证
邮箱下方红色提示            ← 显示 "请输入有效的邮箱地址"  ← FieldError 渲染
                           → 修正邮箱 "test@example.com"→ 更新 email state
                           → 失焦邮箱                   → 验证通过，错误清空
                           → 输入昵称 "张三"             → 更新 nickname state
                           → 失焦昵称                   → 长度验证通过
                           → 输入密码 "123"              → 更新 password state
                           → 失焦密码                   → 触发密码验证
密码下方红色提示            ← 显示 "密码长度至少为 8 个字符"← FieldError 渲染
                           → 修正密码 "123456789"        → 更新 password state
                           → 失焦密码                   → 验证通过，错误清空
                           → 勾选隐私协议                → agreedToPrivacy = true
                           → 点击"注册"按钮              → 全量验证通过
按钮变"注册中..."禁用       ← isLoading = true            ← AuthButton 更新
所有输入框禁用              ← editable = false            ← 各输入框更新
                                                          api.post('/api/auth/register', ...)
                                                          后端创建账号+自动登录
                                                          返回 { data: user }
                                                          dispatch REGISTER_SUCCESS
                                                          isAuthenticated = true
自动跳转 Memo 列表          ← router.replace('/')         ← AuthLayout useEffect 触发
```

### 4.5.2 注册失败流程（邮箱已被注册）

```
用户看到                    用户操作                      系统响应
──────────────────────────────────────────────────────────────────
注册页（填好表单）          → 点击"注册"按钮              → api.post 请求发出
按钮"注册中..."禁用         ← isLoading = true            ← 加载状态
                                                          后端返回 409 Conflict
                                                          { error: '该邮箱已被注册' }
                                                          api-client 抛出 Error
                                                          useAuth.register catch 重抛
                                                          RegisterScreen catch
表单顶部红色错误框           ← formError = "该邮箱已被注册" ← FormError 渲染
按钮恢复"注册"可点击         ← isLoading = false           ← AuthButton 更新
所有输入框恢复可编辑         ← editable = true             ←
表单内容完整保留                                           （不清空）
```

### 4.5.3 完整登录流程

```
用户看到                    用户操作                      系统响应
──────────────────────────────────────────────────────────────────
登录页（空表单）           → 访问 /login                 → 渲染 LoginScreen
                           → 输入邮箱和密码              → 更新 email/password state
                           → 点击"登录"按钮              → 前端格式验证通过
按钮"登录中..."禁用         ← isLoading = true            ← AuthButton 更新
                                                          api.post('/api/auth/login', ...)
                                                          后端验证通过，设置 Session Cookie
                                                          返回 { data: user }
                                                          dispatch LOGIN_SUCCESS
                                                          isAuthenticated = true
自动跳转 Memo 列表          ← router.replace('/')         ← AuthLayout useEffect 触发
```

### 4.5.4 登录失败流程（密码错误）

```
用户看到                    用户操作                      系统响应
──────────────────────────────────────────────────────────────────
登录页（填好表单）          → 点击"登录"按钮              → api.post 请求发出
                                                          后端返回 401 Unauthorized
                                                          { error: '邮箱或密码错误，请重试' }
                                                          api-client 抛出 Error
表单顶部红色错误框           ← formError = "邮箱或密码错误，请重试"
密码框自动清空              ← password = ""               ← LoginScreen 处理
邮箱框内容保留
按钮恢复"登录"可点击
```

### 4.5.5 Session 恢复流程（应用启动）

```
系统行为                   说明
──────────────────────────────────────────────────────────────────
应用启动                   RootLayout 渲染，AuthProvider 挂载
isLoading = true           dispatch AUTH_INIT_START
                           api.get('/api/auth/me') 请求发出
                           （此时所有子路由等待认证状态）

[情况A] Session 有效：
isAuthenticated = true     dispatch AUTH_INIT_SUCCESS
user = { id, email, nickname }
路由正常进入主界面

[情况B] Session 不存在/过期：
isAuthenticated = false    dispatch AUTH_INIT_FAIL
isLoading = false
AuthLayout 检测到未登录，重定向到 /login
```

---

## 4.6 调用的 API 端点

所有端点均通过 `apps/mobile/lib/api-client.js` 中的 `api` 对象调用，基础路径由 `EXPO_PUBLIC_API_URL` 环境变量配置。

| 调用位置 | HTTP 方法 | 端点路径 | 请求体 | 成功响应 `data` 字段 | 调用时机 |
|---------|----------|---------|--------|-------------------|---------|
| `AuthProvider` 挂载时 | GET | `/api/auth/me` | - | `{ id, email, nickname }` | 应用启动，恢复 Session |
| `useAuth.login()` | POST | `/api/auth/login` | `{ email, password }` | `{ id, email, nickname }` | 用户点击"登录"按钮 |
| `useAuth.register()` | POST | `/api/auth/register` | `{ email, nickname, password, agreedToPrivacy }` | `{ id, email, nickname }` | 用户点击"注册"按钮 |
| `useAuth.logout()` | POST | `/api/auth/logout` | `{}` | `null` | 用户主动退出（未来功能入口） |

**错误响应格式**（遵循项目统一 API 响应规范）:

```js
// 失败响应（由 api-client.js 的 res.ok 判断分支处理）
{ data: null, error: string, message: string }
```

**错误码与前端处理映射**:

| HTTP 状态码 | 业务场景 | 前端处理 |
|------------|---------|---------|
| 401 | 登录凭证错误 / Session 未登录 | 显示 formError，密码框清空 |
| 409 | 邮箱已被注册 | 显示 formError，表单内容保留 |
| 422 | 请求数据格式错误 | 显示 formError（通常被前端验证拦截） |
| 500 | 服务端内部错误 | 显示 "服务暂时不可用，请稍后重试" |
| 网络错误 | fetch 抛出 TypeError | 显示 "网络连接失败，请稍后重试"，内容保留 |

---

## 4.7 文件清单汇总

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新增 | `apps/mobile/app/(auth)/_layout.jsx` | Auth 路由分组布局，处理已登录重定向 |
| 新增 | `apps/mobile/app/(auth)/login.jsx` | 登录页面 Screen |
| 新增 | `apps/mobile/app/(auth)/register.jsx` | 注册页面 Screen |
| 修改 | `apps/mobile/app/_layout.jsx` | 根布局添加 AuthProvider 包裹 |
| 新增 | `apps/mobile/context/AuthContext.jsx` | 认证状态 Context + Reducer + Provider |
| 新增 | `apps/mobile/hooks/use-auth.js` | 认证操作封装 Hook |
| 新增 | `apps/mobile/components/auth/FormError.jsx` | 表单顶部错误提示组件 |
| 新增 | `apps/mobile/components/auth/FieldError.jsx` | 字段级错误提示组件 |
| 新增 | `apps/mobile/components/auth/PasswordInput.jsx` | 密码输入框（含明文切换） |
| 新增 | `apps/mobile/components/auth/PrivacyCheckbox.jsx` | 隐私协议勾选框组件 |
| 新增 | `apps/mobile/components/auth/AuthButton.jsx` | 认证页提交按钮（含加载状态） |
