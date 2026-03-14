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
echo "🔧 Rebuilding better-sqlite3 native bindings..."
pnpm --filter @aiflomo/server rebuild better-sqlite3

# 验证绑定文件是否存在；若 pnpm rebuild 未能生成则直接用 node-gyp 编译
if ! find "./node_modules/.pnpm" -name "better_sqlite3.node" -type f 2>/dev/null | grep -q .; then
  echo "⚠️  pnpm rebuild 未能创建绑定文件，尝试直接 node-gyp 编译..."
  BSQ_DIR=$(find ./node_modules/.pnpm -maxdepth 5 -type d -name "better-sqlite3" 2>/dev/null \
    | grep "node_modules/better-sqlite3$" | head -1)
  if [ -n "$BSQ_DIR" ]; then
    (cd "$BSQ_DIR" && npx --yes node-gyp rebuild 2>&1)
  else
    echo "❌ 无法找到 better-sqlite3 目录，请检查依赖安装"
    exit 1
  fi
fi
echo "✅ better-sqlite3 native bindings ready"
