'use strict';

const logger = require('../config/logger');

const ACTIVITY_URL = process.env.ACTIVITY_SERVICE_URL || 'http://activity-service:3007';

/**
 * Log de actividad fire & forget.
 * No lanza errores — si el activity-service falla, se ignora.
 */
function logActivity({ user_email, user_name, action, entity_type, entity_id, details }) {
  const body = { user_email, user_name, action, entity_type, entity_id, details };

  fetch(`${ACTIVITY_URL}/api/activity-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // Silencio — no debe afectar la operación principal
  });
}

module.exports = logActivity;
