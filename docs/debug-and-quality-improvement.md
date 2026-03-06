# AIFlomo 调试复盘与质量提升方案

> 记录时间：2026-03-06
> 涉及功能：账号注册/登录（feat/28-feature-account-registration-login-2）

---

## 一、问题复盘

### 问题 1：页面空白（最核心，排查最耗时）

**现象**：访问 `http://localhost:8082/` 返回空白页，`#root` 容器为空，无任何报错。

**根因链（共 4 层）**：

```
"main": "expo-router"               ← package.json 入口写法错误
       ↓ 解析为
expo-router/build/index.js          ← 只是库导出，不含 renderRootComponent
       ↓ 导致
页面 HTML 注入的 <script> 是错误的 bundle
       ↓ 即便有 bundle 也无法渲染，因为
require.context 未启用               ← 缺少 metro.config.js（getDefaultConfig）
babel-preset-expo 版本错误           ← 55.0.10 装在 apps/mobile/node_modules，与 SDK 52 不兼容
```

**具体细节**：

| 子问题 | 根本原因 | 修复方式 |
|--------|---------|---------|
| `<script>` 加载错 bundle | `"main": "expo-router"` → Node 模块解析走 `expo-router/package.json` 的 `main` 字段，得到 `build/index.js`（仅库导出） | 改为 `"main": "expo-router/entry"` |
| `require.context` 未启用 | 缺少 `metro.config.js`，Metro 没有启用 `transformer.unstable_allowRequireContext` | 新建 `apps/mobile/metro.config.js`，调用 `getDefaultConfig` |
| 路由文件编译失败 | `apps/mobile/node_modules/babel-preset-expo@55.0.10` 覆盖了根目录的 `@12.0.12` | 删除 `apps/mobile/node_modules/babel-preset-expo`，`package.json` 固定为 `"babel-preset-expo": "12"` |
| 后端服务无响应 | `apps/server/src/index.js` 未注册任何插件和路由 | 补全 CORS、Session 插件注册及 auth 路由挂载 |
| 登录后空白 | 缺少 `app/memo.jsx` 路由文件 | 创建 `app/memo.jsx` |

---

### 问题 2：`@fastify/cookie` 模块找不到

**现象**：
```
Error: Cannot find module '@fastify/cookie'
  at /Users/.../node_modules/@fastify/session/lib/fastifySession.js
```

**根本原因**：npm workspace 的模块提升（hoisting）行为不一致。
- `@fastify/session` 被提升到根 `node_modules`
- `@fastify/cookie`（它的 peer dependency）留在 `apps/server/node_modules`
- `@fastify/session` 从根目录的上下文 `require('@fastify/cookie')`，找不到

**修复**：将 `@fastify/cookie` 安装到根级别，使其与 `@fastify/session` 同处根 `node_modules`：
```bash
npm install @fastify/cookie@^10.0.1   # 在根目录执行，自动写入根 package.json
```

---

### 问题 3：React Native 文本节点警告

**现象**：
```
Unexpected text node: . A text node cannot be a child of a <View>.
```

**根本原因**：`TextInput` 组件中：
```jsx
// 当 error = ''（空字符串）时：
{error && <Text>{error}</Text>}
// '' && <Text> → 返回 ''，React Native 把它当文本节点渲染
```

**修复**：使用显式布尔转换：
```jsx
{!!error && <Text style={styles.errorText}>{error}</Text>}
```

---

### 问题 4：`npm run dev` 无法同时跑前后端

**现象**：根目录 `npm run dev` 只启动了服务端，前端永远不运行。

**根本原因**：`npm run dev --workspaces` 是**串行**执行的，服务端 `node --watch` 是常驻进程，阻塞后续命令。

**修复**：引入 `concurrently` 并行执行：
```json
"dev": "concurrently \"npm run dev -w apps/server\" \"npm run dev -w apps/mobile\""
```

---

## 二、CI/CD 工作流分析

### 现有工作流一览

| 文件 | 职责 |
|------|------|
| `quality-gate.yml` | lint → build → 自动触发 autofix |
| `autofix.yml` | Claude 自动修复 lint/build 失败，最多 5 轮 |
| `sdd-codegen.yml` | Spec → 设计 → 任务 → 代码生成完整流水线 |
| `code-review.yml` | PR 代码审查 |
| `create-pr.yml` | 自动创建 PR |
| `deploy-selfhost.yml` | 自托管环境部署 |
| `archive-specs.yml` | PR 合并后归档 Spec 文件 |

