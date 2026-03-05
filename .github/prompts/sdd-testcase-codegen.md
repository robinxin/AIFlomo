<!--
  ===================================================
  sdd-testcase-codegen.md — 测试可执行脚本生成 Prompt
  ===================================================

  用途: 将 sdd-testcase.md 生成的中文测试用例文档，逐条转换为
        Midscene YAML 格式的可执行 E2E 测试脚本
  调用方: SDD 测试流水线 → job: testcase-code（在 testcase-gate 审批后运行）

  运行时变量（由 GitHub Actions 在运行时注入）:
    ${CONSTITUTION}    — CONSTITUTION.md 全文
    ${TESTCASE_FILE}   — 测试用例文档路径（主要输入）
    ${SPEC_FILES}      — spec 文件路径，空格分隔（补充需求上下文）
    ${DESIGN_FILE}     — 技术方案文档路径（sdd-design 生成的，补充技术上下文）
    ${TEST_DIR}        — 测试脚本输出目录（= apps/tests）

  输出: Midscene YAML 测试脚本（.yaml），每个功能模块一个文件
        测试脚本通过 `midscene ./tests/**/*.yaml --dotenv .env` 运行

  运行环境说明:
    - Midscene 模型配置已在 .env 中设置（MIDSCENE_MODEL_* 变量）
    - APP_URL 为被测应用的访问地址，在 .env 中配置
    - 测试运行前，应用必须处于运行状态
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

## PROJECT GUIDE (CLAUDE.md — tech stack, directory structure, naming rules, scripts)

${CLAUDE_MD}

---

你是一位熟悉 Midscene AI 测试框架的自动化测试工程师。项目技术栈、目录结构、命名规范等完整信息已在上方 **PROJECT CONSTITUTION** 和 **PROJECT GUIDE (CLAUDE.md)** 中注入，请以那些内容为唯一权威。

你的任务是：读取中文测试用例文档，将每条用例转换为 Midscene YAML 格式的 E2E 测试脚本。

## 第一步 — 读取输入

1. 使用 Read 工具读取测试用例文档：`${TESTCASE_FILE}`
2. 使用 Read 工具逐一读取 Spec 文件（路径列表：`${SPEC_FILES}`，多个路径按空格分隔，需分别读取）
3. 使用 Read 工具读取技术方案文档：`${DESIGN_FILE}`（理解 API 路径、字段结构、业务逻辑边界）
4. 列出 `docs/standards/` 下所有 `.md` 文件（`Bash: ls docs/standards/`），并逐一读取，理解后端和前端编码规范
5. 使用 `Bash: mkdir -p ${TEST_DIR}` 确保输出目录存在

---

## 第二步 — 理解测试用例文档结构

测试用例文档按**功能模块**分组，每条用例包含：
- **用例标题**（用例的一行简介）
- **操作步骤**（具体用户操作，1…2…3…）
- **预期结果**（验证什么、期望看到什么）

每个功能模块对应一个 YAML 文件，每条用例对应 YAML 中的一个 task。

---

## 第三步 — 生成 Midscene YAML 文件

### 文件命名规则

```
${TEST_DIR}/{功能模块名（kebab-case）}.yaml
```

示例：
- 创建备忘录模块 → `${TEST_DIR}/memo-create.yaml`
- 标签管理模块   → `${TEST_DIR}/tag-management.yaml`

---

### YAML 文件结构（必须严格遵守）

注意：`url` 字段写入字面量 `${APP_URL}`（保留 `${}` 语法，Midscene 运行时从 `.env` 读取）。
登录账号自行生成

```yaml
web:
  url: "${APP_URL}"                  # Midscene 运行时从 .env 读取
  viewportWidth: 1280
  viewportHeight: 800

agent:
  testId: "{功能模块名（kebab-case）}"
  generateReport: true

tasks:
  # 如果该模块的用例需要登录，第一个 task 必须是登录流程
  - name: "前置-用户登录"
    continueOnError: false           # 登录失败则停止整个文件
    flow:
      - aiInput: "邮箱输入框"
        value: ""                   # 自行生成邮箱
      - aiInput: "密码输入框"
        value: ""                   # 自行生成密码
      - aiTap: "点击登录按钮"
      - aiWaitFor: "登录成功，页面跳转到主界面"
        timeout: 5000

  # 每条测试用例对应一个 task
  - name: "{用例标题原文}"
    continueOnError: true            # 单条用例失败不影响后续
    flow:
      - {actions...}
```

