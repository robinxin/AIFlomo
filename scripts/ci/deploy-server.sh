#!/usr/bin/env bash
# 构建并以 pm2 部署后端服务（生产环境）。换栈时只改此文件。
# Node.js/pm2:  npm run build + pm2 start/restart
# Python/gunicorn: gunicorn main:app ...
# Go:           go build + systemctl restart
set -e

npm run build -w apps/server

if pm2 describe aiflomo-server >/dev/null 2>&1; then
  pm2 restart aiflomo-server
else
  pm2 start npm --name aiflomo-server -- run prod -w apps/server
fi
