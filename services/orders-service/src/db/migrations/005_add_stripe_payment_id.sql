-- Migration: 005_add_stripe_payment_id
-- Dominio: orders-service
-- Añade columna para almacenar el ID de pago de Stripe,
-- necesario para poder emitir reembolsos automáticos.

-- Up Migration
ALTER TABLE Ventas ADD COLUMN IF NOT EXISTS stripe_payment_id VARCHAR(100);

-- Down Migration
-- ALTER TABLE Ventas DROP COLUMN IF EXISTS stripe_payment_id;