### 现有流程的覆盖盲区

```
代码生成（sdd-codegen）
      ↓
lint + build（quality-gate）   ← 只验证静态检查和编译
      ↓
autofix（autofix）             ← 只修静态问题
      ↓
code-review                   ← 依赖人工/AI 审查
      ↓
合并部署
```

**本次问题在哪个环节会被漏掉**：

| 问题 | lint | build | E2E | 代码审查 |
|------|------|-------|-----|---------|
| 错误的 `main` 字段 | ❌ | ❌ 构建成功但 bundle 错误 | ✅ 页面空白 | 需要知识 |
| babel-preset 版本冲突 | ❌ | ❌ 无报错 | ✅ 路由失效 | 需要知识 |
| 缺少 metro.config.js | ❌ | ❌ | ✅ | 需要知识 |
| npm hoisting 问题 | ❌ | ❌ | ✅ 启动报错 | 需要知识 |
| 文本节点渲染错误 | ❌ | ❌ | ✅ 页面有警告 | 可能发现 |
| dev 串行问题 | ❌ | ❌ | ❌ | 可能发现 |

**核心结论**：现有 CI 只有 lint/build 静态检查，**没有运行时验证（E2E）**。所有运行时问题都无法被 CI 拦截。

---

## 三、提升建议

### 3.1 CLAUDE.md 需要补充的硬性规则

以下规则直接针对本次问题，加入 CLAUDE.md 的 "AI Agent 专用指令" 和"禁止行为"部分：

**Expo Monorepo 必须遵守的约定：**

```markdown
## Expo Monorepo 配置规范（AI 必读）

### package.json 入口
- apps/mobile/package.json 必须使用 `"main": "expo-router/entry"`
  ❌ 错误：`"main": "expo-router"`（解析为库文件，不含 renderRootComponent）
  ✅ 正确：`"main": "expo-router/entry"`

### metro.config.js
- apps/mobile/ 必须存在 metro.config.js，且必须调用 getDefaultConfig
  理由：getDefaultConfig 启用 require.context（expo-router 路由发现依赖此特性）
  理由：设置正确的 monorepo watchFolders 和 nodeModulesPaths
  模板：
  ```js
  const { getDefaultConfig } = require('expo/metro-config');
  const path = require('path');
  const config = getDefaultConfig(__dirname);
  config.watchFolders = [path.resolve(__dirname, '../..')];
  config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../node_modules'),
  ];
  module.exports = config;
  ```

### babel-preset-expo 版本
- apps/mobile/package.json 中 babel-preset-expo 必须与 Expo SDK 版本匹配
  Expo SDK 52 → babel-preset-expo: "12"（不加 ^ 防止意外升级）
  验证方式：npm ls babel-preset-expo | grep apps/mobile

### npm workspace 依赖
- @fastify/session 的 peer dependency @fastify/cookie 必须安装在根目录
  原因：npm workspace hoisting 可能把 session 提升到根但不提升 cookie
  规则：凡在根 node_modules 中的包，其 peer deps 也必须在根 node_modules

### 并行启动
- 根目录 dev 脚本必须使用 concurrently 并行启动前后端
  ❌ 错误：npm run dev --workspaces（串行，服务端会阻塞前端启动）
  ✅ 正确：concurrently "npm run dev -w apps/server" "npm run dev -w apps/mobile"

### React Native Web 文本节点
- View 的直接子节点不能是字符串或数字
- 条件渲染必须使用 !!value 或 Boolean(value) 而非 value（防止空字符串渲染为文本节点）
  ❌ {error && <Text>{error}</Text>}   // error='' 时渲染空字符串
  ✅ {!!error && <Text>{error}</Text>}  // error='' 时渲染 null

### AI 实现后的自验证步骤（必须执行）
1. npm run lint --workspaces --if-present
2. cd apps/mobile && npx expo export -p web  （验证 bundle 可正常导出）
3. 检查 bundle 内容：grep -c 'renderRootComponent\|AuthContext' dist/bundles/*.js
4. npm run dev（前后端并行启动）后访问页面确认非空白
```

---

### 3.2 quality-gate.yml 需要增加的步骤

在 lint + build 后，增加 **Expo Web Bundle 内容验证**：

