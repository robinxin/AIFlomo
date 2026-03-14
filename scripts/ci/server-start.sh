#!/usr/bin/env bash
# 启动后端开发服务器（前台运行，由调用方决定是否后台化）。换栈时只改此文件。
# Node/Fastify: pnpm --filter @aiflomo/server dev
# Python/FastAPI: uvicorn apps.server.main:app --reload
# Go:            go run ./apps/server/...
exec pnpm --filter @aiflomo/server dev
