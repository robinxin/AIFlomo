# AI Pipeline 说明与故障分析（2026-02-26）

## 背景
当前主流程在 `AI Pipeline (Spec -> SDD -> Quality -> Release PR)` 的 `sdd` 步骤失败。该文档用于说明失败原因与可行修复方向，便于后续调整工作流。

## 现象（错误摘要）
在 `sdd` 作业中出现以下错误：
- `Unsupported event type: push`
- `Unexpected input(s) 'anthropic-api-key', 'anthropic-api-base-url', 'model', 'claude-args' ...`

## 原因分析
### 1. Action 不支持 `push` 事件
`anthropics/claude-code-action@v1` 对触发事件有要求，当前在 `push` 事件上直接运行，触发报错 `Unsupported event type: push`。

### 2. Inputs 名称不匹配
该 Action 接受的参数命名为 **下划线格式**，例如：
- `anthropic_api_key`
- `claude_args`

当前 workflow 传入的是 **连字符格式**：
- `anthropic-api-key`
- `claude-args`

因此被判定为“未知输入”并报错。

## 当前状态
- `sdd` job 已迁移为 PR 触发（`pull_request`）。
- `sdd` job inputs 已调整为 action 支持的下划线格式。

## 修复说明（已执行）
- `sdd` job 仅在 `pull_request` / `workflow_dispatch` 事件触发。
- inputs 改为 action 支持的字段名（下划线格式）。
- `release-pr` job 在 PR 事件中跳过，避免重复建 PR。

## 触发最新 workflow 的方法
为了确保运行的是最新 workflow：
1. 确保修改已 push 到 `feat/lss`
2. 不要重跑旧 run（Re-run 会沿用旧 commit）
3. 用最新 commit 触发（手动 Run workflow 或提交一个微小变更）
