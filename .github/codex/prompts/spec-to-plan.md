You are Codex running in CI. Read the active specs under specs/active/.

Goal: generate a concise implementation plan and test checklist without editing code.

Output format (Markdown):
1. Summary (what the spec asks for)
2. Scope assumptions (explicit assumptions or ambiguities)
3. Plan (ordered steps, files likely to change)
4. Tests (what to add or update)
5. Risks (edge cases or missing info)

Constraints:
- Do not propose changes outside apps/flomo unless the spec demands it.
- Keep it under 250 lines.
- If the spec is unclear, list concrete questions.
