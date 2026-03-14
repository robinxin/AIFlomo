#!/usr/bin/env bash
# 安装项目依赖。换栈时只改此文件（如 pip install、go mod download 等）。
set -e

if [ ! -f "package.json" ]; then
  echo "❌ No package.json found — project files may not have been generated yet."
  exit 1
fi

if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules ]; then
  npm install -g pnpm
  pnpm install
else
  echo "⏭ node_modules up to date, skipping install"
fi

# 重建 better-sqlite3 原生绑定，确保在当前环境（尤其是 CI）下可用
pnpm rebuild better-sqlite3
