from pydantic import BaseModel
from typing import Optional
from .new_format import AnaliseNewFormat


class AnaliseCreateResponse(BaseModel):
    """Resposta ao criar uma análise via POST /analises"""
    success: bool
    message: str
    document_id: str
    verification_url: str  # /verificacao/{document_id}

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Análise criada com sucesso",
                "document_id": "uuid_v4_12345",
                "verification_url": "/verificacao/uuid_v4_12345"
            }
        }


class AnaliseGetResponse(BaseModel):
    """Resposta ao buscar uma análise via GET /analises/{id}"""
    success: bool
    data: Optional[AnaliseNewFormat] = None
    message: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "document_id": "uuid_v4_12345",
                    "processed_at": "2025-11-30T17:00:00+00:00",
                    "source_type": "FromWhatsappGroup",
                    "overall_verdict": "FALSO",
                    "final_comment": "Análise completa...",
                    "claims": []
                },
                "message": "Análise encontrada"
            }
        }


class ErrorResponse(BaseModel):
    """Resposta de erro padrão"""
    success: bool = False
    error: str
    detail: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Análise não encontrada",
                "detail": "Document ID uuid_v4_12345 não existe no BigQuery"
            }
        }
