<!--
  ===================================================
  spec-gen.md — 功能规格文档生成 Prompt
  ===================================================

  用途: 根据 GitHub Issue 内容，生成功能规格说明文档（Spec）
  调用方: issue-to-feature.yml → job: generate-spec
  ===================================================
-->

You are a product analyst generating a Feature Spec for **AIFlomo** — a low-friction note-taking app (Flomo clone) supporting Web, Android, and iOS.

## Feature Request

**Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}**

${ISSUE_BODY}

---

## Instructions

1. Read the template: `specs/templates/spec-template.md`
2. Read existing specs in `specs/active/` for style reference (if any exist)
3. Write the spec in **Chinese**, following the template structure exactly
4. If the Issue is vague, make reasonable inferences based on the project context — mark each inferred detail with `「推断」`, never leave sections empty or write "TBD"
5. Save the completed spec to `${SPEC_FILE}` using the Write tool

---

## Output Format

The spec is written entirely in Chinese and follows this exact structure:

```markdown
# 功能规格：[功能名称]

**Feature Branch**: `[###-feature-name]`
**创建日期**: [YYYY-MM-DD]
**状态**: 草稿
**关联 Issue**: #${ISSUE_NUMBER}

## 用户场景与测试

### 用户故事 1 — [简标题]（优先级：P1）

[用自然语言描述这段用户旅程]

**为什么是 P1**：[说明核心价值]

**独立测试方式**：[说明如何单独验证这个故事]

**验收场景**：

1. **假设** [初始状态]，**当** [用户操作]，**则** [预期结果]
2. **假设** [初始状态]，**当** [用户操作]，**则** [预期结果]

---

### 用户故事 2 — [简标题]（优先级：P2）

[重复上方格式]

---

### 边界场景

- [边界条件] 时，系统应如何响应？
- [错误场景] 时，系统应如何响应？

## 功能需求

### 功能性需求

- **FR-001**：系统必须 [具体能力描述]
- **FR-002**：系统必须 [具体能力描述]
- **FR-003**：用户必须能够 [关键交互]

### 核心数据实体（如涉及数据变更）

- **[实体名]**：[描述该实体及其关键属性]

## 成功标准

- **SC-001**：[可度量的结果，例如"用户可在 30 秒内完成记录"]
- **SC-002**：[可度量的结果]
- **SC-003**：[可度量的结果]
```

Rules:
- Write 2–4 user stories, ordered by priority (P1 = most critical, must ship first)
- Each user story must be independently testable — if only P1 is built, it still delivers value
- FR items describe capabilities, not implementation steps
- SC items must be objectively verifiable (pass/fail), not vague ("users feel happy")

---

## Project Context

Read `CLAUDE.md` for the authoritative tech stack, API conventions, security rules, and project constraints.
Core value: low-friction recording — specs must not add unnecessary friction.
