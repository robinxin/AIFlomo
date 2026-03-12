#!/usr/bin/env bash
# 生产构建。换栈时只改此文件。
# Node.js: npm run build --workspaces --if-present
# Python:  python -m build
# Go:      go build ./...
set -e

npm run build --workspaces --if-present
