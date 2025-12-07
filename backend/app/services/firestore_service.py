import os
from typing import Optional, Dict, Any, List
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
            self.analises_collection = self.client.collection("analises")
            self.users_collection = self.client.collection("users")
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
            doc_ref = self.analises_collection.document(analise.document_id)
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
            query = self.analises_collection

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
            doc_ref = self.analises_collection.document(document_id)
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

    def create_user_profile(self, user_data: Dict[str, Any]) -> bool:
        """Cria ou atualiza um perfil de usuário."""
        if not self.client: return False
        try:
            uid = user_data.get("uid")
            if not uid: return False
            
            doc_ref = self.users_collection.document(uid)
            doc_ref.set(user_data, merge=True)
            print(f"✅ Perfil de usuário {uid} salvo/atualizado.")
            return True
        except Exception as e:
            print(f"❌ Erro ao salvar perfil de usuário: {e}")
            return False

    def get_user_profile(self, uid: str) -> Optional[Dict[str, Any]]:
        """Busca um perfil de usuário."""
        if not self.client: return None
        try:
            doc_ref = self.users_collection.document(uid)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            print(f"❌ Erro ao buscar perfil de usuário: {e}")
            return None
        except Exception as e:
            print(f"❌ Erro ao buscar perfil de usuário: {e}")
            return None

    def get_users_by_ids(self, uids: List[str]) -> List[Dict[str, Any]]:
        """Busca múltiplos perfis de usuário."""
        if not self.client or not uids: return []
        
        users = []
        # Firestore 'in' query supports up to 10 items. For more, we need to batch or loop.
        # For simplicity in this MVP, we'll loop. For production, use FieldFilter with 'in' in batches of 10-30.
        try:
            for uid in uids:
                user = self.get_user_profile(uid)
                if user:
                    users.append(user)
            return users
        except Exception as e:
            print(f"❌ Erro ao buscar usuários em lote: {e}")
            return []

    def update_analise_interaction(self, document_id: str, uid: str, action: str) -> bool:
        """
        Atualiza likes/dislikes de uma análise.
        action: 'like', 'dislike', 'remove_like', 'remove_dislike'
        """
        if not self.client: return False
        
        try:
            doc_ref = self.analises_collection.document(document_id)
            
            if action == 'like':
                # Adiciona like, remove dislike
                doc_ref.update({
                    'liked_by': firestore.ArrayUnion([uid]),
                    'disliked_by': firestore.ArrayRemove([uid])
                })
            elif action == 'dislike':
                # Adiciona dislike, remove like
                doc_ref.update({
                    'disliked_by': firestore.ArrayUnion([uid]),
                    'liked_by': firestore.ArrayRemove([uid])
                })
            elif action == 'remove_like':
                 doc_ref.update({
                    'liked_by': firestore.ArrayRemove([uid])
                })
            elif action == 'remove_dislike':
                 doc_ref.update({
                    'disliked_by': firestore.ArrayRemove([uid])
                })
            else:
                return False
            
            print(f"✅ Interação {action} atualizada para {document_id} por {uid}")
            return True
        except Exception as e:
            print(f"❌ Erro ao atualizar interação: {e}")
            return False

    def get_user_interactions(self, uid: str) -> List[Dict[str, Any]]:
        """
        Busca todas as análises que o usuário interagiu (like ou dislike).
        """
        if not self.client: return []
        
        interactions = []
        try:
            # Busca likes
            likes_query = self.analises_collection.where("liked_by", "array_contains", uid).stream()
            for doc in likes_query:
                data = doc.to_dict()
                data["user_interaction"] = "like"
                interactions.append(data)
                
            # Busca dislikes
            dislikes_query = self.analises_collection.where("disliked_by", "array_contains", uid).stream()
            for doc in dislikes_query:
                data = doc.to_dict()
                data["user_interaction"] = "dislike"
                interactions.append(data)
                
            # Ordena por data (mais recente primeiro) - processamento em memória
            interactions.sort(key=lambda x: x.get("processed_at", ""), reverse=True)
            
            return interactions
        except Exception as e:
            print(f"❌ Erro ao buscar interações do usuário: {e}")
            return []
    def get_top_reviewers(self, days: int = 7, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Retorna os usuários com mais interações (likes/dislikes) nos últimos 'days' dias.
        """
        if not self.client: return []
        
        try:
            from datetime import datetime, timedelta
            
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            # Busca análises recentes
            # Nota: Em produção com muitos dados, isso deve ser feito com uma Collection Group Query 
            # ou um contador incrementado em cada usuário. Para este MVP, agregação em memória serve.
            query = self.analises_collection.where("processed_at", ">=", cutoff_date).stream()
            
            user_counts = {}
            
            for doc in query:
                data = doc.to_dict()
                
                # Conta likes
                for uid in data.get("liked_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1
                    
                # Conta dislikes
                for uid in data.get("disliked_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1
            
            # Ordena por contagem decrescente
            sorted_users = sorted(user_counts.items(), key=lambda item: item[1], reverse=True)[:limit]
            
            # Busca dados dos usuários
            top_reviewers = []
            for uid, count in sorted_users:
                user_profile = self.get_user_profile(uid)
                if user_profile:
                    top_reviewers.append({
                        "user": user_profile,
                        "count": count
                    })
            
            return top_reviewers
            
        except Exception as e:
            print(f"❌ Erro ao buscar top reviewers: {e}")
            return []
# Instância global
firestore_service = FirestoreService()
