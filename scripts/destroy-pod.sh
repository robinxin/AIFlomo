#!/usr/bin/env bash
# Destroy the deploy environment for a feature/bugfix branch via SSH.

set -euo pipefail

BRANCH="${1:?Usage: destroy-pod.sh <branch-name>}"

: "${SSH_HOST:?SSH_HOST is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is required}"
: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${SYSTEMD_SERVICE:?SYSTEMD_SERVICE is required}"

SSH_PORT="${SSH_PORT:-22}"

echo "=== Destroy deploy environment ==="
echo "Branch  : $BRANCH"
echo "Host    : $SSH_HOST"
echo "Path    : $DEPLOY_PATH"
echo "Service : $SYSTEMD_SERVICE"
echo ""

# Write private key
mkdir -p ~/.ssh
echo "$SSH_PRIVATE_KEY" > ~/.ssh/destroy_key
chmod 600 ~/.ssh/destroy_key
ssh-keyscan -p "$SSH_PORT" "$SSH_HOST" >> ~/.ssh/known_hosts 2>/dev/null || true

# Execute on ECS
ssh -i ~/.ssh/destroy_key \
    -p "$SSH_PORT" \
    -o StrictHostKeyChecking=no \
    "$SSH_USER@$SSH_HOST" bash << ENDSSH
set -e

echo "── Stop service ──────────────────────────────────"
sudo systemctl stop "$SYSTEMD_SERVICE" || true
sudo systemctl disable "$SYSTEMD_SERVICE" || true

echo "── Remove deploy directory ───────────────────────"
sudo rm -rf "$DEPLOY_PATH"

echo "✅ Environment destroyed: $BRANCH"
ENDSSH

# Cleanup key
rm -f ~/.ssh/destroy_key
