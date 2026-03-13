#!/usr/bin/env bash
# 检测两个 commit 之间前端源码是否有变更。
# 用法: frontend-changed.sh <before_sha> <after_sha>
# 退出码: 0=有变更  1=无变更
# 换栈或调整前端目录时只改此文件。
set -euo pipefail

BEFORE="${1:?Usage: frontend-changed.sh <before_sha> <after_sha>}"
AFTER="${2:?Usage: frontend-changed.sh <before_sha> <after_sha>}"

git diff "$BEFORE" "$AFTER" -- apps/mobile/ | grep -q .
