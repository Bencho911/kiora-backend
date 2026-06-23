import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.ai_routes import router as ai_router
from app.jobs.inventory_cron import start_cron_jobs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kiora AI Service", version="1.0.0")

cors_origins = os.getenv("CORS_ORIGIN")
origins = cors_origins.split(",") if cors_origins else ["http://localhost:4321", "http://localhost:3000", "http://localhost:8080"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "x-api-key"],
)

app.include_router(ai_router, prefix="/api/ai")

@app.on_event("startup")
async def startup_event():
    start_cron_jobs()
    if not os.getenv("DEEPSEEK_API_KEY"):
        logger.warning("[AI Service] WARNING: DEEPSEEK_API_KEY no configurada")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3008))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
