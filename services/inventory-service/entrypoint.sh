#!/bin/sh
# entrypoint.sh — inventory-service
# Aplica migraciones pendientes antes de iniciar el servidor.
set -e

echo "[entrypoint] Aplicando migraciones..."
npm run migrate:up:docker

echo "[entrypoint] Iniciando inventory-service..."
exec node src/index.js
