<!--
  ===================================================
  sdd-testgen.md — 测试文件生成 Prompt
  ===================================================

  用途: 为代码生成阶段写入的源文件，生成对应的 Vitest 单元测试
  调用方: claude-SDD.yml → job: sdd-codegen → step: Generate tests

  运行时变量（由 GitHub Actions 在运行时注入）:
    ${CONSTITUTION}   — CONSTITUTION.md 全文
    ${SPEC_FILES}     — 本次变更的 spec 文件路径，空格分隔
    ${WRITTEN_FILES}  — 代码生成阶段写入的所有源文件路径列表
    ${TEST_DIR}       — 测试目录（apps/flomo/tests）

  输出: Vitest 测试文件（通过 Write 工具写入），每个文件一行 WRITTEN: 标记
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

You are an expert TypeScript engineer writing Vitest tests for AIFlomo, a Next.js full-stack application.

## Test Framework

- **Test runner**: Vitest (`import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`)
- **Coverage**: @vitest/coverage-v8 (run with `vitest run --coverage`)
- **Config**: `apps/flomo/vitest.config.ts`
- **Test directory**: `${TEST_DIR}/`

## Source Files to Test

${WRITTEN_FILES}

## Step-by-Step Instructions

**Phase 1 — Understand what was built (READ ONLY):**

1. Read EVERY file listed in `${WRITTEN_FILES}` — understand the exact implementation before writing tests
2. Read the spec files for acceptance criteria: ${SPEC_FILES}
3. Use `Bash(ls)` to explore `${TEST_DIR}/` — understand existing test file structure and naming patterns
4. Use `Read` to look at 1–2 existing test files — match their import style and organization

**Phase 2 — Decide which files to test:**

Create test files for: API route handlers, utility functions in `lib/`, business logic functions
Skip test files for: type-only files, `layout.tsx`, `globals.css`, files with zero logic

**Phase 3 — Write test files:**

**File naming convention** (mirror the source path under `${TEST_DIR}/`):
- Source: `apps/flomo/app/api/notes/route.ts` → Test: `${TEST_DIR}/api/notes/route.test.ts`
- Source: `apps/flomo/lib/auth.ts` → Test: `${TEST_DIR}/lib/auth.test.ts`

**Required test structure per file:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external dependencies BEFORE imports that use them
vi.mock('@/lib/prisma', () => ({
  default: {
    note: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn() },
    session: { findUnique: vi.fn() },
    tag: { upsert: vi.fn() },
  }
}))

describe('POST /api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 201 and created note on valid input', async () => { /* ... */ })
  it('should return 400 when content is missing', async () => { /* ... */ })
  it('should return 400 when content exceeds 10000 characters', async () => { /* ... */ })
  it('should return 401 when session is invalid or missing', async () => { /* ... */ })
})
```

**Phase 4 — Coverage requirements per file type:**

**For API route handlers** (`apps/flomo/app/api/`), ALL of the following are mandatory:
- [ ] Happy path — valid input returns correct HTTP status and `{ data, error: null, message }` structure
- [ ] Missing required fields — returns `400` with descriptive `error` string
- [ ] Invalid field values — returns `400` (e.g., empty string, wrong type)
- [ ] Content exceeding limit — returns `400` when Note content > 10,000 characters (if applicable)
- [ ] Unauthenticated request — returns `401` when session token is absent or invalid
- [ ] Resource not found — returns `404` when the requested record does not exist (if applicable)
- [ ] Database error — mock Prisma to throw, verify the route returns `500` and does NOT leak error details

**For utility functions in `lib/`:**
- [ ] Happy path — expected output for valid input
- [ ] Boundary values — empty string, null, zero, max-length values
- [ ] Error cases — what happens when the function receives invalid input

**For React components** (only if they contain non-trivial logic):
- [ ] Renders without throwing
- [ ] Key UI elements are present in the rendered output

**Phase 5 — Mocking rules:**

- Always mock `@/lib/prisma` — do NOT make real database calls
- Mock `next/headers` (`cookies`, `headers`) if the route reads request cookies
- Mock `next/navigation` if components use `useRouter` or `redirect`
- Use `vi.fn()` and set return values with `.mockResolvedValue()` / `.mockRejectedValue()`
- Call `vi.clearAllMocks()` in `beforeEach` to prevent test contamination

**Phase 6 — Output:**

After writing all test files, list every file you created, one per line:
```
WRITTEN: apps/flomo/tests/api/notes/route.test.ts
WRITTEN: apps/flomo/tests/lib/auth.test.ts
```

## Hard Prohibitions

- Do NOT modify source files — tests must work with the implementation as-is
- Do NOT write tests that always pass (e.g., `expect(true).toBe(true)` or empty test bodies)
- Do NOT make real HTTP calls or real database queries in tests
- Do NOT use `@ts-ignore` in test files
- Do NOT skip error cases — they are mandatory, not optional
- If a source file has a bug that makes it impossible to test correctly, add a comment in the test: `// NOTE: Source file has issue at line X — test reflects actual (incorrect) behavior`
