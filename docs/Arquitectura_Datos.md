---
title: "Arquitectura de Datos"
tags: [bases-de-datos, arquitectura, mermaid, chartdb]
---
[[Home]] > **Arquitectura de Datos**

# Arquitectura de Datos y Bases de Datos (Kiora)

El backend utiliza una arquitectura policlóta / microservicios donde cada servicio tiene su propia base de datos física o lógica. Las "Claves Foráneas" (FK) entre dominios distintos son conceptuales y se resuelven a nivel de aplicación (HTTP), no a nivel de motor de base de datos.

A continuación se presentan los Diagramas Entidad-Relación generados a partir de los esquemas exportados de ChartDB.

---

##  Users Service (`kiora_users`)

Gestiona la autenticación, datos del cliente y tokens de recuperación.

```mermaid
erDiagram
    Cliente {
        int id_usu PK
        varchar nom_usu
        varchar correo_usu
        varchar password_usu
        varchar rol_usu
        varchar tel_usu
        int intentos_fallidos
        timestamp bloqueado_hasta
        boolean activo
        int session_version
    }

    reset_tokens {
        int id PK
        int id_usu FK
        varchar token
        timestamp expira_en
        boolean usado
        timestamp creado_en
    }

    ReporteFallo {
        int id_rep PK
        text descripcion
        varchar prioridad
        varchar estado
        int fk_id_usu FK
        int cod_prod
        timestamp fecha_rep
        text observaciones_tecnicas
        text titulo
    }

    Cliente ||--o{ reset_tokens : "genera"
    Cliente ||--o{ ReporteFallo : "reporta"
```

---

##  Products Service (`kiora_products`)

Catálogo de productos y categorías.

```mermaid
erDiagram
    Categoria {
        int cod_cat PK
        varchar nom_cat
        text descrip_cat
        boolean activo
    }

    Producto {
        int cod_prod PK
        varchar nom_prod
        text descrip_prod
        decimal precio_unitario
        date fechaven_prod
        int[] fk_cod_cats "Array de categorías"
        int stock_actual
        int stock_minimo
        varchar url_imagen
        boolean activo
    }

    Categoria ||--o{ Producto : "contiene (array)"
```

---

## Orders Service (`kiora_orders`)

Ventas, detalles de venta y facturación, con soporte para el patrón Outbox.

```mermaid
erDiagram
    Ventas {
        int id_vent PK
        timestamp fecha_vent
        decimal precio_prod_final
        decimal montofinal_vent
        varchar metodopago_usu
        varchar estado
    }

    Producto_Venta {
        int id PK
        int fk_id_vent FK
        int cod_prod "FK lógica a Products"
        varchar nom_prod
        int cantidad
        decimal precio_unit
    }

    Factura {
        int id PK
        int fk_id_vent FK
        int id_usu "FK lógica a Users"
        int cantidad_vent
        decimal precio_prod
        decimal montototal_vent
        timestamp emitida_en
    }

    outbox_events {
        int id PK
        varchar event_type
        jsonb payload
        varchar status
        int retry_count
        int max_retries
        timestamp next_retry_at
        text last_error
        timestamp created_at
        timestamp processed_at
    }

    Ventas ||--o{ Producto_Venta : "tiene"
    Ventas ||--|| Factura : "genera"
```

---

## Inventory Service (`kiora_inventory`)

Gestión de stock, proveedores y auditoría de movimientos.

```mermaid
erDiagram
    Proveedor {
        int cod_prov PK
        varchar id_prov
        varchar nom_prov
        varchar tel_prov
        varchar tipoid_prov
        varchar correo_prov
        varchar dir_prov
    }

    Suministra {
        int id PK
        int fk_cod_prov FK
        int cod_prod "FK lógica a Products"
        int stock
        int stock_minimo
    }

    Inventario {
        int id_mov PK
        varchar tipo_mov
        timestamp fecha_mov
        int cantidad
        int cod_prod "FK lógica a Products"
        int fk_cod_prov FK
        int fk_id_vent "FK lógica a Orders"
        varchar desc_mov
    }

    Proveedor ||--o{ Suministra : "ofrece"
    Proveedor ||--o{ Inventario : "abastece"
```
