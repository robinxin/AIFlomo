#!/usr/bin/env bash
# 清空数据库（幂等）。换栈时只改此文件。
# SQLite: 删除 .db 文件
# PostgreSQL: psql -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# MongoDB:    mongosh --eval "db.dropDatabase()"
set -e

# 确保数据库目录存在，再执行清空
# 使用绝对路径，防止 npm workspace CWD 切换后路径叠加
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export DB_PATH="${DB_PATH:-${REPO_ROOT}/apps/server/data/aiflomo.db}"
mkdir -p "$(dirname "$DB_PATH")"

npm run db:reset -w apps/server
