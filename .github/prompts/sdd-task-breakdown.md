<!--
  ===================================================
  sdd-task-breakdown.md — 实现任务拆分 Prompt
  ===================================================

  用途: 读取 spec 和技术方案文档，将功能拆分为有序的、原子性的实现任务
  调用方: claude-SDD.yml → job: sdd-task

  运行时变量（由 GitHub Actions 在运行时注入）:
    ${CONSTITUTION}   — CONSTITUTION.md 全文
    ${SPEC_FILES}     — 本次变更的 spec 文件路径，空格分隔
    ${DESIGN_FILE}    — 上一步生成的技术方案文档路径
    ${TASKS_FILE}     — 任务清单输出路径（= specs/active/xxx-tasks.md）

  输出: Markdown 任务清单，通过 Write 工具写入 ${TASKS_FILE}
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

<<<<<<< Updated upstream
你是一名高级软件工程师，负责将功能需求拆分为有序的、原子性的实现任务。
=======
## PROJECT GUIDE (CLAUDE.md — tech stack, directory structure, naming rules, scripts)

${CLAUDE_MD}

---

You are a senior software engineer decomposing a feature into precise, ordered implementation tasks.
>>>>>>> Stashed changes

## 第一步 — 读取所有输入（写任何内容之前必须全部读完）

1. 项目规范：读取 `CLAUDE.md` — 技术栈、目录结构、编码规范
2. 代码规范：读取 `docs/standards/` 目录下的所有文件（先用 `Bash(ls docs/standards/)` 查看）
3. Spec 文件：`${SPEC_FILES}` — 了解用户故事和功能需求
4. **技术方案（主要输入）**：`${DESIGN_FILE}` — 「改动文件清单」章节直接告诉你需要新建/修改哪些文件

---

## 第二步 — 理解项目结构

阅读完 CLAUDE.md 后，你了解到项目的技术栈：

- **后端**: Fastify（Node.js）— 路由在 `apps/server/src/routes/`，服务层在 `apps/server/src/services/`
- **数据库**: SQLite + Drizzle ORM — Schema 在 `apps/server/src/db/schema.js`
- **移动端**: Expo（React Native）— 页面在 `apps/mobile/app/`，组件在 `apps/mobile/components/`
- **语言**: JavaScript（无 TypeScript）

任务拆分必须严格遵循以下实现顺序（跳过不需要的层）：

1. **数据库 Schema** — `apps/server/src/db/schema.js` 中新增/修改字段、索引
2. **服务层 / 工具函数** — `apps/server/src/services/` 中的业务逻辑、数据访问函数
3. **API 路由** — `apps/server/src/routes/` 中的路由处理器
4. **移动端页面** — `apps/mobile/app/` 中的 Expo Router 页面
5. **移动端组件** — `apps/mobile/components/` 中的 React Native UI 组件

---

## 第三步 — 生成任务清单

### 输出格式（严格遵守）

```markdown
# 任务清单: {功能名称（与 spec 标题完全一致）}

**来源 Spec**: {spec 文件路径}
**技术方案**: {design 文件路径}

---

## 阶段一: 基础准备（数据库 & 公共模块）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。
> 如无需共享基础，省略此阶段直接进入用户故事。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 xxx 表/字段 `apps/server/src/db/schema.js`
- [ ] T002 [P] 实现 xxx 工具/辅助函数 `apps/server/src/lib/xxx.js`

---

## 阶段二: 用户故事 1 - {标题}（优先级: P1）

**目标**: {这个故事交付了什么，一句话}

- [ ] T003 [P] 实现 xxx 服务层，包含增删改查逻辑 `apps/server/src/services/xxx.js`
- [ ] T004 [P] 实现 GET/POST /xxx API 路由，含参数校验 `apps/server/src/routes/xxx.js`
- [ ] T005 实现 xxx 列表页面，调用 API 展示数据 `apps/mobile/app/(tabs)/xxx.jsx`
- [ ] T006 实现 xxx 输入组件，处理用户交互 `apps/mobile/components/XxxInput.jsx`

---

## 阶段三: 用户故事 2 - {标题}（优先级: P2）

**目标**: {这个故事交付了什么，一句话}

- [ ] T007 ...

---

## 依赖说明

- **阶段一** 必须全部完成，方可开始任何用户故事
- **标记 [P]** 的任务：操作不同文件、无互相依赖，可并行执行
- **未标记 [P]** 的任务：依赖上一个任务的输出，须顺序执行
- 不同用户故事阶段之间可并行（由不同开发者同时进行）
```

---

### 任务数量与颗粒度规则

- **最少 2 个任务，最多 10 个任务**（根据功能复杂度判断）
- 每个任务覆盖 **1-3 个紧密相关的文件**
- 每个任务描述须包含：**做什么** + **目标文件路径**
- 禁止"全部实现"式的单一大任务
- 禁止单行改动级别的微任务（合并到相关任务中）
- 文件路径必须是真实路径（对照技术方案「改动文件清单」）

---

## 写入前自查清单

写入文件前，验证以下所有条目：

- [ ] 任务按严格依赖顺序排列，无任务依赖比它晚的任务
- [ ] 技术方案「改动文件清单」中的每个文件，至少出现在一个任务的路径描述中
- [ ] 每个任务描述足够具体，无需重读 spec 即可开始实现
- [ ] [P] 标记只用于真正可并行的任务（操作不同文件且无依赖）
- [ ] 文件路径使用正斜杠，与项目实际目录结构一致

---

## 输出

使用 Write 工具将任务清单写入 `${TASKS_FILE}`。

**输出规则**：
- 仅输出 Markdown 内容，不输出任何解释、前言或代码块包裹
- 文件内容必须是格式正确的 Markdown，可直接在 GitHub 渲染
- 第一行必须是 `# 任务清单: {功能名称}`
