#!/usr/bin/env bash
# 生产构建。换栈时只改此文件。
# Node.js: pnpm build
# Python:  python -m build
# Go:      go build ./...
set -e

pnpm build
