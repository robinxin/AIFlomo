#!/usr/bin/env bash
# 生成 schema 产物（非破坏性，不执行迁移）。换栈时只改此文件。
# Drizzle:  db:generate
# Prisma:   prisma generate
# SQLAlchemy / Alembic: alembic revision --autogenerate
set -e

pnpm db:generate -w apps/server 2>/dev/null || true
