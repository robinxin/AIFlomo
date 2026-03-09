#!/usr/bin/env bash
# 代码风格检测。换栈时只改此文件。
# Node.js: npm run lint
# Python:  flake8 . 或 ruff check .
# Go:      golangci-lint run
set -e

npm run lint
