#!/usr/bin/env bash
# 托管前端静态产物（CI 用）。换栈时只改此文件。
# 前提：build 步骤已执行，静态产物在 apps/mobile/dist/
# Expo web:  pnpm dlx serve apps/mobile/dist -l 8082
# Next.js:   pnpm dlx serve apps/mobile/.next -l 8082
# Vite:      pnpm dlx serve apps/mobile/dist -l 8082
set -e

DIST_DIR="apps/mobile/dist"
PORT=8082

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ 静态产物目录不存在: $DIST_DIR，请先执行 build 步骤"
  exit 1
fi

exec pnpm dlx serve@14 "$DIST_DIR" -l "$PORT" --no-clipboard
