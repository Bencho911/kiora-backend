#!/bin/sh
# entrypoint.sh — stores-service
# Aplica migraciones pendientes antes de iniciar el servidor.
set -e

echo "[entrypoint] Aplicando migraciones..."
npm run migrate:up:docker

echo "[entrypoint] Iniciando stores-service..."
exec node dist/index.js
