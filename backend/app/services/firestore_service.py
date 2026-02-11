import os
from typing import Optional, Dict, Any, List
from datetime import datetime
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
            def _parse_dt(value: Any) -> Optional[datetime]:
                if value is None:
                    return None
                if isinstance(value, datetime):
                    return value
                if isinstance(value, str) and value:
                    try:
                        return datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except Exception:
                        return None
                return None

            start_dt = _parse_dt(filters.get("start_date")) if filters else None
            end_dt = _parse_dt(filters.get("end_date")) if filters else None

            # Referência para a coleção
            query = self.analises_collection

            # Ordenação padrão por data (mais recente primeiro)
            query = query.order_by("processed_at", direction=firestore.Query.DESCENDING)

            # --- Aplicação de Filtros (Básico) ---
            # Nota: Firestore exige índices compostos para filtros de igualdade + range + sort.
            # Para evitar erros de índice agora, vamos fazer a filtragem EM MEMÓRIA para este MVP,
            # exceto limit/offset que aplicamos no final.
            # Se a coleção crescer muito, precisaremos criar índices no Firebase Console.
            
            # Varre documentos em lotes para permitir contagem total correta.
            # Mantemos um limite de segurança para não estourar memória/tempo em coleções muito grandes.
            max_scan = 10000
            batch_size = 500

            items: List[Dict[str, Any]] = []
            scanned = 0
            last_doc = None

            while True:
                batched_query = query.limit(batch_size)
                if last_doc is not None:
                    batched_query = batched_query.start_after(last_doc)

                docs = list(batched_query.stream())
                if not docs:
                    break

                for doc in docs:
                    scanned += 1
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

                        # Filtro de Modalidade (OR logic)
                        # Mantém compatível com a lógica do BigQuery: incluir se tiver ao menos uma modalidade selecionada.
                        media_info = data.get("media_info") or {}
                        has_text = bool((data.get("user_message_text") or "").strip())
                        has_audio = bool(media_info.get("has_audio"))
                        has_video = bool(media_info.get("has_video"))
                        has_image = bool(media_info.get("has_image"))

                        selected_text = bool(filters.get("modality_text"))
                        selected_audio = bool(filters.get("modality_audio"))
                        selected_video = bool(filters.get("modality_video"))
                        selected_image = bool(filters.get("modality_image"))

                        # Se filtros de modalidade foram passados mas nenhum selecionado, não retorna nada
                        if any(k.startswith("modality_") for k in filters.keys()) and not any(
                            [selected_text, selected_audio, selected_video, selected_image]
                        ):
                            continue

                        if selected_text or selected_audio or selected_video or selected_image:
                            if not (
                                (selected_text and has_text)
                                or (selected_audio and has_audio)
                                or (selected_video and has_video)
                                or (selected_image and has_image)
                            ):
                                continue

                        # Filtro de Scores
                        metrics = data.get("analysis_metrics", {})
                        if metrics:
                            truth = metrics.get("truth_score", 0)
                            fake = metrics.get("fake_score", 0)
                            unverified = metrics.get("unverified_score", 0)
                            out_of_context_count = metrics.get("out_of_context_count", 0)
                            out_of_context_score = metrics.get("out_of_context_score", 0)

                            if truth < filters.get("min_truth_score", 0) or truth > filters.get("max_truth_score", 100):
                                continue
                            if fake < filters.get("min_fake_score", 0) or fake > filters.get("max_fake_score", 100):
                                continue
                            if unverified < filters.get("min_unverified_score", 0) or unverified > filters.get("max_unverified_score", 100):
                                continue

                            min_ooc = filters.get("min_out_of_context_score", 0)
                            max_ooc = filters.get("max_out_of_context_score", 100)
                            if out_of_context_score < min_ooc or out_of_context_score > max_ooc:
                                continue

                        # Filtro de Data
                        if start_dt or end_dt:
                            processed_dt = _parse_dt(data.get("processed_at"))
                            if processed_dt:
                                if start_dt and processed_dt < start_dt:
                                    continue
                                if end_dt and processed_dt > end_dt:
                                    continue

                    items.append(data)

                    if scanned >= max_scan:
                        break

                last_doc = docs[-1]

                if scanned >= max_scan:
                    print(f"⚠️  Firestore scan atingiu limite de segurança ({max_scan}). Total pode ser truncado.")
                    break

            # --- Paginação em Memória ---
            total_filtered = len(items)
            paginated_items = items[offset : offset + limit]

            return {
                "items": paginated_items,
                "total": total_filtered,
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
                data = doc.to_dict() or {}

                # Normaliza payloads antigos / registros incompletos
                user_message_text = data.get("user_message_text")
                if user_message_text is None or (isinstance(user_message_text, str) and not user_message_text.strip()):
                    media_info = data.get("media_info") or {}
                    has_media = any(
                        bool(media_info.get(k))
                        for k in ("has_audio", "has_image", "has_video")
                    )

                    # Possíveis chaves antigas / alternativas
                    fallback = (
                        data.get("userMessageText")
                        or data.get("user_message")
                        or data.get("PureText")
                        or data.get("pure_text")
                    )

                    # Se não houver mídia, ainda tentamos usar o texto combinado como fallback.
                    if not has_media and not fallback:
                        fallback = (
                            data.get("full_combined_text")
                            or data.get("FinalTranscribedText")
                            or data.get("final_transcribed_text")
                        )

                    data["user_message_text"] = (fallback or "").strip() if isinstance(fallback, str) else ""

                return data
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
            print(f"❌ Erro ao buscar perfil de usuário: {e}")
            return None

    def delete_user_profile(self, uid: str) -> bool:
        """Deleta um perfil de usuário do Firestore."""
        if not self.client: return False
        try:
            doc_ref = self.users_collection.document(uid)
            doc_ref.delete()
            print(f"✅ Perfil de usuário {uid} deletado.")
            return True
        except Exception as e:
            print(f"❌ Erro ao deletar perfil de usuário: {e}")
            return False

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

    def list_users(self, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """
        Lista usuários com paginação básica.
        """
        if not self.client: return {"users": [], "total": 0}
        
        try:
            # Nota: Offset em Firestore é caro (lê todos docs anteriores).
            # Para produção, usar cursor (start_after).
            # Para este MVP com poucos usuários, stream() e slice em memória é aceitável.
            docs = list(self.users_collection.stream())
            total = len(docs)
            
            # Ordena por nome
            users = []
            for doc in docs:
                data = doc.to_dict()
                users.append(data)
                
            users.sort(key=lambda x: (x.get("displayName") or "").lower())
            
            paginated_users = users[offset : offset + limit]
            
            return {
                "users": paginated_users,
                "total": total,
                "limit": limit,
                "offset": offset
            }
        except Exception as e:
            print(f"❌ Erro ao listar usuários: {e}")
            return {"users": [], "total": 0}

    def update_user_role(self, uid: str, role: str) -> bool:
        """
        Atualiza o papel (role) do usuário no Firestore.
        """
        if not self.client: return False
        try:
            doc_ref = self.users_collection.document(uid)
            doc_ref.set({"role": role}, merge=True)
            print(f"✅ Role do usuário {uid} atualizada para {role}")
            return True
        except Exception as e:
            print(f"❌ Erro ao atualizar role do usuário: {e}")
            return False

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
    def get_top_reviewers(self, days: int = 7, limit: int = 5) -> Dict[str, Any]:
        """
        Retorna os usuários com mais interações (likes/dislikes) nos últimos 'days' dias.
        Se não houver revisores na semana, retorna os top 5 revisores de todos os tempos.
        
        Returns:
            Dict com 'reviewers' (lista) e 'period' ('week' ou 'all_time')
        """
        if not self.client: return {"reviewers": [], "period": "week"}
        
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
            
            # Se não houver revisores na semana, busca os top 5 de todos os tempos
            if not user_counts:
                print("ℹ️  Nenhum revisor encontrado na semana. Buscando top revisores de todos os tempos...")
                all_time_reviewers = self._get_all_time_top_reviewers(limit)
                return {"reviewers": all_time_reviewers, "period": "all_time"}
            
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
            
            return {"reviewers": top_reviewers, "period": "week"}
            
        except Exception as e:
            print(f"❌ Erro ao buscar top reviewers: {e}")
            return {"reviewers": [], "period": "week"}
    
    def _get_all_time_top_reviewers(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Retorna os top revisores de todos os tempos (sem filtro de data).
        """
        if not self.client: return []
        
        try:
            # Busca TODAS as análises (sem filtro de data)
            query = self.analises_collection.stream()
            
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
            
            print(f"✅ Top {len(top_reviewers)} revisores de todos os tempos encontrados")
            return top_reviewers
            
        except Exception as e:
            print(f"❌ Erro ao buscar top reviewers de todos os tempos: {e}")
            return []
    def get_all_ids(self) -> List[str]:
        """
        Retorna todos os document_ids da coleção analises.
        Usa projection query para economia de banda.
        """
        if not self.client: return []
        try:
            # Projetar apenas o __name__ (document ID) é a forma mais barata
            # Mas o python client do firestore abstrai isso com .select([]) ou apenas iterar references
            # list_documents() é uma opção, mas pode ser lenta se for muitos
            # Vamos usar stream() com select vazia (apenas ID)
            docs = self.analises_collection.select([]).stream()
            return [doc.id for doc in docs]
        except Exception as e:
            print(f"❌ Erro ao buscar todos os IDs no Firestore: {e}")
            return []

# Instância global
firestore_service = FirestoreService()
