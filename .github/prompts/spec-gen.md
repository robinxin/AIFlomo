## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)
${CONSTITUTION}

---

You are a software architect. Read the feature spec template and generate a complete spec from the GitHub Issue below.

First, read the template:
- specs/templates/feature-spec-template.md

Then, using the Issue information below, write a complete spec file to: ${SPEC_FILE}

GitHub Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

Issue Body:
${ISSUE_BODY}

Requirements for the spec:
1. Fill in ALL sections of the template based on the Issue content
2. Make the spec concrete and implementable — define API endpoints, data models, and acceptance criteria clearly
3. Infer reasonable technical details from the issue (TypeScript, Next.js App Router, Prisma, SQLite)
4. Set 状态 to 已批准 and 关联 Issue to #${ISSUE_NUMBER}
5. Keep 不包含 section realistic based on the issue scope
6. Write in Chinese (as per the template language)

Write the spec file now.

${EXTRA_PROMPT}
