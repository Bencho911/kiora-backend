from fastapi import APIRouter, HTTPException, Body, Request
from typing import List, Optional
from datetime import datetime
import time
import logging

from fastapi.responses import StreamingResponse
from app.services.deepseek_service import chat_with_tools, stream_chat_with_tools
from app.services.system_prompt import build_system_prompt
from app.services.context_builder import build_system_context
from app.services.insights_service import generate_insights, clear_cache
from app.services.telegram_service import save_telegram_history, get_telegram_history, send_telegram_notification, redis_client

from app.services.tool_executor import fetch_json, GATEWAY
from app.services.ml_service import analyze_basket_cross_selling_ml

logger = logging.getLogger(__name__)

router = APIRouter()

_cross_selling_cache = None
_cross_selling_expiry = 0
CROSS_SELLING_TTL = 3600

@router.post("/cross-selling/recommend")
async def recommend_cross_selling(payload: dict = Body(...)):
    """Endpoint para el Front del Cliente: Analiza el carrito y sugiere productos estratégicos."""
    global _cross_selling_cache, _cross_selling_expiry
    cart_items = payload.get("cart_items", [])
    
    if not isinstance(cart_items, list):
        raise HTTPException(status_code=400, detail="cart_items debe ser una lista de IDs de productos")
        
    now = time.time()
    if not _cross_selling_cache or now >= _cross_selling_expiry:
        orders = await fetch_json(f"{GATEWAY}/orders?limit=300")
        products = await fetch_json(f"{GATEWAY}/products")
        if isinstance(orders, dict) and "error" in orders:
            orders = []
        if isinstance(products, dict) and "error" in products:
            products = []
            
        _cross_selling_cache = analyze_basket_cross_selling_ml(orders, products)
        _cross_selling_expiry = now + CROSS_SELLING_TTL

    recommendations = []
    if _cross_selling_cache and "top_cross_selling_opportunities" in _cross_selling_cache:
        # Analizamos las reglas ML contra el carrito del cliente
        for opp in _cross_selling_cache["top_cross_selling_opportunities"]:
            id_A = opp["product_id_A"]
            id_B = opp["product_id_B"]
            
            # Si tiene A pero NO B, sugerir B
            if id_A in cart_items and id_B not in cart_items:
                recommendations.append({"product_id": id_B, "name": opp["product_B"], "confidence": opp["confidence_percent"]})
            # Si tiene B pero NO A, sugerir A
            elif id_B in cart_items and id_A not in cart_items:
                recommendations.append({"product_id": id_A, "name": opp["product_A"], "confidence": opp["confidence_percent"]})
                
    # Ordenar por mayor confianza
    recommendations.sort(key=lambda x: x["confidence"], reverse=True)
    
    # Filtrar duplicados tomando los mejores 3
    seen = set()
    final_recs = []
    for r in recommendations:
        if r["product_id"] not in seen:
            seen.add(r["product_id"])
            final_recs.append(r)
            if len(final_recs) >= 3:
                break
                
    return {"recommendations": final_recs}


@router.post("/ask")
async def ask(payload: dict = Body(...)):
    message = payload.get("message")
    conversation = payload.get("conversation", [])

    if not message or not isinstance(message, str) or not message.strip():
        raise HTTPException(status_code=400, detail="El mensaje es requerido")

    try:
        try:
            context_data = await build_system_context()
        except Exception:
            context_data = None
            
        system_prompt = build_system_prompt(context_data)
        system_msg = {"role": "system", "content": system_prompt}

        history = conversation[-20:] if isinstance(conversation, list) else []
        messages = [system_msg] + history + [{"role": "user", "content": message}]

        # Return a streaming response
        return StreamingResponse(
            stream_chat_with_tools(messages),
            media_type="text/event-stream"
        )

    except Exception as e:
        logger.error(f"[AI Service] Error: {e}")
        raise HTTPException(status_code=500, detail="Error al procesar la consulta")

@router.get("/insights")
async def get_insights():
    try:
        insights = await generate_insights()
        return insights
    except Exception as e:
        logger.error(f"[AI Service] Insights error: {e}")
        raise HTTPException(status_code=503, detail={
            "error": "No se pudieron generar insights en este momento",
            "insight": "Estamos teniendo problemas para analizar los datos. Intenta de nuevo más tarde.",
            "trend_percentage": 0,
            "trend_direction": "up",
            "trend_comparison": "vs semana pasada",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

@router.post("/insights/refresh")
async def refresh_insights():
    try:
        clear_cache()
        insights = await generate_insights()
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}

@router.post("/telegram-webhook")
async def telegram_webhook(payload: dict = Body(...)):
    text = payload.get("text")
    chat_id = payload.get("chatId")
    
    if not text or not chat_id:
        raise HTTPException(status_code=400, detail="Missing text or chatId")

    try:
        await save_telegram_history(chat_id, "user", text)
        history = await get_telegram_history(chat_id)

        try:
            context_data = await build_system_context()
        except Exception:
            context_data = None
            
        system_prompt = build_system_prompt(context_data)
        system_msg = {"role": "system", "content": system_prompt}

        messages = [system_msg] + history
        result = await chat_with_tools(messages)

        await save_telegram_history(chat_id, "assistant", result["response"])
        await send_telegram_notification('🤖 Kiora AI', result["response"])

        return {"success": True}
    except Exception as e:
        logger.error(f"[AI Webhook] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/close-business")
async def close_business():
    try:
        await redis_client.set("kiora:business_state", "closed")

        try:
            context_data = await build_system_context()
        except Exception:
            context_data = None
            
        system_prompt = build_system_prompt(context_data)
        system_msg = {"role": "system", "content": system_prompt}
        
        prompt_msg = {
            "role": "user",
            "content": "El negocio acaba de ser cerrado por el administrador. Genera un resumen operativo del día (Ventas de hoy, productos más vendidos, stock bajo). Hazlo en un formato agradable para enviarlo por Telegram. ¡Es tu reporte de cierre diario!"
        }

        messages = [system_msg, prompt_msg]
        result = await chat_with_tools(messages)

        await send_telegram_notification('🛑 Cierre de Negocio', result["response"])

        return {"success": True, "message": "Negocio cerrado. Resumen enviado por Telegram."}
    except Exception as e:
        logger.error(f"[AI Close Business] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/open-business")
async def open_business():
    try:
        await redis_client.set("kiora:business_state", "open")
        await send_telegram_notification('🟢 Apertura de Negocio', 'El negocio ha sido abierto y el sistema está listo para recibir ventas.')
        return {"success": True, "message": "Negocio abierto."}
    except Exception as e:
        logger.error(f"[AI Open Business] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/business-state")
async def get_business_state():
    try:
        state = await redis_client.get("kiora:business_state")
        return {"state": state if state else "open"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
