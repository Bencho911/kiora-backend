const ACTIVITY_URL = process.env.ACTIVITY_SERVICE_URL || 'http://activity-service:3007';

interface ActivityLogPayload {
  user_email: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
}

export function logActivity({ user_email, user_name, action, entity_type, entity_id, details }: ActivityLogPayload) {
  fetch(`${ACTIVITY_URL}/api/activity-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email, user_name, action, entity_type, entity_id, details }),
  }).catch(() => {});
}
