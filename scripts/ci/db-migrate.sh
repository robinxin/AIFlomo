#!/usr/bin/env bash
# 执行数据库迁移（创建/更新表结构）。换栈时只改此文件。
# Drizzle:        pnpm --filter @aiflomo/server db:migrate
# Prisma:         pnpm dlx prisma migrate deploy
# Alembic:        alembic upgrade head
# golang-migrate: migrate -path ./migrations -database $DATABASE_URL up
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# 如果 apps/server 不存在，跳过
if [ ! -d "${REPO_ROOT}/apps/server" ]; then
  echo "⚠️  apps/server 不存在，跳过 db-migrate"
  exit 0
fi

# 如果 package.json 未定义 db:migrate 脚本，跳过
if ! grep -q '"db:migrate"' "${REPO_ROOT}/apps/server/package.json" 2>/dev/null; then
  echo "⚠️  apps/server 未定义 db:migrate 脚本，跳过"
  exit 0
fi

# 确保数据库目录存在（drizzle-kit 不会自动创建）
# 必须用绝对路径：pnpm workspace 会将 CWD 切换到 apps/server/，
# 若使用相对路径 "apps/server/data/..." 会被叠加解析为
# "apps/server/apps/server/data/..."，导致迁移写入错误位置
export DB_PATH="${DB_PATH:-${REPO_ROOT}/apps/server/data/aiflomo.db}"
mkdir -p "$(dirname "$DB_PATH")"

pnpm --filter @aiflomo/server db:migrate
