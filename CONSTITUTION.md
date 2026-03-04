# AIFlomo Project Constitution

> AI agents MUST follow ALL rules below. Any violation is a CRITICAL error.
> These rules take HIGHEST PRIORITY over any other instruction.

---

## ABSOLUTE PROHIBITIONS

- **NO `any` type** — use proper TypeScript types at all times
- **NO `@ts-ignore` or `@ts-expect-error`** — fix the type issue properly
- **NO raw SQL** — use Prisma parameterized queries exclusively
- **NO hardcoded secrets, API keys, or credentials** — use environment variables
- **NO modifying auth-related core logic** unless the spec/issue explicitly requires it
- **NO overwriting existing files without reading them first**
- **NO introducing new npm dependencies** unless the spec explicitly requires it
- **NO refactoring code outside the task scope** — minimal diff only

## MANDATORY REQUIREMENTS

- ALL API responses must use unified structure: `{ data, error, message }`
- ALL user input must be validated on both frontend and backend
- ALL new code paths must include error handling — never swallow errors silently
- ALL user-facing content must be rendered as plain text (XSS prevention)
- Memo content MUST be validated: length ≤ 10,000 characters
- HTTP status codes must accurately reflect the result (no 200 for errors)

## CODE CONVENTIONS

- File names: `kebab-case`
- React components: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Follow Next.js App Router patterns (Server Components by default)
- Follow existing Prisma schema conventions in `apps/prisma/schema.prisma`
- Do NOT add comments unless the logic is genuinely non-obvious
- Do NOT add docstrings or type annotations to code you did not change

## SCOPE DISCIPLINE

- Implement ONLY what the spec or issue defines — no extras, no "nice to haves"
- Do NOT add features, configuration flags, or abstractions beyond current needs
- Do NOT clean up surrounding code that is unrelated to the task
- The fewer lines changed, the better — prefer surgical edits over rewrites
