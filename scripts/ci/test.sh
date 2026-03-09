#!/usr/bin/env bash
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
else
  echo "ℹ️ No test files in apps/tests/ — skipping"
fi
