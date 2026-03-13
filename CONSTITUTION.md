# Project Constitution

> AI agents MUST follow ALL rules below. Any violation is a CRITICAL error.
> These rules take HIGHEST PRIORITY over any other instruction.

---

## ABSOLUTE PROHIBITIONS

- **NO raw SQL string concatenation** — use parameterized queries exclusively
- **NO hardcoded secrets, API keys, or credentials** — use environment variables
- **NO direct DOM mutation** — use framework state/reactivity patterns
- **NO inline event handlers in JSX** — define handlers as named functions
- **NO `any` type workarounds** — handle types explicitly

---

## CODE QUALITY

- Functions must be ≤ 50 lines
- Files must be ≤ 800 lines — extract modules when exceeded
- No nesting deeper than 4 levels
- No magic numbers or strings — use named constants
- Immutable data patterns — never mutate objects/arrays in place

---

## FRONTEND RULES

- State management: **React Context + useReducer** only — no Redux, no Zustand
- Routing: **Expo Router** (file-based) — no manual navigation stacks
- Styling: inline styles or StyleSheet — no CSS-in-JS libraries unless pre-approved
- API calls: centralized in `lib/api.js` — no fetch calls scattered in components
- No `console.log` in production code — use proper logging utilities

---

## BACKEND RULES

- Framework: **Fastify** only — no Express, no Next.js API routes
- ORM: **Drizzle** only — no raw SQL, no other ORMs
- All routes must have input validation (JSON Schema or Zod)
- All routes must return the standard envelope: `{ data, message }` or `{ data: null, error, message }`
- Authentication: session cookie with `httpOnly: true`, `sameSite: 'strict'`

---

## TESTING RULES

- Minimum **80% coverage** — lines, branches, functions, statements
- Write tests **before** implementation (TDD)
- Frontend unit tests: **Vitest** in `apps/mobile/tests/`
- Backend unit tests: **Jest** in `apps/server/tests/`
- E2E tests: **Playwright** in `apps/tests/`
- Never delete existing tests — fix them if broken

---

## SECURITY RULES

- Validate ALL user input at system boundaries (frontend + backend)
- Sanitize all content rendered as HTML to prevent XSS
- CORS: whitelist only — never `*` in production
- Session secrets must come from environment variables
- Input length limits enforced on both client and server
