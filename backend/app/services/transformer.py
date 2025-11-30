from typing import List, Dict, Optional
from datetime import datetime

from app.models.input_format import AnaliseInputFormat
from app.models.new_format import (
    AnaliseNewFormat,
    ClaimNewFormat,
    ScrapedLinkNewFormat,
    MediaInfo,
    SourceNewFormat,
    AnalysisMetrics
)
from app.services.iptc_service import get_iptc_service
from app.services.llm_service import llm_service
from app.services.verdict_service import VerdictService


class AnaliseTransformer:
    """
    Transforma análises do formato de entrada (AnaliseInputFormat)
    para o formato novo (snake_case do BigQuery).
    """

    @staticmethod
    def transform(input_analise: AnaliseInputFormat) -> AnaliseNewFormat:
        """
        Converte AnaliseInputFormat → AnaliseNewFormat.

        Args:
            input_analise: Análise no formato de entrada

        Returns:
            Análise no formato novo (snake_case)
        """
        # 1. Converte ScrapedLinks
        scraped_links = [
            ScrapedLinkNewFormat(
                url=link.url,
                title=link.title,
                scraped_text=link.text
            )
            for link in input_analise.ScrapedLinks
        ]

        # 2. Agrupa informações de mídia
        media_info = MediaInfo(
            has_audio=input_analise.HadAudio,
            audio_uri=input_analise.AudioUrl,
            audio_text=input_analise.AudioText,
            has_image=input_analise.HadImage,
            image_uri=input_analise.ImageUrl,
            image_text=input_analise.ImageText,
            has_video=input_analise.HadVideo,
            video_uri=input_analise.VideoUrl,
            video_text=input_analise.VideoText
        )

        # 3. Converte Claims e agrega vereditos de ResponseByDataSource
        claims_list = AnaliseTransformer._convert_claims_from_datasources(
            claims_dict=input_analise.Claims,
            response_by_datasource=input_analise.ResponseByDataSource
        )

        # 4. Calcula overall_verdict
        overall_verdict = AnaliseTransformer._calculate_overall_verdict(
            final_response_text=input_analise.FinalResponseText,
            claims=claims_list
        )

        # 5. Extrai final_comment
        final_comment = AnaliseTransformer._extract_final_comment(
            input_analise.CommentAboutCompleteContext,
            input_analise.FinalResponseText
        )

        # 6. Gera título com LLM
        # Usa o texto do usuário ou o texto combinado como base
        base_text = input_analise.PureText or input_analise.FinalTranscribedText or ""
        analysis_title = llm_service.generate_title(base_text)

        # 7. Calcula métricas
        analysis_metrics = AnaliseTransformer._calculate_metrics(claims_list)

        # 8. Cria AnaliseNewFormat
        return AnaliseNewFormat(
            document_id=input_analise.DocumentId,
            processed_at=AnaliseTransformer._format_datetime(input_analise.Date),
            source_type=input_analise.message_type,
            analysis_title=analysis_title,
            user_message_text=input_analise.PureText,
            full_combined_text=input_analise.FinalTranscribedText,
            scraped_links=scraped_links,
            overall_verdict=overall_verdict,
            final_comment=final_comment,
            media_info=media_info,
            analysis_metrics=analysis_metrics,
            claims=claims_list
        )

    @staticmethod
    def _convert_claims_from_datasources(
        claims_dict: dict,
        response_by_datasource: list
    ) -> List[ClaimNewFormat]:
        """
        Converte Claims e agrega vereditos de múltiplas fontes.

        Args:
            claims_dict: Dict[str, ClaimInputFormat]
            response_by_datasource: List[ResponseByDataSourceInputFormat]

        Returns:
            Lista de ClaimNewFormat
        """
        # Mapa temporário para agregar informações por claim_id
        # Estrutura: claim_id -> { "text": str, "verdicts": [], "sources": [], "topics": [] }
        claims_map = {}

        # Inicializa com as claims do dicionário
        for claim_id, claim_input in claims_dict.items():
            claims_map[claim_id] = {
                "text": claim_input.text,
                "verdicts": [],
                "reasonings": [],
                "sources": [],
                "topics": AnaliseTransformer._classify_topics(claim_input.text)
            }

        # Itera sobre as fontes de dados para extrair vereditos e raciocínios
        for datasource in response_by_datasource:
            for verdict in datasource.claim_verdicts:
                claim_id = verdict.claim_id
                
                if claim_id not in claims_map:
                    # Se a claim não estava no dicionário principal (não deveria acontecer), cria
                    claims_map[claim_id] = {
                        "text": verdict.claim_text,
                        "verdicts": [],
                        "reasonings": [],
                        "sources": [],
                        "topics": AnaliseTransformer._classify_topics(verdict.claim_text)
                    }
                
                # Adiciona veredito
                claims_map[claim_id]["verdicts"].append(verdict.Result)
                
                # Adiciona raciocínio
                if verdict.reasoningText:
                    claims_map[claim_id]["reasonings"].append(verdict.reasoningText)
                
                # Adiciona fontes
                for source in verdict.reasoningSources:
                    # Verifica duplicatas por URL
                    existing_urls = [s.url for s in claims_map[claim_id]["sources"]]
                    if source.url and source.url not in existing_urls:
                        # Cria objeto SourceNewFormat
                        source_obj = SourceNewFormat(
                            url=source.url,
                            title=source.title,
                            publisher=source.publisher,
                            citation_text=source.citation_text
                        )
                        claims_map[claim_id]["sources"].append(source_obj)

        # Constrói a lista final de ClaimNewFormat
        final_claims = []
        for claim_id, data in claims_map.items():
            # Decide o veredito final da claim (por enquanto, pega o primeiro ou UNKNOWN)
            final_verdict = data["verdicts"][0] if data["verdicts"] else "UNVERIFIED"
            
            # Normaliza veredito (ex: "Verdadeiro" -> "VERDADEIRO")
            final_verdict = AnaliseTransformer._normalize_verdict(final_verdict)

            # Concatena raciocínios
            final_reasoning = "\n\n".join(set(data["reasonings"]))

            claim_new = ClaimNewFormat(
                claim_id=claim_id,
                text=data["text"],
                verdict=final_verdict,
                reasoning=final_reasoning,
                topics=data["topics"],
                sources=data["sources"]
            )
            final_claims.append(claim_new)

        return final_claims

    @staticmethod
    def _normalize_verdict(verdict: str) -> str:
        """Normaliza strings de veredito para o padrão do sistema"""
        v = verdict.upper()
        if "VERDADEIRO" in v or "TRUE" in v:
            return "VERDADEIRO"
        if "FALSO" in v or "FAKE" in v:
            return "FALSO"
        if "ENGANOSO" in v or "MISLEADING" in v:
            return "ENGANOSO"
        return "CHECK"

    @staticmethod
    def _classify_topics(claim_text: str) -> List[str]:
        """Classifica tópicos da claim usando IPTC."""
        if not claim_text or len(claim_text) < 5:
            return []

        try:
            topics = get_iptc_service().classify_text(
                text=claim_text,
                max_depth=4,
                top_k_concepts=5,
                use_llm_rerank=True
            )
            return topics if topics else []
        except Exception as e:
            print(f"⚠️  Erro ao classificar tópicos: {e}")
            return []

    @staticmethod
    def _calculate_overall_verdict(
        final_response_text: str,
        claims: List[ClaimNewFormat]
    ) -> str:
        """Calcula o veredito geral da análise."""
        if final_response_text:
            verdict = VerdictService.extract_verdict_from_final_response(final_response_text)
            if verdict != VerdictService.CHECK:
                return verdict

        if claims:
            claim_verdicts = [claim.verdict for claim in claims]
            return VerdictService.calculate_overall_verdict(claim_verdicts)

        return VerdictService.UNVERIFIED

    @staticmethod
    def _extract_final_comment(
        comment_about_context: str,
        final_response_text: str
    ) -> str:
        """Extrai o comentário final da análise."""
        if comment_about_context and comment_about_context.strip():
            return comment_about_context.strip()

        if final_response_text and final_response_text.strip():
            return final_response_text.strip()

        return ""

    @staticmethod
    def _format_datetime(date_str: str) -> str:
        """Formata datetime para string ISO 8601."""
        if not date_str:
            return datetime.utcnow().isoformat() + "+00:00"

        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.isoformat()
        except ValueError:
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                return dt.isoformat() + "+00:00"
            except ValueError:
                print(f"⚠️  Formato de data inválido: {date_str}, usando data atual")
                return datetime.utcnow().isoformat() + "+00:00"

    @staticmethod
    def _calculate_metrics(claims: List[ClaimNewFormat]) -> AnalysisMetrics:
        """Calcula métricas da análise baseada nas claims."""
        total_claims = len(claims)
        
        if total_claims == 0:
            return AnalysisMetrics()

        true_count = sum(1 for c in claims if c.verdict == "VERDADEIRO")
        fake_count = sum(1 for c in claims if c.verdict == "FALSO")
        # Considera UNVERIFIED, CHECK, ENGANOSO como "unverified" para fins de score simplificado,
        # ou podemos ser mais específicos. Aqui vou agrupar o restante.
        unverified_count = total_claims - true_count - fake_count

        return AnalysisMetrics(
            total_claims=total_claims,
            true_count=true_count,
            fake_count=fake_count,
            unverified_count=unverified_count,
            truth_score=round((true_count / total_claims) * 100, 2),
            fake_score=round((fake_count / total_claims) * 100, 2),
            unverified_score=round((unverified_count / total_claims) * 100, 2)
        )


# Instância global
transformer = AnaliseTransformer()
