#!/usr/bin/env bash
# 安装项目依赖。换栈时只改此文件（如 pip install、go mod download 等）。
set -e

if [ ! -f "package.json" ]; then
  echo "❌ No package.json found — project files may not have been generated yet."
  exit 1
fi

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  npm install
else
  echo "⏭ node_modules up to date, skipping install"
fi
