#!/usr/bin/env bash
# 托管前端静态产物（CI 用）。换栈时只改此文件。
# 若静态产物目录不存在（纯后端项目），直接退出 0，不阻塞 CI。
# Expo web:  pnpm dlx serve apps/mobile/dist -l 8082
# Next.js:   pnpm dlx serve apps/mobile/.next -l 8082
# Vite:      pnpm dlx serve apps/mobile/dist -l 8082
set -e

DIST_DIR="apps/mobile/dist"
PORT=8082

if [ ! -d "$DIST_DIR" ]; then
  echo "ℹ️ 静态产物目录不存在: $DIST_DIR，跳过前端托管（无前端项目）"
  exit 0
fi

exec pnpm dlx serve@14 "$DIST_DIR" -l "$PORT" --no-clipboard