---

### 可用 Action 对照表

将测试用例的"操作步骤"和"预期结果"翻译为以下 action：

| 场景 | 使用的 Action | 示例 |
|------|--------------|------|
| 通用 UI 操作（找元素、点击、导航） | `ai` | `- ai: "在搜索框输入关键词，点击搜索"` |
| 精确输入文字 | `aiInput` + `value` | `- aiInput: "找到备忘录输入框"` <br> `  value: "今天学了 Midscene"` |
| 精确点击元素 | `aiTap` | `- aiTap: "点击发送按钮"` |
| 等待某个条件出现 | `aiWaitFor` + `timeout` | `- aiWaitFor: "备忘录列表加载完成"` <br> `  timeout: 5000` |
| 验证页面状态（预期结果） | `aiAssert` + `errorMessage` | `- aiAssert: "备忘录出现在列表顶部"` <br> `  errorMessage: "备忘录创建后未出现在列表中"` |
| 执行 JS（跳转、清除状态） | `javascript` | `- javascript: "window.location.href = '/login'"` |
| 等待固定时间 | `sleep` | `- sleep: 2000` |

**规则：**
- 操作步骤 → 转换为 `ai` / `aiInput` / `aiTap` / `aiWaitFor` / `javascript`
- 预期结果 → 转换为 `aiAssert`，`errorMessage` 写清楚"失败时意味着什么"

---

### 各类场景的翻译模板

**正常场景（功能成功）：**
```yaml
- name: "{用例标题}"
  continueOnError: true
  flow:
    - aiInput: "找到备忘录输入框"
      value: "测试内容"
    - aiTap: "点击发送按钮"
    - aiAssert: "新备忘录出现在列表顶部，内容为"测试内容""
      errorMessage: "备忘录创建后未显示在列表中"
```

**未登录场景：**
```yaml
- name: "{用例标题}-未登录访问"
  continueOnError: true
  flow:
    - javascript: "document.cookie = ''; window.location.href = '/'"
    - sleep: 1000
    - aiAssert: "页面显示登录表单，未进入主界面"
      errorMessage: "未登录时应跳转到登录页"
```

**输入校验场景（空值 / 超长 / 格式错误）：**
```yaml
- name: "{用例标题}-{字段}不合法"
  continueOnError: true
  flow:
    - aiInput: "找到备忘录输入框"
      value: ""                      # 空值场景
    - aiTap: "点击发送按钮"
    - aiAssert: "页面显示错误提示，备忘录未被提交"
      errorMessage: "空内容应该被拦截并提示用户"
```

**资源不存在场景：**
```yaml
- name: "{用例标题}-资源不存在"
  continueOnError: true
  flow:
    - javascript: "window.location.href = '/memo/nonexistent-id-12345'"
    - sleep: 1000
    - aiAssert: "页面显示"未找到"或"不存在"的提示，或跳转回列表"
      errorMessage: "不存在的资源应给出友好提示"
```

---

## 第四步 — 输出所有文件

写完所有 YAML 文件后，每个文件输出一行标记：

```
WRITTEN: {TEST_DIR}/memo-create.yaml
WRITTEN: {TEST_DIR}/tag-management.yaml
```

---

## 硬性规则

- **每条测试用例必须对应一个 task**，不得遗漏
- **task 的 name 字段必须包含用例标题原文**，便于报告溯源
- **需要登录的模块，第一个 task 必须是登录流程**
- **`aiAssert` 必须有 `errorMessage`**，描述断言失败时意味着什么
- **不得发起真实的 HTTP API 调用**（Midscene 是 UI 级测试，通过界面操作验证，不直接调接口）
- **不得凭空发明用例**，只翻译 `${TESTCASE_FILE}` 中已有的用例
- 如果某条用例的步骤模糊，在该 task 的 flow 开头加注释：`# 注：原用例步骤不明确，已按以下方式解读：...`
- 使用 Write 工具将每个文件写入 `${TEST_DIR}/`
