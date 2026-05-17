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
