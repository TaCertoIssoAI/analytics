import openai
from app.config import settings

class LLMService:
    """Serviço para interagir com LLMs (OpenAI)"""

    def __init__(self):
        if settings.OPENAI_API_KEY:
            openai.api_key = settings.OPENAI_API_KEY
        else:
            print("⚠️ OPENAI_API_KEY não configurada. Funcionalidades de LLM estarão indisponíveis.")

    def generate_title(self, text: str) -> str:
        """
        Gera um título conciso para a análise baseada no texto.
        
        Args:
            text: Texto da mensagem ou conteúdo a ser analisado.
            
        Returns:
            Título gerado ou string vazia se falhar.
        """
        if not settings.OPENAI_API_KEY:
            return "Análise sem título"

        try:
            # Limita o texto para não estourar tokens/custo
            truncated_text = text[:2000]
            
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Você é um assistente que gera títulos jornalísticos curtos e objetivos (máximo 10 palavras) para verificações de fatos. O título deve resumir o tema central da mensagem analisada. Não use aspas."},
                    {"role": "user", "content": f"Gere um título para esta mensagem:\n\n{truncated_text}"}
                ],
                max_tokens=30,
                temperature=0.5
            )
            
            title = response.choices[0].message.content.strip()
            # Remove aspas extras se o modelo colocar
            title = title.replace('"', '').replace("'", "")
            return title

        except Exception as e:
            print(f"❌ Erro ao gerar título com LLM: {e}")
            return "Análise de Conteúdo"

# Instância global
llm_service = LLMService()
