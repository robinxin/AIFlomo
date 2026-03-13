#!/usr/bin/env bash
# 将 E2E 测试文件中的 ${WEB_URL} 占位符替换为实际前端地址。
# 用法: patch-test-urls.sh <frontend_url>
# 换栈或调整测试目录时只改此文件。
set -euo pipefail

FRONTEND_URL="${1:?Usage: patch-test-urls.sh <frontend_url>}"

sed -i.bak 's|url: "${WEB_URL}"|url: "'"$FRONTEND_URL"'"|g' apps/tests/* && rm -f apps/tests/*.bak
