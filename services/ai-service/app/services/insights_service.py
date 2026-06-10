import time
import json
import logging
from datetime import datetime
from app.services.deepseek_service import client, DEEPSEEK_MODEL
from app.services.context_builder import build_system_context
from app.models.schemas import InsightResponse

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutos
_cache = None
_cache_expiry = 0

async def generate_insights() -> dict:
    global _cache, _cache_expiry
    now = time.time()
    
    if _cache and now < _cache_expiry:
        return _cache

    try:
        context_data = await build_system_context()
    except Exception:
        context_data = None

    system_prompt = f"""Eres un analista de negocio para Kiora POS. Genera exactamente 1 insight accionable basado en los datos actuales.

REGLAS:
- El insight debe ser breve, concreto y accionable (máximo 200 caracteres)
- Calcula la tendencia de rendimiento comparando con la semana pasada
- El insight debe mencionar datos específicos del contexto, no genéricos
- Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional
- El objeto JSON DEBE tener exactamente la siguiente estructura (y no otras claves):
{{
  "insight": "El texto del insight...",
  "trend_percentage": 15.5,
  "trend_direction": "up",
  "trend_comparison": "vs semana pasada"
}}
Nota: trend_direction debe ser "up" o "down". trend_percentage debe ser un número.

Datos actuales del negocio:
{context_data or 'No hay datos disponibles en este momento.'}"""

    try:
        response = await client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[{"role": "system", "content": system_prompt}],
            max_tokens=4096,
            stream=False,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content or "{}"
        
        # Validación estricta con Pydantic
        validated_data = InsightResponse.model_validate_json(content)
        
        output = validated_data.model_dump()
        output["timestamp"] = datetime.utcnow().isoformat() + "Z"

        _cache = output
        _cache_expiry = now + CACHE_TTL
        return output
    except Exception as e:
        logger.error(f"[InsightsService] Error: {e}")
        if _cache:
            return _cache
        raise e

def clear_cache():
    global _cache, _cache_expiry
    _cache = None
    _cache_expiry = 0
