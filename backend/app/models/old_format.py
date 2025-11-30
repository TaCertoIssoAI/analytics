from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime


class ClaimOldFormat(BaseModel):
    """Formato antigo das claims vindas do bot"""
    text: str
    links: List[str] = []


class ResponseByClaimOldFormat(BaseModel):
    """Formato antigo das respostas por claim"""
    Result: str  # "Fake", "True", "Misleading", "Unknown"
    reasoningText: str
    reasoningSources: List[str] = []


class ScrapedLinkOldFormat(BaseModel):
    """Link raspado no formato antigo"""
    url: str
    title: Optional[str] = None
    text: Optional[str] = None  # Nota: será renomeado para scraped_text


class AnaliseOldFormat(BaseModel):
    """
    Formato completo recebido do bot (PascalCase).
    Este é o formato que o bot envia via POST /analises
    """
    DocumentId: str
    Date: str  # Aceita string ISO datetime
    MessageType: str  # "FromWhatsappGroup" ou "FromDirectMessage"

    PureText: Optional[str] = None
    FinalTranscribedText: Optional[str] = None
    FinalResponseText: Optional[str] = None
    CommentAboutCompleteContext: Optional[str] = None

    ScrapedLinks: List[ScrapedLinkOldFormat] = []

    HadAudio: bool = False
    AudioUrl: Optional[str] = None
    AudioText: Optional[str] = None

    HadImage: bool = False
    ImageUrl: Optional[str] = None
    ImageText: Optional[str] = None

    HadVideo: bool = False
    VideoUrl: Optional[str] = None
    VideoText: Optional[str] = None

    Claims: Dict[str, ClaimOldFormat] = {}
    ResponseByClaim: Dict[str, ResponseByClaimOldFormat] = {}

    class Config:
        # Exemplo de uso para documentação
        json_schema_extra = {
            "example": {
                "DocumentId": "uuid_v4_12345",
                "Date": "2025-11-30T17:00:00",
                "MessageType": "FromWhatsappGroup",
                "PureText": "Texto do usuário...",
                "FinalTranscribedText": "Texto completo...",
                "FinalResponseText": "FALSO - Resumo...",
                "CommentAboutCompleteContext": "Explicação...",
                "ScrapedLinks": [
                    {
                        "url": "https://site.com",
                        "title": "Titulo",
                        "text": "Conteudo..."
                    }
                ],
                "HadAudio": True,
                "AudioUrl": None,
                "AudioText": "Transcrição...",
                "HadImage": False,
                "ImageUrl": None,
                "ImageText": None,
                "HadVideo": False,
                "VideoUrl": None,
                "VideoText": None,
                "Claims": {
                    "1": {
                        "text": "Texto da claim 1",
                        "links": []
                    }
                },
                "ResponseByClaim": {
                    "1": {
                        "Result": "Fake",
                        "reasoningText": "Justificativa...",
                        "reasoningSources": ["https://fonte.com"]
                    }
                }
            }
        }
