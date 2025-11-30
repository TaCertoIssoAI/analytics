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

    def list_analises(self, limit: int = 10, offset: int = 0, filters: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Lista análises do Firestore com paginação e filtros básicos.
        Nota: Firestore tem limitações de query. Filtros complexos podem precisar de processamento em memória
        ou índices compostos.
        """
        if not self.client:
            return None

        try:
            # Referência para a coleção
            query = self.client.collection(self.collection_name)

            # Ordenação padrão por data (mais recente primeiro)
            query = query.order_by("processed_at", direction=firestore.Query.DESCENDING)

            # --- Aplicação de Filtros (Básico) ---
            # Nota: Firestore exige índices compostos para filtros de igualdade + range + sort.
            # Para evitar erros de índice agora, vamos fazer a filtragem EM MEMÓRIA para este MVP,
            # exceto limit/offset que aplicamos no final.
            # Se a coleção crescer muito, precisaremos criar índices no Firebase Console.
            
            # Pega TODOS os documentos (limitado a um número razoável para não estourar memória, ex: 1000)
            # Idealmente, usaríamos query.where() aqui, mas vamos simplificar para garantir funcionamento sem índices manuais.
            docs_stream = query.limit(200).stream() 
            
            items = []
            for doc in docs_stream:
                data = doc.to_dict()
                
                # --- Filtragem em Memória ---
                if filters:
                    # Busca textual (case insensitive)
                    if filters.get("search"):
                        term = filters["search"].lower()
                        text = (data.get("user_message_text") or "").lower()
                        title = (data.get("analysis_title") or "").lower()
                        if term not in text and term not in title:
                            continue

                    # Filtro de Message Type
                    msg_type = data.get("source_type")
                    if filters.get("message_type_whatsapp") is False and msg_type == "FromWhatsappGroup":
                        continue
                    if filters.get("message_type_direct") is False and msg_type == "FromDirectMessage":
                        continue

                    # Filtro de Scores
                    metrics = data.get("analysis_metrics", {})
                    if metrics:
                        truth = metrics.get("truth_score", 0)
                        fake = metrics.get("fake_score", 0)
                        
                        if truth < filters.get("min_truth_score", 0) or truth > filters.get("max_truth_score", 100):
                            continue
                        if fake < filters.get("min_fake_score", 0) or fake > filters.get("max_fake_score", 100):
                            continue

                items.append(data)

            # --- Paginação em Memória ---
            total_filtered = len(items)
            paginated_items = items[offset : offset + limit]

            return {
                "items": paginated_items,
                "total": total_filtered, # Nota: Total aproximado (baseado no limit de fetch inicial)
                "limit": limit,
                "offset": offset
            }

        except Exception as e:
            print(f"❌ Erro ao listar do Firestore: {e}")
            return None

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
