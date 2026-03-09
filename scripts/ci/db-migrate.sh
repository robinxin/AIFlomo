#!/usr/bin/env bash
# 执行数据库迁移（创建/更新表结构）。换栈时只改此文件。
# Drizzle:        npm run db:migrate -w apps/server
# Prisma:         npx prisma migrate deploy
# Alembic:        alembic upgrade head
# golang-migrate: migrate -path ./migrations -database $DATABASE_URL up
set -e

# 确保数据库目录存在（drizzle-kit 不会自动创建）
# 必须用绝对路径：npm workspace 会将 CWD 切换到 apps/server/，
# 若使用相对路径 "apps/server/data/..." 会被叠加解析为
# "apps/server/apps/server/data/..."，导致迁移写入错误位置
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export DB_PATH="${DB_PATH:-${REPO_ROOT}/apps/server/data/aiflomo.db}"
mkdir -p "$(dirname "$DB_PATH")"

npm run db:migrate -w apps/server 2>/dev/null || echo "Skipped: apps/server workspace not found"
