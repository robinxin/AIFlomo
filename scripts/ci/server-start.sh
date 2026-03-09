#!/usr/bin/env bash
# 启动后端开发服务器（前台运行，由调用方决定是否后台化）。换栈时只改此文件。
# Node/Fastify: npm run dev -w apps/server
# Python/FastAPI: uvicorn apps.server.main:app --reload
# Go:            go run ./apps/server/...
exec npm run dev -w apps/server
