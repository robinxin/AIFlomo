#!/usr/bin/env bash
# 同时启动前后端（前台运行，由调用方决定是否后台化）。换栈时只改此文件。

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  set -a
  source <(grep -v '^#' .env | grep -v '^\s*$' | sed 's/#.*//' | sed 's/[[:space:]]*$//')
  set +a
fi

exec pnpm dev
