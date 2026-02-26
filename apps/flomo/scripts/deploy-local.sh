#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npm run db:generate

if [ "${RUN_MIGRATE:-1}" = "1" ]; then
  echo "Running database migrations..."
  npm run db:migrate -- --name init
fi

echo "Building app..."
npm run build

if command -v pm2 >/dev/null 2>&1; then
  echo "Starting with pm2..."
  pm2 start npm --name flomo -- run start
  pm2 save
else
  echo "pm2 not found; running in foreground."
  npm run start
fi
