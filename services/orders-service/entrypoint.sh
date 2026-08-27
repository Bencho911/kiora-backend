#!/bin/sh
# entrypoint.sh — orders-service
# Aplica migraciones pendientes antes de iniciar el servidor.
set -e

echo "[entrypoint] Aplicando migraciones..."
npm run migrate:up:docker

# Ejecutar la aplicación
echo "Iniciando orders-service..."
exec npm start
