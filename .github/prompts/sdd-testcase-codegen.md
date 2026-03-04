<!--
  ===================================================
  sdd-testcase-codegen.md — 测试用例代码生成 Prompt（Prompt B）
  ===================================================

  用途: 将 sdd-testcase.md 生成的中文测试用例文档，逐条翻译为可执行的 Vitest 测试代码
  调用方: SDD 测试流水线 → job: sdd-testcase-codegen（在 sdd-testcase 之后运行）

  运行时变量（由 GitHub Actions 在运行时注入）:
    ${CONSTITUTION}    — CONSTITUTION.md 全文
    ${TESTCASE_FILE}   — sdd-testcase.md 生成的测试用例文档路径（本文件的主要输入）
    ${SPEC_FILES}      — spec 文件路径（补充上下文）
    ${TEST_DIR}        — 测试代码输出目录（apps/flomo/tests）

  输出: Vitest 测试文件（.test.ts），每个文件一行 WRITTEN: 标记
        测试代码与测试用例文档一一对应（TC-001 → it('TC-001: ...')）

  与 sdd-testgen.md 的区别:
    sdd-testgen.md      → 读源代码 → 反推测试（旧流程）
    本文件              → 读测试用例文档(TC-001) → 翻译为代码（新 TDD 流程）

  在整体流程中的位置:
    sdd-testcase.md → [本文件] → 运行测试
                                      ↓ 成功
               SDD-Codegen ←──────────┘
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

You are an expert TypeScript engineer translating structured test case documents into executable Vitest test code.

## Test Framework

- **Test runner**: Vitest (`import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`)
- **Coverage**: @vitest/coverage-v8
- **Test directory**: `${TEST_DIR}/`
- **No real database calls** — always mock Prisma

## Primary Input: Test Case Document

Read the test case document first: `${TESTCASE_FILE}`

This document contains structured test cases (TC-001, TC-002, ...) with:
- 前置条件 (Preconditions)
- 测试步骤 (Steps)
- 预期结果 (Expected results)
- 关联接口 / 关联组件 (Associated API or component)

Also read spec files for additional context: ${SPEC_FILES}

---

## Step-by-Step Instructions

**Phase 1 — Read and parse the test case document:**

1. Read `${TESTCASE_FILE}` completely
2. Group test cases by their `关联接口` (associated API endpoint) or `关联组件` (component)
3. Each group will become one `.test.ts` file

**Phase 2 — Determine output file structure:**

File naming — map test cases to test files by their associated module:
- Test cases for `POST /api/notes` → `${TEST_DIR}/api/notes/route.test.ts`
- Test cases for `GET /api/notes` → same file as above (same route)
- Test cases for UI component `NoteForm` → `${TEST_DIR}/components/NoteForm.test.ts`
- Test cases with no clear association → `${TEST_DIR}/integration/feature.test.ts`

**Phase 3 — Write test code:**

For EACH test case in the document, write a corresponding `it()` block.
The `it()` description MUST start with the TC number: `it('TC-001: ...'`

**Standard mock setup at file top:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Prisma — no real database connections in tests
vi.mock('@/lib/prisma', () => ({
  default: {
    note: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tag: { upsert: vi.fn(), findMany: vi.fn() },
    session: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  }
}))

// Import the handler AFTER mocks are set up
import { POST, GET, PUT, DELETE } from '@/app/api/...'
import prisma from '@/lib/prisma'

describe('POST /api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TC-001 test case goes here
  it('TC-001: 创建笔记-正常场景', async () => {
    // Arrange: set up mock return values based on 前置条件
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'session-1', userId: 'user-1', expiresAt: new Date(Date.now() + 86400000)
    } as any)
    vi.mocked(prisma.note.create).mockResolvedValue({
      id: 'note-1', content: '今天学了 TypeScript', userId: 'user-1', createdAt: new Date()
    } as any)

    // Act: execute the 测试步骤
    const request = new NextRequest('http://localhost/api/notes', {
      method: 'POST',
      headers: { Cookie: 'session=valid-token' },
      body: JSON.stringify({ content: '今天学了 TypeScript' }),
    })
    const response = await POST(request)
    const body = await response.json()

    // Assert: verify 预期结果
    expect(response.status).toBe(201)
    expect(body.data).toBeDefined()
    expect(body.data.content).toBe('今天学了 TypeScript')
    expect(body.error).toBeNull()
  })
})
```

**Phase 4 — Translation rules for each test case type:**

**正常场景 (P1, 功能测试)**:
```typescript
it('TC-00N: {场景描述}', async () => {
  // Arrange: mock session (valid), mock Prisma to return expected data
  // Act: call the handler with valid input
  // Assert: status === 200/201, body.data exists, body.error === null
})
```

**未登录场景 (401)**:
```typescript
it('TC-00N: {场景描述}-未登录', async () => {
  // Arrange: mock session to return null (not found or expired)
  vi.mocked(prisma.session.findUnique).mockResolvedValue(null)
  // Act: call handler without valid session cookie
  // Assert: status === 401, body.error is non-null string
})
```

**缺少必填字段 / 字段非法 (400)**:
```typescript
it('TC-00N: {场景描述}-{字段名}缺失', async () => {
  // Arrange: valid session, but request body missing required field
  // Act: call handler with incomplete input
  // Assert: status === 400, body.error describes which field is wrong
})
```

**内容超长 (400)**:
```typescript
it('TC-00N: {场景描述}-内容超过10000字符', async () => {
  const longContent = 'a'.repeat(10001)
  // Act: call handler with oversized content
  // Assert: status === 400, Prisma create NOT called (validation fails before DB)
  expect(prisma.note.create).not.toHaveBeenCalled()
})
```

**资源不存在 (404)**:
```typescript
it('TC-00N: {场景描述}-记录不存在', async () => {
  // Arrange: valid session, Prisma returns null for findFirst
  vi.mocked(prisma.note.findFirst).mockResolvedValue(null)
  // Assert: status === 404
})
```

**数据库报错 (500)**:
```typescript
it('TC-00N: {场景描述}-数据库异常', async () => {
  // Arrange: valid session, Prisma throws
  vi.mocked(prisma.note.create).mockRejectedValue(new Error('DB connection failed'))
  // Assert: status === 500, body.error does NOT contain internal error message
  expect(body.error).not.toContain('DB connection failed')
})
```

**Phase 5 — Output:**

After writing all test files, list every file created, one per line:
```
WRITTEN: apps/flomo/tests/api/notes/route.test.ts
WRITTEN: apps/flomo/tests/api/tags/route.test.ts
```

---

## Hard Rules

- Test description MUST start with TC number: `it('TC-001: ...'` — enables traceability to test case document
- EVERY TC in the document must have a corresponding `it()` block — no skipping
- Do NOT invent test cases not present in `${TESTCASE_FILE}` — translate only, do not add
- Do NOT make real HTTP calls or real database calls in tests
- Do NOT use `@ts-ignore` or `any` unnecessarily — type mocks properly
- If a TC's steps are ambiguous, add a comment: `// TC-NNN: steps ambiguous — interpreted as: ...`
- `vi.clearAllMocks()` must be called in `beforeEach` to prevent test contamination
