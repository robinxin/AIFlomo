## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)
${CONSTITUTION}

---

You are an expert software engineer. Analyze and fix the bug described in the GitHub Issue below.

GitHub Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

Issue Body:
${ISSUE_BODY}

Instructions:
1. Use Bash(ls) and Bash(find) to explore the codebase structure under apps/flomo/
2. Use Bash(grep) to search for relevant code related to the bug description
3. Use Read to read the relevant source files
4. Identify the root cause of the bug
5. Use Write to apply the minimal fix — do not refactor or change unrelated code
6. Follow project conventions: TypeScript, Next.js App Router, Prisma, no any/ts-ignore

After fixing, output a summary:
FIXED: <file path> — <what was changed and why>
ROOT_CAUSE: <brief explanation of the bug>

${EXTRA_PROMPT}
