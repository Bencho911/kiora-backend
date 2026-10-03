DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT fk_id_vent FROM factura WHERE factus_status = 'failed' LOOP
        INSERT INTO outbox_events (event_type, payload, status, retry_count, max_retries, next_retry_at, created_at)
        VALUES ('factus.invoice', ('{"orderId":' || r.fk_id_vent || '}')::jsonb, 'pending', 0, 5, now(), now());
        
        UPDATE factura SET factus_status = 'pending' WHERE fk_id_vent = r.fk_id_vent;
    END LOOP;
END;
$$;
