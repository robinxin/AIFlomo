# Verification Command

Run comprehensive verification on current codebase state.

## Instructions

Execute verification in this exact order:

1. **Build Check**
   - Run the build command for this project
   - If it fails, report errors and STOP

2. **Type Check**
   - Run the type checker for this project (if applicable)
   - Report all errors with file:line

3. **Lint Check**
   - Run linter
   - Report warnings and errors

4. **Test Suite**
   - Run all tests
   - Report pass/fail count
   - Report coverage percentage

5. **Secrets Audit**
   - Search for hardcoded secrets, API keys, and passwords in source files
   - Report locations

6. **Console.log Audit**
   - Search for console.log in source files
   - Report locations

7. **Git Status**
   - Show uncommitted changes
   - Show files modified since last commit

## Output

Produce a concise verification report:

```
VERIFICATION: [PASS/FAIL]

Build:    [OK/FAIL]
Types:    [OK/X errors | N/A]
Lint:     [OK/X issues]
Tests:    [X/Y passed, Z% coverage]
Secrets:  [OK/X found]
Logs:     [OK/X console.logs]

Ready for PR: [YES/NO]
```

If any issues cannot be auto-fixed, list them with details.

## Auto-Fix

执行完所有检查后，对每个发现的问题自动调用对应 agent 修复：

- build 失败 → 调用 `build-error-resolver` agent
- 测试失败 → 调用 `tdd-guide` agent
- 安全漏洞或硬编码密钥 → 调用 `security-reviewer` agent
- lint 格式问题 → 直接运行项目的 lint auto-fix 命令
- console.log → 直接用 Edit 删除

每次修复后重新运行该项检查验证是否通过，最多重试 5 次，5 次仍失败则报告并继续下一项。最后输出修复报告。所有修复操作直接执行，不询问用户确认。
