from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any


class ScrapedLinkInputFormat(BaseModel):
    """Link raspado no formato de entrada"""
    url: str
    success: bool = True
    text: Optional[str] = None
    title: Optional[str] = None


class ClaimInputFormat(BaseModel):
    """Claim no formato de entrada (dentro do dicionário Claims)"""
    text: str
    links: List[str] = []


class ReasoningSourceInputFormat(BaseModel):
    """Fonte usada no raciocínio"""
    url: str
    title: Optional[str] = None
    publisher: Optional[str] = None
    citation_text: Optional[str] = None


class ClaimVerdictInputFormat(BaseModel):
    """Veredito de uma claim específica dentro de uma fonte de dados"""
    claim_id: str
    claim_text: str
    Result: str  # "Verdadeiro", "Falso", etc.
    reasoningText: str
    reasoningSources: List[ReasoningSourceInputFormat] = []


class ResponseByDataSourceInputFormat(BaseModel):
    """Resposta agrupada por fonte de dados"""
    data_source_id: str
    data_source_type: str  # "original_text", "link_context", etc.
    claim_verdicts: List[ClaimVerdictInputFormat] = []


class AnaliseInputFormat(BaseModel):
    """
    Novo formato de entrada recebido do bot.
    """
    DocumentId: str
    Date: str
    message_type: str  # snake_case: "FromDirectMessage"

    PureText: Optional[str] = None
    FinalTranscribedText: Optional[str] = None
    FinalResponseText: Optional[str] = None
    CommentAboutCompleteContext: Optional[str] = None

    ScrapedLinks: List[ScrapedLinkInputFormat] = []

    HadAudio: bool = False
    AudioUrl: Optional[str] = None
    AudioText: Optional[str] = None

    HadImage: bool = False
    ImageUrl: Optional[str] = None
    ImageText: Optional[str] = None

    HadVideo: bool = False
    VideoUrl: Optional[str] = None
    VideoText: Optional[str] = None

    # Dicionário de ID -> Claim
    Claims: Dict[str, ClaimInputFormat] = {}

    # Lista de respostas por fonte de dados
    ResponseByDataSource: List[ResponseByDataSourceInputFormat] = []

    class Config:
        json_schema_extra = {
            "example": {
                "DocumentId": "e2854f5a-4d88-4214-ac74-c108124e9d67",
                "Date": "2025-11-29T23:18:57-03:00",
                "message_type": "FromDirectMessage",
                "PureText": "Texto...",
                "FinalTranscribedText": "Texto completo...",
                "FinalResponseText": "Resultado...",
                "CommentAboutCompleteContext": "Comentário...",
                "ScrapedLinks": [],
                "HadAudio": False,
                "Claims": {
                    "55b2d390": {"text": "Claim 1", "links": []}
                },
                "ResponseByDataSource": [
                    {
                        "data_source_id": "link-1",
                        "data_source_type": "link_context",
                        "claim_verdicts": [
                            {
                                "claim_id": "55b2d390",
                                "claim_text": "Claim 1",
                                "Result": "Verdadeiro",
                                "reasoningText": "Justificativa...",
                                "reasoningSources": []
                            }
                        ]
                    }
                ]
            }
        }
