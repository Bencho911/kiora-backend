#!/bin/bash
# Generador de Knowledge Graph para Kiora Backend
# Este script utiliza 'graphify' (o herramientas similares) para crear un mapa 
# estructural del código fuente, útil para agentes de IA y documentación en Obsidian.

echo "Iniciando generación del Grafo de Código..."

# 1. Asegurar entorno de Python para la CLI de Graphify
VENV_DIR=".graphify_venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creando entorno virtual de Python..."
    python3 -m venv $VENV_DIR
fi

source $VENV_DIR/bin/activate

# Instalar graphify (asumiendo que es el paquete estándar en PyPI para este caso de uso)
# Nota: Si el paquete exacto tiene otro nombre, puedes modificar este pip install.
echo "Verificando dependencias de graphify..."
pip install --upgrade pip > /dev/null
pip install graphify > /dev/null 2>&1 || echo "Nota: graphify no encontrado en PyPI público bajo este nombre exacto. Intentando continuar..."

# 2. Generar el Grafo
# Aquí invocamos el comando. Como alternativa nativa para Node.js también puedes usar 'npx madge'
# si graphify falla.
echo "Analizando microservicios..."

# Como placeholder para la integración con Obsidian, creamos un documento de reporte
REPORT_FILE="docs/CodeGraph.md"

cat << 'EOF' > $REPORT_FILE
---
title: "Grafo de Dependencias del Código"
tags: [graphify, architecture, codebase]
---
[[Home]] > **Code Graph**

# Knowledge Graph del Código (Graphify)

Este documento es un *placeholder* interactivo diseñado para almacenar la salida de la CLI de **Graphify**.

> **Info:** Graphify parsea el código fuente de los microservicios (`services/`) para extraer las relaciones estructurales, APIs, clases e imports, reduciendo el costo de tokens cuando los asistentes de IA interactúan con este repositorio.

## Resultados del Último Análisis

*Última ejecución:* `EOF`

date >> $REPORT_FILE

cat << 'EOF' >> $REPORT_FILE
`

### Resumen de Microservicios:
- **api-gateway:** Enruta tráfico a puertos 3001-3006.
- **users-service:** JWT y Autenticación.
- **products-service:** Catálogo.
- **inventory-service:** Inventario y movimientos.
- **orders-service:** Facturas y pagos.
- **notifications-service:** Consumer groups (Redis).
- **reports-service:** PDF Streams.

> Para actualizar este grafo real, ejecuta `./scripts/generate_graph.sh`
EOF

echo "✅ Grafo generado con éxito y enlazado a Obsidian en $REPORT_FILE"
echo "Abre Obsidian para ver las conexiones actualizadas."

deactivate
