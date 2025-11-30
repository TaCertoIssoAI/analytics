import os
from typing import Optional, Dict, Any
from google.cloud import firestore
from app.config import settings
from app.models.new_format import AnaliseNewFormat

class FirestoreService:
    """
    Serviço para interagir com o Google Cloud Firestore.
    """

    def __init__(self):
        """Inicializa o cliente Firestore"""
        # Configura credenciais do Google Cloud se necessário
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS

        # Inicializa o cliente conectando ao banco específico 'tacertoissoai'
        # Nota: O banco 'tacertoissoai' deve existir no projeto.
        # Se for o banco default, não precisa passar o argumento database.
        try:
            self.client = firestore.Client(project=settings.PROJECT_ID, database='tacertoissoai')
            self.collection_name = "analises"
            print(f"🔥 Firestore client inicializado (database='tacertoissoai')")
        except Exception as e:
            print(f"❌ Erro ao inicializar Firestore: {e}")
            self.client = None

    def save_analise(self, analise: AnaliseNewFormat) -> bool:
        """
        Salva uma análise no Firestore.
        
        Args:
            analise: Análise no formato novo (AnaliseNewFormat)
            
        Returns:
            True se sucesso, False se erro
        """
        if not self.client:
            print("⚠️  Firestore client não inicializado. Ignorando salvamento.")
            return False

        try:
            # Converte Pydantic model para dict
            # exclude_none=True pode ser útil para economizar espaço, 
            # mas vamos manter tudo para consistência com BigQuery por enquanto.
            doc_data = analise.model_dump()
            
            # Garante que processed_at é string (Firestore aceita timestamp, mas vamos manter string ISO por consistência)
            if "processed_at" in doc_data and hasattr(doc_data["processed_at"], "isoformat"):
                 doc_data["processed_at"] = doc_data["processed_at"].isoformat()

            # Salva o documento usando document_id como chave
            doc_ref = self.client.collection(self.collection_name).document(analise.document_id)
            doc_ref.set(doc_data)
            
            print(f"✅ Análise {analise.document_id} salva no Firestore!")
            return True

        except Exception as e:
            print(f"❌ Erro ao salvar no Firestore: {e}")
            return False

    def get_analise(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Busca uma análise no Firestore pelo document_id.
        """
        if not self.client:
            return None

        try:
            doc_ref = self.client.collection(self.collection_name).document(document_id)
            doc = doc_ref.get()

            if doc.exists:
                print(f"✅ Análise {document_id} encontrada no Firestore")
                return doc.to_dict()
            else:
                print(f"⚠️  Análise {document_id} não encontrada no Firestore")
                return None

        except Exception as e:
            print(f"❌ Erro ao buscar no Firestore: {e}")
            return None

# Instância global
firestore_service = FirestoreService()
