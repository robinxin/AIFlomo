<!--
  ===================================================
  spec-gen.md — 功能规格文档生成 Prompt
  ===================================================

  用途: 根据 GitHub Issue 内容，生成完整的功能规格说明文档（Spec），
        供后续 SDD 流水线（技术方案设计 → 代码生成）使用
  调用方: issue-to-feature.yml → job: generate-spec → step: Generate Spec from Issue

  运行时变量（由 GitHub Actions 在运行时注入）:
    ${CONSTITUTION}   — CONSTITUTION.md 全文
    ${ISSUE_NUMBER}   — GitHub Issue 编号
    ${ISSUE_TITLE}    — Issue 标题
    ${ISSUE_BODY}     — Issue 正文
    ${SPEC_FILE}      — Spec 文档的输出路径（specs/active/xxx.md）

  输出: 中文 Spec 文档，通过 Write 工具保存到 ${SPEC_FILE}
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

You are a software architect generating a Feature Spec document for AIFlomo.

AIFlomo is a full-stack Flomo-like note-taking application. Its core value is **low-friction note recording**.
Everything you spec must be compatible with this goal and this tech stack:

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Server Components by default) |
| Language | TypeScript strict mode |
| Database | SQLite via Prisma ORM |
| Existing models | User, Session, Note (content, title?, tags), Tag, NoteTag |
| API convention | REST; all responses: `{ data, error, message }` |
| Auth | Session token stored in HTTP-only cookie |
| Tests | Vitest + @vitest/coverage-v8 |

## Feature Request

**Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}**

${ISSUE_BODY}

---

## Step-by-Step Instructions

**Step 1 — Read reference materials:**
- Read the template: `specs/templates/feature-spec-template.md`
- Use `Bash(ls)` to list `specs/active/` and read 1 existing spec for style reference
- Read `apps/prisma/schema.prisma` to understand the current data model

**Step 2 — Write the complete spec in Chinese:**

Save to `${SPEC_FILE}`. Fill in EVERY section — no placeholder text, no "TBD".

---

## Document Structure (follow exactly)

### Header
```markdown
# Feature Spec: <功能名称>

**作者**: GitHub Actions (AI Generated)
**日期**: <今天的日期 YYYY-MM-DD>
**状态**: 已批准
**关联 Issue**: #${ISSUE_NUMBER}
```

### 第 1 节 — 背景
- 为什么 AIFlomo 需要这个功能
- 连接到核心价值（低摩擦记录）
- 目标用户场景（2–3 句话，具体）

### 第 2 节 — 用户故事
写至少 2 个用户故事，格式：
```
作为 [用户角色]，
我希望 [做某件事]，
以便 [获得某种价值]。
```

### 第 3 节 — 功能描述
- 完整的用户交互流程（逐步描述：用户看到什么 → 点击什么 → 系统如何响应）
- 页面或组件的 UI 行为（加载状态、空状态、成功状态、错误状态）
- 边界场景的处理方式

### 第 4 节 — 数据模型
- 列出需要新增或修改的 Prisma model 及字段
- 提供完整可直接复制的 schema 片段（包含字段类型、约束、关系）
- 如无数据模型变更，明确写："**本次功能无需数据模型变更**"

### 第 5 节 — API 设计
对每个新增或修改的接口，提供：

```markdown
#### POST /api/xxx
**鉴权**: 需要登录（从 cookie 读取 session token）

**请求 Body**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| field | string | 是 | 说明，最大 N 字符 |

**成功响应** (200):
{ "data": { ... }, "error": null, "message": "操作成功" }

**失败响应**:
- 400: { "data": null, "error": "content 不能为空", "message": "请求参数错误" }
- 401: { "data": null, "error": "未登录", "message": "请先登录" }
- 404: { "data": null, "error": "记录不存在", "message": "..." }
```

### 第 6 节 — 边界条件与错误处理
- 输入校验规则（字段类型、长度限制、格式要求、必填/选填）
- 前端和后端都必须校验的规则（明确列出）
- 错误场景清单：每种错误对应的 HTTP 状态码和用户提示
- 特别注意：Note content 长度限制为 10,000 字符

### 第 7 节 — 不包含（范围边界）
明确列出本次不做的功能（至少 3 条），防止实现阶段范围蔓延。
示例：本次不包含……、本次不实现……、……留待后续迭代……

### 第 8 节 — 验收标准
分三类，每条必须是二元可测试的（是/否，不能是"应该差不多"这类模糊描述）：

**功能验收**（用户视角）:
- [ ] 用户可以……（具体操作 + 期望结果）
- [ ] 当……时，系统显示……

**技术验收**（代码视角）:
- [ ] 所有 API 响应遵循 `{ data, error, message }` 结构
- [ ] 输入长度超限时 API 返回 400
- [ ] 未登录访问受保护接口时返回 401
- [ ] 所有用户输入以纯文本渲染（无 XSS 风险）

**性能验收**（如适用）:
- [ ] 列表接口响应时间 < 500ms（正常数据量下）

---

## Output Requirements

- Language: **Chinese**（整个文档用中文）
- All 8 sections must be completed — no empty sections, no "待补充"
- API endpoints must have real field names, real types, real error messages
- Acceptance criteria must be binary-testable (a developer can verify pass/fail with certainty)
- The spec must be complete enough that an engineer can implement it without any follow-up questions
- Use Write tool to save the completed document to `${SPEC_FILE}`
