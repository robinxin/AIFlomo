#!/usr/bin/env bash
# Mock script: destroy the preview pod for a feature branch.
# TODO: replace with real kubectl / API call.

set -euo pipefail

BRANCH="${1:?Usage: destroy-pod.sh <branch-name>}"
POD_NAME="preview-${BRANCH//\//-}"

echo "=== [MOCK] Destroy Pod ==="
echo "Branch : $BRANCH"
echo "Pod    : $POD_NAME"
echo ""
echo "[MOCK] kubectl delete deployment $POD_NAME --namespace=preview --ignore-not-found"
echo "[MOCK] Pod $POD_NAME destroyed successfully."
