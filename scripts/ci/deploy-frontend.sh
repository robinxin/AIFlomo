#!/usr/bin/env bash
# 构建并以 pm2 部署前端服务（生产环境）。换栈时只改此文件。
# Expo/pm2:     EXPO_USE_METRO_WORKSPACE_ROOT=1 npm run build + pm2 start/restart
# Next.js/pm2:  npm run build + pm2 start
# 纯静态:       npm run build，再 rsync 到 Nginx 目录
set -e

EXPO_USE_METRO_WORKSPACE_ROOT=1 npm run build -w apps/mobile

if pm2 describe aiflomo-mobile >/dev/null 2>&1; then
  pm2 restart aiflomo-mobile
else
  pm2 start npm --name aiflomo-mobile -- run prod -w apps/mobile
fi
pm2 save
pm2 list
