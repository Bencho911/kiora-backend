-- Migration: 001_schema_inicial
-- Dominio: stores-service
-- Tablas del sistema multi-tienda: Tiendas y Mesas.
--
-- NOTA: Las FK cruzadas con otros dominios (orders, inventory)
-- no existen aquí — la consistencia se mantiene a nivel de aplicación
-- mediante el store_id que cada servicio registra en sus propias tablas.

-- Up Migration

CREATE TABLE IF NOT EXISTS Tienda (
    id_tienda       SERIAL PRIMARY KEY,
    nombre          VARCHAR(100)   NOT NULL,
    direccion       VARCHAR(255)   NOT NULL,
    telefono        VARCHAR(20),
    factus_prefix   VARCHAR(10)    NOT NULL DEFAULT 'K',  -- Prefijo para facturas (Ej: 'NOR', 'SUR')
    activa          BOOLEAN        NOT NULL DEFAULT TRUE,
    estado          VARCHAR(20)    NOT NULL DEFAULT 'CERRADO', -- 'ABIERTO' | 'CERRADO' | 'OFFLINE'
    latitud         DECIMAL(10, 8),  -- Para geolocalización futura (App Móvil)
    longitud        DECIMAL(11, 8),
    creado_en       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Mesa: cada tienda puede tener N mesas con su código QR único
CREATE TABLE IF NOT EXISTS Mesa (
    id_mesa         SERIAL PRIMARY KEY,
    fk_id_tienda    INT            NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    numero          INT            NOT NULL,                     -- Número visible de la mesa (1, 2, 3...)
    qr_code         VARCHAR(255)   NOT NULL UNIQUE,              -- Valor único del QR (Ej: 'tienda=1&mesa=5')
    activa          BOOLEAN        NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fk_id_tienda, numero)  -- No puede haber dos mesas con el mismo número en la misma tienda
);

-- Insertar la tienda por defecto (Sede Única actual del Kiosco)
-- Esto garantiza que el sistema actual siga funcionando con store_id = 1
INSERT INTO Tienda (id_tienda, nombre, direccion, factus_prefix, activa, estado)
VALUES (1, 'Sede Principal', 'Dirección por configurar', 'K', TRUE, 'ABIERTO')
ON CONFLICT (id_tienda) DO NOTHING;

SELECT setval('tienda_id_tienda_seq', (SELECT MAX(id_tienda) FROM Tienda));

-- Down Migration
-- DROP TABLE IF EXISTS Mesa;
-- DROP TABLE IF EXISTS Tienda;
