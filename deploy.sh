#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building Docker image..."
docker compose build app

echo "==> Running migrations..."
docker compose -f docker-compose.yml -f docker-compose.migrate.yml run --rm migrate

echo "==> Restarting app (zero-downtime)..."
docker compose up -d --no-deps app

echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Deploy complete"
