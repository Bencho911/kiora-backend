-- Migration: 007_drop_unique_token_from_reset_tokens
-- Para OTP (códigos numéricos) no se debe imponer UNIQUE global a `reset_tokens.token`.
-- Esto evita colisiones cuando el mismo código se repite entre usuarios o en el tiempo.

ALTER TABLE reset_tokens
    DROP CONSTRAINT IF EXISTS reset_tokens_token_key;

-- (Opcional) aseguramos un índice para lookups rápidos por email+token
-- sin forzar unicidad.
CREATE INDEX IF NOT EXISTS ix_reset_tokens_id_usu_usado_expira
ON reset_tokens (id_usu, usado, expira_en);

