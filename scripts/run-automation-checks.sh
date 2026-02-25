#!/usr/bin/env bash
set -euo pipefail

REPO="robinxin/AIFlomo"
GH_BIN="/usr/local/Cellar/gh/2.87.3/bin/gh"

if ! command -v "$GH_BIN" >/dev/null 2>&1; then
  echo "GitHub CLI not found at $GH_BIN. Update GH_BIN path." >&2
  exit 1
fi

if ! "$GH_BIN" auth status >/dev/null 2>&1; then
  echo "GitHub CLI not authenticated. Run: $GH_BIN auth login -h github.com -p https" >&2
  exit 1
fi

echo "Triggering Spec AI Plan (Codex)..."
"$GH_BIN" workflow run "Spec AI Plan (Codex)" -R "$REPO" || true

echo "Triggering Auto Create PR..."
"$GH_BIN" workflow run "Auto Create PR" -R "$REPO" || true

echo
 echo "Recent workflow runs:"
"$GH_BIN" run list -R "$REPO" -L 10

echo
 echo "Note: Quality/Security gates are triggered by push/PR events."
