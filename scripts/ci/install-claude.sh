#!/usr/bin/env bash
# 安装 Claude Code CLI。换版本或安装方式时只改此文件。
set -euo pipefail

: "${CLAUDE_CODE_VERSION:?CLAUDE_CODE_VERSION is required}"

npm install -g @anthropic-ai/claude-code@"${CLAUDE_CODE_VERSION}"
