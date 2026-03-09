#!/usr/bin/env bash
# 输出后端服务健康检查 URL。换栈时只改此文件（端口或路径发生变化时）。
PORT="${PORT:-3000}"
echo "http://localhost:${PORT}"
