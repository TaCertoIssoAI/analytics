import os

import httpx
from google import genai
from app.config import settings

_ssl_patched = False


def _patch_ssl_if_needed():
    global _ssl_patched
    if _ssl_patched or not os.getenv("DISABLE_SSL_VERIFY"):
        return
    _original = httpx.Client.__init__

    def _patched(self, *a, **kw):
        kw.setdefault("verify", False)
        _original(self, *a, **kw)

    httpx.Client.__init__ = _patched
    _ssl_patched = True


class LLMService:
    """Serviço para interagir com LLMs (Gemini)"""

    def __init__(self):
        _patch_ssl_if_needed()
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None
            print("⚠️ GEMINI_API_KEY não configurada. Funcionalidades de LLM estarão indisponíveis.")

    def generate_title(self, text: str) -> str:
        """
        Gera um título conciso para a análise baseada no texto.

        Args:
            text: Texto da mensagem ou conteúdo a ser analisado.

        Returns:
            Título gerado ou string vazia se falhar.
        """
        if not self.client:
            return "Análise sem título"

        try:
            # Limita o texto para não estourar tokens/custo
            truncated_text = text[:2000]

            system_prompt = "Você é um assistente que gera títulos jornalísticos curtos e objetivos (máximo 10 palavras) para verificações de fatos. O título deve resumir o tema central da mensagem analisada. Não use aspas."
            user_prompt = f"Gere um título para esta mensagem:\n\n{truncated_text}"

            response = self.client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=user_prompt,
                config={
                    "system_instruction": system_prompt,
                    "max_output_tokens": 30,
                    "temperature": 0.5,
                },
            )

            title = response.text.strip()
            # Remove aspas extras se o modelo colocar
            title = title.replace('"', '').replace("'", "")
            return title

        except Exception as e:
            print(f"❌ Erro ao gerar título com LLM: {e}")
            return "Análise de Conteúdo"

# Instância global
llm_service = LLMService()
