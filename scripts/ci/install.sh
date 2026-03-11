#!/usr/bin/env bash
# 安装项目依赖。换栈时只改此文件（如 pip install、go mod download 等）。
set -e

if [ ! -f "package.json" ]; then
  echo "❌ No package.json found — project files may not have been generated yet."
  exit 1
fi

# 若 runner 上没有 pnpm，通过 corepack 或 npm 安装
if ! command -v pnpm &> /dev/null; then
  echo "⚙️ pnpm not found, installing via npm..."
  npm install -g pnpm
fi

if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules ]; then
  pnpm install
else
  echo "⏭ node_modules up to date, skipping install"
fi
