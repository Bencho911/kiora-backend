import os
import json
import logging
import redis.asyncio as redis
from datetime import datetime

logger = logging.getLogger(__name__)

REDIS_HOST = os.getenv("REDIS_HOST", "kiora-redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_STREAM = os.getenv("REDIS_NOTIFICATIONS_STREAM", "kiora:notifications:stream")
HISTORY_EXPIRATION = 86400  # 24 hours

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

async def save_telegram_history(chat_id: str, role: str, content: str):
    try:
        key = f"kiora:telegram_history:{chat_id}"
        msg = json.dumps({"role": role, "content": content})
        await redis_client.rpush(key, msg)
        # Keep only the last 20 messages
        await redis_client.ltrim(key, -20, -1)
        await redis_client.expire(key, HISTORY_EXPIRATION)
    except Exception as e:
        logger.error(f"[TelegramService] Error saving history: {e}")

async def get_telegram_history(chat_id: str) -> list:
    try:
        key = f"kiora:telegram_history:{chat_id}"
        messages_raw = await redis_client.lrange(key, 0, -1)
        messages = []
        for msg in messages_raw:
            try:
                messages.append(json.loads(msg))
            except:
                pass
        return messages
    except Exception as e:
        logger.error(f"[TelegramService] Error getting history: {e}")
        return []

async def send_telegram_notification(subject: str, html: str, photo_base64: str = None):
    try:
        payload = {
            "subject": subject,
            "html": html,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        if photo_base64:
            payload["photo_base64"] = photo_base64
            
        await redis_client.xadd(
            "kiora:notifications:stream",
            {"payload": json.dumps(payload)}
        )
        return True
    except Exception as e:
        logger.error(f"[Telegram Notification] Error sending to Redis stream: {e}")
        return False
