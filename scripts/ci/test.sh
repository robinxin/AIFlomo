#!/usr/bin/env bash
# 运行测试用例。换栈时只改此文件。
# Node.js / Midscene: npm run test
# Python:             pytest
# Go:                 go test ./...
set -e

if find apps/tests/ -name "*.yaml" -print -quit 2>/dev/null | grep -q .; then
  WEB_URL=http://localhost:8082 npm run test
else
  echo "ℹ️ No test files in apps/tests/ — skipping"
fi
