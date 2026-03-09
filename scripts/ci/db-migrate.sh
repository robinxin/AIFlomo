#!/usr/bin/env bash
# 执行数据库迁移（创建/更新表结构）。换栈时只改此文件。
# Drizzle:        npm run db:migrate -w apps/server
# Prisma:         npx prisma migrate deploy
# Alembic:        alembic upgrade head
# golang-migrate: migrate -path ./migrations -database $DATABASE_URL up
set -e

npm run db:migrate -w apps/server
