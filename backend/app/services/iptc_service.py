import sys
import os
from typing import List

# Adiciona o diretório raiz ao path para importar iptc_classifier
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# Carrega settings ANTES de importar iptc_classifier (para garantir que OPENAI_API_KEY está disponível)
from app.config import settings

# Configura OPENAI_API_KEY como variável de ambiente para o iptc_classifier
os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY

from iptc_classifier import IptcEmbeddingTree


class IPTCService:
    """
    Wrapper do classificador IPTC para classificação automática de tópicos.
    Usa embeddings + LLM para encontrar os tópicos mais relevantes para um texto.
    """

    _instance = None  # Singleton

    def __new__(cls):
        """Implementa singleton para carregar o classifier apenas uma vez"""
        if cls._instance is None:
            cls._instance = super(IPTCService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Inicializa o classificador IPTC (apenas uma vez)"""
        if self._initialized:
            return

        try:
            # Caminhos dos arquivos necessários
            base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            json_path = os.path.join(base_path, "cptall-pt-BR.json")
            embeddings_path = os.path.join(base_path, "iptc_embeddings.npz")

            print(f"🔄 Carregando IPTC classifier...")
            print(f"  - Taxonomia: {json_path}")
            print(f"  - Embeddings: {embeddings_path}")

            self.classifier = IptcEmbeddingTree(
                json_path=json_path,
                embeddings_path=embeddings_path
            )

            self._initialized = True
            print(f"✅ IPTC classifier carregado com sucesso!")

        except Exception as e:
            print(f"❌ Erro ao carregar IPTC classifier: {e}")
            raise

    def classify_text(
        self,
        text: str,
        max_depth: int = 4,
        top_k_concepts: int = 5,
        use_llm_rerank: bool = True
    ) -> List[str]:
        """
        Classifica um texto e retorna lista de tópicos.

        Args:
            text: Texto da claim a ser classificada
            max_depth: Profundidade máxima na árvore IPTC
            top_k_concepts: Número de conceitos similares a considerar
            use_llm_rerank: Se True, usa LLM para refinar a classificação

        Returns:
            Lista de tópicos classificados (categoria principal + subcategorias)
        """
        if not text or len(text) < 5:
            return []

        try:
            result = self.classifier.classify_claim(
                text=text,
                max_depth=max_depth,
                top_k_concepts=top_k_concepts,
                rerank_with_llm=use_llm_rerank,
                llm_model="gpt-4o-mini"
            )

            # Combina categoria principal + subcategorias
            topics = [result['main_category']] + result.get('subcategories', [])

            # Remove duplicatas preservando ordem
            unique_topics = list(dict.fromkeys([t for t in topics if t]))

            return unique_topics

        except Exception as e:
            print(f"⚠️  Erro ao classificar texto: {e}")
            print(f"   Texto: {text[:100]}...")
            return []


# Instância global (singleton) - será inicializada no startup do FastAPI
_iptc_service_instance = None


def get_iptc_service() -> IPTCService:
    """
    Retorna a instância singleton do IPTCService.
    Inicializa na primeira chamada (lazy initialization).
    """
    global _iptc_service_instance
    if _iptc_service_instance is None:
        _iptc_service_instance = IPTCService()
    return _iptc_service_instance
