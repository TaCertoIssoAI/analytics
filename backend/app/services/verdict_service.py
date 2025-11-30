from typing import List


class VerdictService:
    """
    Serviço para calcular o veredito geral (overall_verdict)
    baseado nos vereditos individuais das claims.
    """

    # Mapeamento de vereditos individuais (formato antigo) → formato novo
    VERDICT_MAP = {
        "Fake": "Fake",
        "True": "True",
        "Misleading": "Misleading",
        "Unknown": "Unknown"
    }

    # Vereditos gerais possíveis
    FALSO = "FALSO"
    VERDADEIRO = "VERDADEIRO"
    ENGANOSO = "ENGANOSO"
    CHECK = "CHECK"
    UNVERIFIED = "UNVERIFIED"

    @staticmethod
    def calculate_overall_verdict(claim_verdicts: List[str]) -> str:
        """
        Calcula o veredito geral baseado nos vereditos individuais.

        Regras:
        - Se todas as claims são "Fake" → "FALSO"
        - Se todas são "True" → "VERDADEIRO"
        - Se tem mix de Fake/True ou Misleading → "ENGANOSO"
        - Se tudo é Unknown ou lista vazia → "UNVERIFIED"
        - Outros casos → "CHECK"

        Args:
            claim_verdicts: Lista de vereditos das claims (Fake, True, Misleading, Unknown)

        Returns:
            Veredito geral (FALSO, VERDADEIRO, ENGANOSO, CHECK, UNVERIFIED)
        """
        if not claim_verdicts:
            return VerdictService.UNVERIFIED

        # Normaliza os veredicts (remove espaços, case-insensitive)
        normalized = [v.strip() for v in claim_verdicts if v and v.strip()]

        if not normalized:
            return VerdictService.UNVERIFIED

        # Conta cada tipo de veredito
        fake_count = sum(1 for v in normalized if v == "Fake")
        true_count = sum(1 for v in normalized if v == "True")
        misleading_count = sum(1 for v in normalized if v == "Misleading")
        unknown_count = sum(1 for v in normalized if v == "Unknown")
        total = len(normalized)

        # Se tudo é Unknown → UNVERIFIED
        if unknown_count == total:
            return VerdictService.UNVERIFIED

        # Se tudo é Fake → FALSO
        if fake_count == total:
            return VerdictService.FALSO

        # Se tudo é True → VERDADEIRO
        if true_count == total:
            return VerdictService.VERDADEIRO

        # Se tem Misleading ou mix de Fake/True → ENGANOSO
        if misleading_count > 0 or (fake_count > 0 and true_count > 0):
            return VerdictService.ENGANOSO

        # Casos que sobraram (ex: mix de Unknown com outros) → CHECK
        return VerdictService.CHECK

    @staticmethod
    def extract_verdict_from_final_response(final_response_text: str) -> str:
        """
        Extrai o veredito do FinalResponseText do formato antigo.
        O formato esperado é: "FALSO - Resumo..." ou "VERDADEIRO - ..." etc.

        Args:
            final_response_text: Texto do campo FinalResponseText

        Returns:
            Veredito extraído (FALSO, VERDADEIRO, ENGANOSO, CHECK, UNVERIFIED)
        """
        if not final_response_text:
            return VerdictService.UNVERIFIED

        # Tenta extrair o veredito do início do texto
        text_upper = final_response_text.strip().upper()

        if text_upper.startswith("FALSO"):
            return VerdictService.FALSO
        elif text_upper.startswith("VERDADEIRO"):
            return VerdictService.VERDADEIRO
        elif text_upper.startswith("ENGANOSO"):
            return VerdictService.ENGANOSO
        elif text_upper.startswith("CHECK"):
            return VerdictService.CHECK
        elif text_upper.startswith("UNVERIFIED"):
            return VerdictService.UNVERIFIED
        else:
            # Se não conseguir extrair, retorna CHECK como fallback
            return VerdictService.CHECK
