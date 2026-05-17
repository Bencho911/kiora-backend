#!/bin/bash
# Script para instalar dependencias y ejecutar las migraciones de todos los servicios

echo "🚀 Iniciando migraciones de bases de datos..."

SERVICES=("users-service" "products-service" "inventory-service" "orders-service" "notifications-service")

for service in "${SERVICES[@]}"; do
    echo "====================================================="
    echo "📦 Procesando: $service"
    echo "====================================================="
    
    cd "services/$service" || exit
    
    echo "🔧 1. Instalando dependencias (necesario para node-pg-migrate)..."
    npm install --silent
    
    echo "🔄 2. Ejecutando migraciones hacia Docker..."
    npm run migrate:up:docker
    
    cd ../..
done

echo "✅ Todas las migraciones han sido completadas."
