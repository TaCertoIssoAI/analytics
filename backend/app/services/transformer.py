from typing import List
from datetime import datetime

from app.models.old_format import AnaliseOldFormat
from app.models.new_format import (
    AnaliseNewFormat,
    ClaimNewFormat,
    ScrapedLinkNewFormat,
    MediaInfo
)
from app.services.iptc_service import get_iptc_service
from app.services.verdict_service import VerdictService


class AnaliseTransformer:
    """
    Transforma análises do formato antigo (PascalCase do bot)
    para o formato novo (snake_case do BigQuery).
    """

    @staticmethod
    def transform(old_analise: AnaliseOldFormat) -> AnaliseNewFormat:
        """
        Converte AnaliseOldFormat → AnaliseNewFormat.

        Args:
            old_analise: Análise no formato antigo (PascalCase)

        Returns:
            Análise no formato novo (snake_case)
        """
        # 1. Converte ScrapedLinks
        scraped_links = [
            ScrapedLinkNewFormat(
                url=link.url,
                title=link.title,
                scraped_text=link.text  # Renomeia 'text' → 'scraped_text'
            )
            for link in old_analise.ScrapedLinks
        ]

        # 2. Agrupa informações de mídia
        media_info = MediaInfo(
            has_audio=old_analise.HadAudio,
            audio_uri=old_analise.AudioUrl,
            audio_text=old_analise.AudioText,
            has_image=old_analise.HadImage,
            image_uri=old_analise.ImageUrl,
            image_text=old_analise.ImageText,
            has_video=old_analise.HadVideo,
            video_uri=old_analise.VideoUrl,
            video_text=old_analise.VideoText
        )

        # 3. Converte Claims de Dict[str, Claim] → List[ClaimNewFormat]
        claims_list = AnaliseTransformer._convert_claims(
            claims_dict=old_analise.Claims,
            responses_dict=old_analise.ResponseByClaim
        )

        # 4. Calcula overall_verdict
        overall_verdict = AnaliseTransformer._calculate_overall_verdict(
            final_response_text=old_analise.FinalResponseText,
            claims=claims_list
        )

        # 5. Extrai final_comment
        final_comment = AnaliseTransformer._extract_final_comment(
            old_analise.CommentAboutCompleteContext,
            old_analise.FinalResponseText
        )

        # 6. Cria AnaliseNewFormat
        return AnaliseNewFormat(
            document_id=old_analise.DocumentId,
            processed_at=AnaliseTransformer._format_datetime(old_analise.Date),
            source_type=old_analise.MessageType,
            user_message_text=old_analise.PureText,
            full_combined_text=old_analise.FinalTranscribedText,
            scraped_links=scraped_links,
            overall_verdict=overall_verdict,
            final_comment=final_comment,
            media_info=media_info,
            claims=claims_list
        )

    @staticmethod
    def _convert_claims(
        claims_dict: dict,
        responses_dict: dict
    ) -> List[ClaimNewFormat]:
        """
        Converte Claims de Dict para List e mescla com ResponseByClaim.

        Args:
            claims_dict: Dict[str, ClaimOldFormat]
            responses_dict: Dict[str, ResponseByClaimOldFormat]

        Returns:
            Lista de ClaimNewFormat
        """
        claims_list = []

        for claim_id, claim_old in claims_dict.items():
            # Busca resposta correspondente
            response = responses_dict.get(claim_id)

            if not response:
                print(f"⚠️  Claim {claim_id} sem resposta correspondente, pulando...")
                continue

            # Classifica tópicos automaticamente se necessário
            topics = AnaliseTransformer._classify_topics(claim_old.text)

            # Cria ClaimNewFormat
            claim_new = ClaimNewFormat(
                claim_id=claim_id,
                text=claim_old.text,
                verdict=response.Result,  # Mantém o formato original (Fake, True, etc.)
                reasoning=response.reasoningText,
                topics=topics,
                sources=response.reasoningSources
            )

            claims_list.append(claim_new)

        return claims_list

    @staticmethod
    def _classify_topics(claim_text: str) -> List[str]:
        """
        Classifica tópicos da claim usando IPTC.

        Args:
            claim_text: Texto da claim

        Returns:
            Lista de tópicos classificados
        """
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
        """
        Calcula o veredito geral da análise.

        Ordem de prioridade:
        1. Tenta extrair de FinalResponseText (se disponível)
        2. Calcula baseado nos veredicts das claims

        Args:
            final_response_text: Texto do FinalResponseText
            claims: Lista de claims processadas

        Returns:
            Veredito geral (FALSO, VERDADEIRO, ENGANOSO, CHECK, UNVERIFIED)
        """
        # Tenta extrair do FinalResponseText primeiro
        if final_response_text:
            verdict = VerdictService.extract_verdict_from_final_response(final_response_text)
            if verdict != VerdictService.CHECK:  # Se conseguiu extrair um veredito válido
                return verdict

        # Se não conseguiu extrair, calcula baseado nas claims
        if claims:
            claim_verdicts = [claim.verdict for claim in claims]
            return VerdictService.calculate_overall_verdict(claim_verdicts)

        # Fallback
        return VerdictService.UNVERIFIED

    @staticmethod
    def _extract_final_comment(
        comment_about_context: str,
        final_response_text: str
    ) -> str:
        """
        Extrai o comentário final da análise.

        Ordem de prioridade:
        1. CommentAboutCompleteContext (se disponível)
        2. FinalResponseText (se disponível)
        3. String vazia

        Args:
            comment_about_context: CommentAboutCompleteContext
            final_response_text: FinalResponseText

        Returns:
            Comentário final
        """
        if comment_about_context and comment_about_context.strip():
            return comment_about_context.strip()

        if final_response_text and final_response_text.strip():
            return final_response_text.strip()

        return ""

    @staticmethod
    def _format_datetime(date_str: str) -> str:
        """
        Formata datetime para string ISO 8601.

        Args:
            date_str: String de data (pode ser ISO ou outro formato)

        Returns:
            String ISO 8601 (ex: "2025-11-30T17:00:00+00:00")
        """
        if not date_str:
            # Se não tem data, usa o momento atual
            return datetime.utcnow().isoformat() + "+00:00"

        try:
            # Tenta parsear como ISO
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.isoformat()
        except ValueError:
            try:
                # Tenta outros formatos comuns
                dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                return dt.isoformat() + "+00:00"
            except ValueError:
                # Se falhar, usa o momento atual
                print(f"⚠️  Formato de data inválido: {date_str}, usando data atual")
                return datetime.utcnow().isoformat() + "+00:00"


# Instância global
transformer = AnaliseTransformer()
