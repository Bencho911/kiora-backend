import os
import json
import logging
import redis.asyncio as redis
from datetime import datetime

logger = logging.getLogger(__name__)

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "rootpassword")
WHATSAPP_STREAM = "kiora:whatsapp:responses"
HISTORY_EXPIRATION = 86400  # 24 horas

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)


async def save_whatsapp_history(jid: str, role: str, content: str):
    """Guarda un mensaje en el historial de conversación del JID de WhatsApp."""
    try:
        key = f"kiora:whatsapp_history:{jid}"
        msg = json.dumps({"role": role, "content": content})
        await redis_client.rpush(key, msg)
        await redis_client.ltrim(key, -20, -1)   # Últimos 20 mensajes
        await redis_client.expire(key, HISTORY_EXPIRATION)
    except Exception as e:
        logger.error(f"[WhatsAppService] Error saving history: {e}")


async def get_whatsapp_history(jid: str) -> list:
    """Recupera el historial de conversación de un JID."""
    try:
        key = f"kiora:whatsapp_history:{jid}"
        messages_raw = await redis_client.lrange(key, 0, -1)
        return [json.loads(m) for m in messages_raw if m]
    except Exception as e:
        logger.error(f"[WhatsAppService] Error getting history: {e}")
        return []


async def send_whatsapp_response(jid: str, text: str):
    """
    Envía la respuesta de la IA al bot de WhatsApp publicando en el stream de Redis.
    El whatsapp-bot la consume y la despacha al número del usuario.
    """
    try:
        payload = {
            "jid": jid,
            "text": text,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        await redis_client.xadd(WHATSAPP_STREAM, {"payload": json.dumps(payload)})
        return True
    except Exception as e:
        logger.error(f"[WhatsAppService] Error sending response to Redis stream: {e}")
        return False
