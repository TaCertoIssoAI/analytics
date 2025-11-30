from fastapi import APIRouter
from datetime import datetime

router = APIRouter(tags=["Health"])


@router.get("/")
async def root():
    """
    Endpoint raiz - retorna informações básicas da API.
    """
    return {
        "service": "Analytics WhatsApp API",
        "status": "online",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health")
async def health_check():
    """
    Health check endpoint - verifica se o servidor está funcionando.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }
