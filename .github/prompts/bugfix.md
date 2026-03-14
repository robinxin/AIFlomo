/tdd 修复以下 Bug

---

## Bug 报告

**Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}**

${ISSUE_BODY}

${EXTRA_PROMPT}

---

## 测试文件位置

| BUG_TYPE | 路径 | 格式 |
|----------|------|------|
| `backend` | `apps/tests/verify-bug-${ISSUE_NUMBER}.sh` | curl 脚本，`exit 0` = 正常，非 0 = Bug 仍存在 |
| `frontend` | `apps/tests/bug-${ISSUE_NUMBER}.yaml` | Midscene YAML，断言修复后的正确行为 |

## 约束

- ❌ 不改已有测试文件（新增复现测试除外）
- ❌ 不引入新依赖（除非缺失本身是根因，需在 RISK 说明）
- ❌ 不执行数据库迁移（除非 Issue 明确指向迁移）
- ❌ 不改 schema 文件（除非 Issue 明确指向 schema）
- ❌ 不留 `console.log`

## 完成后输出摘要

```
BRANCH_SLUG: <英文短语，小写字母+连字符，≤40字符，例如：memo-save-500-error>
ROOT_CAUSE: <一句话，具体到文件和行>
FIXED: <文件路径> — <改动内容>
BUG_TYPE: <backend | frontend>
TEST_CASE: <测试文件路径> — <覆盖场景>
RISK: <可能影响的其他功能，无则写"无已知风险">
SIMILAR_ISSUES: <相似隐患，无则写"未发现类似隐患">
```