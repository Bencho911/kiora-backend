'use strict';

const ACTIVITY_URL = process.env.ACTIVITY_SERVICE_URL || 'http://activity-service:3007';

function logActivity({ user_email, user_name, action, entity_type, entity_id, details }) {
  fetch(`${ACTIVITY_URL}/api/activity-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email, user_name, action, entity_type, entity_id, details }),
  }).catch(() => {});
}

module.exports = logActivity;
