#!/bin/sh
# entrypoint.sh — products-service
# Aplica migraciones pendientes antes de iniciar el servidor.
set -e

echo "[entrypoint] Aplicando migraciones..."
npm run migrate:up:docker

echo "[entrypoint] Iniciando products-service..."
exec node src/index.js
