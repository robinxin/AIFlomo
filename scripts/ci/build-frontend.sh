#!/usr/bin/env bash
# 仅构建前端（apps/mobile）静态产物。换栈时只改此文件。
set -euo pipefail

pnpm --filter @aiflomo/mobile build