```yaml
- name: Verify Expo Web Bundle
  working-directory: apps/mobile
  run: |
    # 导出 web bundle
    npx expo export -p web --output-dir /tmp/expo-dist 2>&1

    # 验证 bundle 不为空且包含关键入口代码
    BUNDLE=$(find /tmp/expo-dist/bundles -name "*.js" | head -1)
    if [ -z "$BUNDLE" ]; then
      echo "❌ No bundle file found"
      exit 1
    fi

    # 验证 renderRootComponent 被包含（关键：确认入口正确）
    if ! grep -q "renderRootComponent" "$BUNDLE"; then
      echo "❌ Bundle missing renderRootComponent — check 'main' field in package.json"
      exit 1
    fi

    # 验证路由被发现（包含 app/ 目录下的文件路径）
    if ! grep -q "app/" "$BUNDLE"; then
      echo "❌ Bundle missing route files — check metro.config.js and require.context"
      exit 1
    fi

    echo "✅ Bundle validation passed ($(wc -c < $BUNDLE) bytes)"
```

---

### 3.3 autofix.yml 工具权限扩展

当前 autofix 只允许 `Read,Write,Bash(ls:*),Bash(find:*),Bash(grep:*)`，无法执行 npm 命令验证修复效果。建议扩展：

```yaml
# 当前
--allowedTools "Read,Write,Bash(ls:*),Bash(find:*),Bash(grep:*)"

# 建议
--allowedTools "Read,Write,Edit,Bash(ls:*),Bash(find:*),Bash(grep:*),Bash(cat:*),Bash(npm run lint:*),Bash(npm run build:*)"
```

同时在 autofix.md 提示词中增加验证步骤指令：
```
修复完成后，必须执行以下验证：
1. npm run lint --workspaces --if-present
2. npm run build --workspaces --if-present
只有两步都通过，才能提交修复。
```

---

### 3.4 sdd-codegen 增加 Checklist 验证

在 SDD 代码生成完成后、触发 Quality Gate 前，增加一个 AI 自检步骤：

```yaml
- name: AI Self-Check
  run: |
    claude --print \
      --allowedTools "Read,Bash(cat:*),Bash(ls:*),Bash(grep:*)" \
      "请检查以下 Expo Monorepo 配置项是否正确：
      1. apps/mobile/package.json 的 main 字段是否为 expo-router/entry
      2. apps/mobile/metro.config.js 是否存在且调用了 getDefaultConfig
      3. babel-preset-expo 版本是否与 Expo SDK 版本匹配
      4. 根 package.json 的 dev 脚本是否使用 concurrently 并行启动
      5. React Native 组件中是否有 {string && <Component>} 的文本节点风险
      6. @fastify/session 的 peer dep @fastify/cookie 是否在根 node_modules
      对每项输出 ✅/❌ 及原因，发现问题立即修复。"
```

---

### 3.5 本次问题的触发模型

```
AI 代码生成
    ↓
未验证运行时行为（只看语法正确性）
    ↓
CI 只跑 lint/build（静态检查通过）
    ↓
问题流入 → 人工调试
```

**目标模型**：

```
AI 代码生成
    ↓
AI 自检（Checklist：入口/配置/版本/依赖）
    ↓
CI: lint + build + bundle 内容验证
    ↓
CI: E2E 冒烟（访问首页，验证非空白，登录流程可走通）
    ↓
质量门禁通过 → 合并
```

---

## 四、问题速查表（AI 生成代码后必查）

| 检查项 | 验证命令 | 预期结果 |
|-------|---------|---------|
| Expo 入口正确 | `grep '"main"' apps/mobile/package.json` | `"expo-router/entry"` |
| metro.config.js 存在 | `ls apps/mobile/metro.config.js` | 文件存在 |
| babel-preset-expo 版本 | `npm ls babel-preset-expo` | 只有一个版本，且与 SDK 匹配 |
| @fastify/cookie 在根 | `ls node_modules/@fastify/cookie` | 目录存在 |
| dev 并行配置 | `grep '"dev"' package.json` | 包含 `concurrently` |
| Bundle 包含入口代码 | `npx expo export -p web && grep -c renderRootComponent dist/bundles/*.js` | 数字 > 0 |
| 后端路由注册 | `curl http://localhost:3000/health` | `{"status":"ok"}` |
| 前端页面非空白 | 访问 `http://localhost:8082/` | 重定向到 /login 并渲染表单 |
