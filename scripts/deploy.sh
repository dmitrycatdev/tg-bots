#!/bin/bash
set -euo pipefail

COMPOSE_FILE="docker/docker-compose.prod.yml"
cd "$(dirname "$0")/.."

echo "=== TG-Bots: Deploy ==="

# --- Pull latest code ---
echo "[1/5] Pulling latest changes..."
git pull origin main

# --- Build containers ---
echo "[2/5] Building containers..."
docker compose -f "$COMPOSE_FILE" build

# --- Start database & redis first ---
echo "[3/5] Starting database and Redis..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis

echo "Waiting for database to be healthy..."
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 2
done
echo "Database is ready."

# --- Run migrations ---
echo "[4/5] Running database migrations..."
docker compose -f "$COMPOSE_FILE" run --rm api npx prisma migrate deploy

# --- Start all services ---
echo "[5/5] Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d

# --- Cleanup ---
docker image prune -f > /dev/null 2>&1

echo ""
echo "=== Deploy complete ==="
docker compose -f "$COMPOSE_FILE" ps
