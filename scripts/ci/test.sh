#!/usr/bin/env bash
<<<<<<< HEAD
set -e

# 查找测试文件
TEST_FILES=$(find apps/tests/ -name "*.yaml" 2>/dev/null)

if [ -n "$TEST_FILES" ]; then
  echo "🔍 Found the following test files to be executed:"
  
  # 遍历并打印每个文件的内容，增加分割线以便在日志中识别
  for file in $TEST_FILES; do
    echo "------------------------------------------"
    echo "📄 File: $file"
    echo "------------------------------------------"
    cat "$file"
    echo -e "\n"
  done

  echo "🚀 Starting npm run test..."
  WEB_URL=http://localhost:8082 npm run test
=======
# 运行测试用例。换栈时只改此文件。
# Node.js / Playwright: pnpm test
# Python:               pytest
# Go:                   go test ./...
set -e

if find apps/tests/ -name "*.spec.js" -print -quit 2>/dev/null | grep -q .; then
  pnpm test
>>>>>>> main
else
  echo "ℹ️ No test files in apps/tests/ — skipping"
fi
