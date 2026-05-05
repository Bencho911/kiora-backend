-- Migration: 003_add_outbox_events
-- Dominio: orders-service
-- Outbox Pattern: tabla de eventos para persistir Saga events
-- con soporte de reintentos inteligentes y DLQ.

-- Up Migration
CREATE TABLE IF NOT EXISTS outbox_events (
    id            SERIAL PRIMARY KEY,
    event_type    VARCHAR(50) NOT NULL,
    payload       JSONB NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count   INT NOT NULL DEFAULT 0,
    max_retries   INT NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ
);

-- Partial index: solo events pendientes listos para procesar
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_events(next_retry_at)
    WHERE status = 'pending';

-- Down Migration
-- DROP INDEX IF EXISTS idx_outbox_pending;
-- DROP TABLE IF EXISTS outbox_events;
