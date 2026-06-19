import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.telegram_service import send_telegram_notification, redis_client
from app.services.deepseek_service import chat_with_tools
from app.services.system_prompt import build_system_prompt
from app.services.context_builder import build_system_context

logger = logging.getLogger(__name__)

async def run_autonomous_inventory_check():
    logger.info("[Cron] Iniciando revisión autónoma de inventario...")
    
    lock_key = "kiora:cron:inventory_check_lock"
    # Using redis NX to ensure single execution
    lock = await redis_client.set(lock_key, "locked", nx=True, ex=300)
    
    if not lock:
        logger.info("[Cron] Otra instancia ya está ejecutando esta tarea. Omitiendo.")
        return

    try:
        try:
            context_data = await build_system_context()
        except Exception:
            context_data = None
            
        system_prompt = build_system_prompt(context_data)
        system_msg = {"role": "system", "content": system_prompt}
        
        prompt_msg = {
            "role": "user",
            "content": "Eres un agente de compras autónomo. Analiza el inventario para encontrar productos críticos. Por cada producto bajo o agotado, REDACTA UN CORREO formal al proveedor solicitando la cantidad necesaria para reabastecer (basado en la predicción de agotamiento o faltante) y UTILIZA la herramienta 'send_supplier_email' para guardarlo en la carpeta de Borradores de Gmail. Al final, preséntame un resumen que diga: 'He analizado el inventario y guardé X correos en tus Borradores listos para enviar' y dime para qué proveedores fueron. Si todo está bien, envíame un mensaje de tranquilidad."
        }

        messages = [system_msg, prompt_msg]
        result = await chat_with_tools(messages)

        await send_telegram_notification('🤖 Reporte Autónomo de Inventario', result["response"])
        logger.info("[Cron] Reporte enviado a Telegram exitosamente.")

    except Exception as e:
        logger.error(f"[Cron] Error en la revisión autónoma: {e}")

def start_cron_jobs():
    scheduler = AsyncIOScheduler()
    # Ejecutar todos los días a las 3:00 AM (madrugada)
    scheduler.add_job(
        run_autonomous_inventory_check,
        trigger=CronTrigger(hour=3, minute=0)
    )
    scheduler.start()
    logger.info("[Cron] Tareas programadas iniciadas.")
