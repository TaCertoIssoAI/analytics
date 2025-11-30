from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ScrapedLinkNewFormat(BaseModel):
    """Link raspado no formato novo"""
    url: Optional[str] = None
    title: Optional[str] = None
    scraped_text: Optional[str] = None  # Renomeado de 'text' para 'scraped_text'


class SourceNewFormat(BaseModel):
    """Fonte de uma claim (formato rico)"""
    url: Optional[str] = None
    title: Optional[str] = None
    publisher: Optional[str] = None
    citation_text: Optional[str] = None


class ClaimNewFormat(BaseModel):
    """Claim processada no formato novo"""
    claim_id: str
    text: str
    verdict: str  # "Fake", "True", "Misleading", "Unknown" (normalizado)
    reasoning: str
    topics: List[str] = []  # Classificados automaticamente pelo IPTC se vazio
    sources: List[SourceNewFormat] = []  # Fontes ricas


class MediaInfo(BaseModel):
    """Informações de mídia agrupadas"""
    has_audio: bool = False
    audio_uri: Optional[str] = None
    audio_text: Optional[str] = None

    has_image: bool = False
    image_uri: Optional[str] = None
    image_text: Optional[str] = None

    has_video: bool = False
    video_uri: Optional[str] = None
    video_uri: Optional[str] = None
    video_text: Optional[str] = None


class AnalysisMetrics(BaseModel):
    """Métricas da análise"""
    total_claims: int = 0
    true_count: int = 0
    fake_count: int = 0
    unverified_count: int = 0
    
    truth_score: float = 0.0
    fake_score: float = 0.0
    unverified_score: float = 0.0


class AnaliseNewFormat(BaseModel):
    """
    Formato final para salvar no BigQuery e retornar pela API (snake_case).
    Este é o formato que será armazenado no BigQuery e servido pelo GET /analises/{id}
    """
    document_id: str
    processed_at: str  # ISO datetime string
    source_type: str  # "FromWhatsappGroup" ou "FromDirectMessage"
    analysis_title: Optional[str] = None  # Título gerado por IA

    user_message_text: Optional[str] = None
    full_combined_text: Optional[str] = None
    scraped_links: List[ScrapedLinkNewFormat] = []

    overall_verdict: str  # "FALSO", "VERDADEIRO", "ENGANOSO", "CHECK", "UNVERIFIED"
    final_comment: str  # Comentário final sobre a análise

    media_info: MediaInfo
    analysis_metrics: "AnalysisMetrics"
    claims: List[ClaimNewFormat] = []

    class Config:
        # Exemplo de uso para documentação
        json_schema_extra = {
            "example": {
                "document_id": "uuid_v4_12345",
                "processed_at": "2025-11-30T17:00:00+00:00",
                "source_type": "FromWhatsappGroup",
                "user_message_text": "Texto do usuário...",
                "full_combined_text": "Texto completo...",
                "scraped_links": [
                    {
                        "url": "https://site.com",
                        "title": "Titulo",
                        "scraped_text": "Conteudo..."
                    }
                ],
                "overall_verdict": "FALSO",
                "final_comment": "Explicação...",
                "media_info": {
                    "has_audio": True,
                    "audio_uri": None,
                    "audio_text": "Transcrição...",
                    "has_image": True,
                    "image_uri": None,
                    "image_text": "OCR...",
                    "has_video": False,
                    "video_uri": None,
                    "video_text": None
                },
                "claims": [
                    {
                        "claim_id": "1",
                        "text": "Texto da claim 1",
                        "verdict": "Fake",
                        "reasoning": "Justificativa...",
                        "topics": [
                            "judiciário (sistema de justiça)",
                            "tribunal"
                        ],
                        "sources": ["https://fonte.com"]
                    }
                ]
            }
        }
