#!/usr/bin/env bash
# 运行测试用例。换栈时只改此文件。
# Node.js / Playwright: pnpm test
# Python:               pytest
# Go:                   go test ./...
set -e

if find apps/tests/ -name "*.spec.js" -print -quit 2>/dev/null | grep -q .; then
  pnpm test
else
  echo "ℹ️ No test files in apps/tests/ — skipping"
fi
