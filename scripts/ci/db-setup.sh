#!/usr/bin/env bash
# 生成 schema 产物（非破坏性，不执行迁移）。换栈时只改此文件。
# Drizzle:  db:generate
# Prisma:   prisma generate
# SQLAlchemy / Alembic: alembic revision --autogenerate
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# 如果 apps/server 不存在，跳过
if [ ! -d "${REPO_ROOT}/apps/server" ]; then
  echo "⚠️  apps/server 不存在，跳过 db-setup"
  exit 0
fi

# 如果 package.json 未定义 db:generate 脚本，跳过
if ! grep -q '"db:generate"' "${REPO_ROOT}/apps/server/package.json" 2>/dev/null; then
  echo "⚠️  apps/server 未定义 db:generate 脚本，跳过"
  exit 0
fi

pnpm --filter @aiflomo/server db:generate 2>/dev/null || true
