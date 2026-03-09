#!/usr/bin/env bash
# 运行测试用例。换栈时只改此文件。
# Node.js / Midscene: npm run test
# Python:             pytest
# Go:                 go test ./...
set -e

TEST_FILE="${1:-}"

if [ -n "$TEST_FILE" ]; then
  # 运行指定单个测试文件（如 bug 验证）
  # 换栈时只改此处：pytest $TEST_FILE / go test $TEST_FILE
  npx midscene "$TEST_FILE"
else
  # 运行全部测试用例
  if find apps/tests/ -name "*.yaml" -print -quit 2>/dev/null | grep -q .; then
    npm run test
  else
    echo "ℹ️ No test files in apps/tests/ — skipping"
  fi
fi
