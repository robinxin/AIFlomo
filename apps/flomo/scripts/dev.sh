#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
fi

npm install
npm run db:generate
npm run db:migrate -- --name init

npm run dev
