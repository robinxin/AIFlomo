#!/usr/bin/env bash
# 清空数据库（幂等）。换栈时只改此文件。
# SQLite: 删除 .db 文件
# PostgreSQL: psql -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# MongoDB:    mongosh --eval "db.dropDatabase()"
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# 如果 apps/server 不存在，跳过
if [ ! -d "${REPO_ROOT}/apps/server" ]; then
  echo "⚠️  apps/server 不存在，跳过 db-reset"
  exit 0
fi

# 如果 package.json 未定义 db:reset 脚本，跳过
if ! grep -q '"db:reset"' "${REPO_ROOT}/apps/server/package.json" 2>/dev/null; then
  echo "⚠️  apps/server 未定义 db:reset 脚本，跳过"
  exit 0
fi

# 确保数据库目录存在，再执行清空
# 使用绝对路径，防止 npm workspace CWD 切换后路径叠加
export DB_PATH="${DB_PATH:-${REPO_ROOT}/apps/server/data/aiflomo.db}"
mkdir -p "$(dirname "$DB_PATH")"

pnpm --filter @aiflomo/server db:reset
