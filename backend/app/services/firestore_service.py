import os
import time
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
            self.analises_collection = self.client.collection(settings.FIRESTORE_ANALISES)
            self.users_collection = self.client.collection("users")

            # Top reviewers cache (TTL-based in-memory)
            self._top_reviewers_cache: Optional[Dict[str, Any]] = None
            self._top_reviewers_cache_time: float = 0.0
            self._top_reviewers_cache_ttl: float = 300.0  # 5 minutes

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

            # Invalidate top_reviewers cache (new analysis may affect counts)
            self._top_reviewers_cache = None

            print(f"✅ Análise {analise.document_id} salva no Firestore!")
            return True

        except Exception as e:
            print(f"❌ Erro ao salvar no Firestore: {e}")
            return False

    def delete_analise(self, document_id: str) -> bool:
        """
        Remove uma análise do Firestore.
        
        Args:
            document_id: ID do documento a ser removido
            
        Returns:
            True se sucesso, False se erro
        """
        if not self.client: return False
        try:
            doc_ref = self.analises_collection.document(document_id)
            doc_ref.delete()
            print(f"✅ Análise {document_id} removida do Firestore com sucesso!")
            return True
        except Exception as e:
            print(f"❌ Erro ao deletar do Firestore: {e}")
            return False

    @staticmethod
    def _has_meaningful_filters(filters: Optional[Dict[str, Any]]) -> bool:
        """
        Checks if the filters dict contains any restriction beyond the default values.
        When all filters are at their defaults (all types included, all scores 0-100,
        no search, no dates), there's no need to scan all docs.
        """
        if not filters:
            return False
        if filters.get("search"):
            return True
        if filters.get("start_date") or filters.get("end_date"):
            return True
        # Message type disabled?
        if filters.get("message_type_whatsapp") is False or filters.get("message_type_direct") is False:
            return True
        # Any modality disabled?
        for k in ("modality_text", "modality_audio", "modality_video", "modality_image"):
            if filters.get(k) is False:
                return True
        # Score ranges narrowed?
        for prefix in ("truth", "fake", "unverified", "out_of_context"):
            if filters.get(f"min_{prefix}_score", 0) > 0:
                return True
            if filters.get(f"max_{prefix}_score", 100) < 100:
                return True
        return False

    @staticmethod
    def _classify_filters(filters: Optional[Dict[str, Any]]) -> str:
        """
        Classify the filter combination to decide the optimal query strategy.
        Returns one of: 'none', 'date_only', 'source_type_only',
                         'date_and_source_type', 'complex'
        """
        if not filters:
            return "none"

        has_search = bool(filters.get("search"))
        has_start = bool(filters.get("start_date"))
        has_end = bool(filters.get("end_date"))
        has_date = has_start or has_end

        # Determine single active source type (exactly one type disabled)
        whatsapp = filters.get("message_type_whatsapp")
        direct = filters.get("message_type_direct")
        # single_source_type is the value to use in .where("source_type","==",...)
        single_source_type = None
        if whatsapp is False and direct is not False:
            single_source_type = "FromDirectMessage"
        elif direct is False and whatsapp is not False:
            single_source_type = "FromWhatsappGroup"

        # Check for any "complex" filter (modality, scores, search)
        has_modality = any(
            filters.get(k) is False
            for k in ("modality_text", "modality_audio", "modality_video", "modality_image")
        )
        has_score = False
        for prefix in ("truth", "fake", "unverified", "out_of_context"):
            if filters.get(f"min_{prefix}_score", 0) > 0:
                has_score = True
                break
            if filters.get(f"max_{prefix}_score", 100) < 100:
                has_score = True
                break

        complex_present = has_search or has_modality or has_score

        if complex_present:
            return "complex"
        if has_date and single_source_type:
            return "date_and_source_type"
        if has_date:
            return "date_only"
        if single_source_type:
            return "source_type_only"
        return "complex"  # fallback

    # Fields to select on the filtered path (excludes heavy fields: scraped_links, full_combined_text, final_comment)
    _LIST_PROJECTION_FIELDS = [
        "document_id", "processed_at", "source_type", "analysis_title",
        "user_message_text", "liked_by", "disliked_by", "neutral_by",
        "overall_verdict", "media_info", "analysis_metrics", "claims",
    ]

    def list_analises(self, limit: int = 10, offset: int = 0, filters: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Lista análises do Firestore com paginação e filtros básicos.
        Step 1: Fast path when no filters (Home page scenario).
        Step 2: Projection to exclude heavy fields on filtered path.
        """
        t0 = time.perf_counter()
        if not self.client:
            return None

        try:
            has_filters = self._has_meaningful_filters(filters)
            filter_class = self._classify_filters(filters) if has_filters else "none"

            # ---- FAST PATH: No filters (Home page) ----
            if not has_filters:
                # Use Aggregation API for total count (avoids scanning all docs)
                count_query = self.analises_collection.count(alias="total")
                count_result = count_query.get()
                total = count_result[0][0].value

                # Direct query: order + offset + limit (no full scan)
                fast_query = (self.analises_collection
                              .order_by("processed_at", direction=firestore.Query.DESCENDING)
                              .offset(offset)
                              .limit(limit))

                docs = list(fast_query.stream())
                items = [doc.to_dict() for doc in docs]

                elapsed = time.perf_counter() - t0
                print(f"⚡ list_analises() NO-FILTER FAST PATH in {elapsed:.4f}s — {len(items)} items, total={total}")

                return {
                    "items": items,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }

            # ---- Helper ----
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

            # ---- FAST PATH: date_only / source_type_only / date_and_source_type ----
            if filter_class in ("date_only", "source_type_only", "date_and_source_type"):
                start_dt = _parse_dt(filters.get("start_date")) if filters else None
                end_dt = _parse_dt(filters.get("end_date")) if filters else None

                # Determine single active source type for server-side filter
                single_source_type = None
                if filter_class in ("source_type_only", "date_and_source_type"):
                    if filters.get("message_type_whatsapp") is False:
                        single_source_type = "FromDirectMessage"
                    elif filters.get("message_type_direct") is False:
                        single_source_type = "FromWhatsappGroup"

                # Build server-side query
                q = self.analises_collection.select(self._LIST_PROJECTION_FIELDS)

                if single_source_type:
                    q = q.where("source_type", "==", single_source_type)

                if start_dt:
                    q = q.where("processed_at", ">=", start_dt.isoformat() if isinstance(start_dt, datetime) else start_dt)
                if end_dt:
                    q = q.where("processed_at", "<=", end_dt.isoformat() if isinstance(end_dt, datetime) else end_dt)

                q = q.order_by("processed_at", direction=firestore.Query.DESCENDING)

                # Count via Aggregation API with same filters
                count_q = self.analises_collection
                if single_source_type:
                    count_q = count_q.where("source_type", "==", single_source_type)
                if start_dt:
                    count_q = count_q.where("processed_at", ">=", start_dt.isoformat() if isinstance(start_dt, datetime) else start_dt)
                if end_dt:
                    count_q = count_q.where("processed_at", "<=", end_dt.isoformat() if isinstance(end_dt, datetime) else end_dt)

                count_agg = count_q.count(alias="total")
                count_result = count_agg.get()
                total = count_result[0][0].value

                # Apply offset + limit server-side
                q = q.offset(offset).limit(limit)
                docs = list(q.stream())
                items = [doc.to_dict() for doc in docs]

                elapsed = time.perf_counter() - t0
                label = filter_class.upper().replace("_", "-")
                print(f"⚡ list_analises() {label} FAST PATH in {elapsed:.4f}s — {len(items)} items, total={total}")

                return {
                    "items": items,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }

            # ---- COMPLEX FILTERED PATH: Scan with in-memory filtering ----
            start_dt = _parse_dt(filters.get("start_date")) if filters else None
            end_dt = _parse_dt(filters.get("end_date")) if filters else None

            # Apply projection to exclude heavy fields on filtered path
            query = (self.analises_collection
                     .select(self._LIST_PROJECTION_FIELDS)
                     .order_by("processed_at", direction=firestore.Query.DESCENDING))

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
                        media_info = data.get("media_info") or {}
                        has_text = bool((data.get("user_message_text") or "").strip())
                        has_audio = bool(media_info.get("has_audio"))
                        has_video = bool(media_info.get("has_video"))
                        has_image = bool(media_info.get("has_image"))

                        selected_text = bool(filters.get("modality_text"))
                        selected_audio = bool(filters.get("modality_audio"))
                        selected_video = bool(filters.get("modality_video"))
                        selected_image = bool(filters.get("modality_image"))

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

            elapsed = time.perf_counter() - t0
            print(f"⏱️ list_analises() COMPLEX FILTERED PATH in {elapsed:.4f}s — scanned={scanned}, matched={total_filtered}, returned={len(paginated_items)}")

            return {
                "items": paginated_items,
                "total": total_filtered,
                "limit": limit,
                "offset": offset
            }

        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"❌ list_analises() failed in {elapsed:.4f}s: {e}")
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

    def update_user_profile_fields(self, uid: str, fields: Dict[str, Any]) -> bool:
        """
        Atualiza campos específicos do perfil de um usuário (merge).
        """
        if not self.client: return False
        try:
            doc_ref = self.users_collection.document(uid)
            doc_ref.set(fields, merge=True)
            print(f"✅ Perfil do usuário {uid} atualizado com campos: {list(fields.keys())}")
            return True
        except Exception as e:
            print(f"❌ Erro ao atualizar perfil do usuário: {e}")
            return False

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

    def update_analise_interaction(self, document_id: str, uid: str, action: str, observation: dict = None) -> bool:
        """
        Atualiza likes/dislikes/neutral de uma análise com observação.
        observation: { text: str, has_custom_observation: bool }
        action: 'like', 'dislike', 'neutral', 'remove_like', 'remove_dislike', 'remove_neutral'
        """
        if not self.client: return False
        
        try:
            doc_ref = self.analises_collection.document(document_id)
            
            if action == 'like':
                update_data = {
                    'liked_by': firestore.ArrayUnion([uid]),
                    'disliked_by': firestore.ArrayRemove([uid]),
                    'neutral_by': firestore.ArrayRemove([uid])
                }
                if observation is not None:
                    update_data[f'observations.{uid}'] = observation
                doc_ref.update(update_data)
            elif action == 'dislike':
                update_data = {
                    'disliked_by': firestore.ArrayUnion([uid]),
                    'liked_by': firestore.ArrayRemove([uid]),
                    'neutral_by': firestore.ArrayRemove([uid])
                }
                if observation is not None:
                    update_data[f'observations.{uid}'] = observation
                doc_ref.update(update_data)
            elif action == 'neutral':
                update_data = {
                    'neutral_by': firestore.ArrayUnion([uid]),
                    'liked_by': firestore.ArrayRemove([uid]),
                    'disliked_by': firestore.ArrayRemove([uid])
                }
                if observation is not None:
                    update_data[f'observations.{uid}'] = observation
                doc_ref.update(update_data)
            elif action == 'remove_like':
                doc_ref.update({
                    'liked_by': firestore.ArrayRemove([uid]),
                    f'observations.{uid}': firestore.DELETE_FIELD,
                    f'suggested_sources.{uid}': firestore.DELETE_FIELD
                })
            elif action == 'remove_dislike':
                doc_ref.update({
                    'disliked_by': firestore.ArrayRemove([uid]),
                    f'observations.{uid}': firestore.DELETE_FIELD,
                    f'suggested_sources.{uid}': firestore.DELETE_FIELD
                })
            elif action == 'remove_neutral':
                doc_ref.update({
                    'neutral_by': firestore.ArrayRemove([uid]),
                    f'observations.{uid}': firestore.DELETE_FIELD,
                    f'suggested_sources.{uid}': firestore.DELETE_FIELD
                })
            else:
                return False
            
            # Invalidate top_reviewers cache (interaction change affects reviewer counts)
            self._top_reviewers_cache = None

            print(f"✅ Interação {action} atualizada para {document_id} por {uid}")
            return True
        except Exception as e:
            print(f"❌ Erro ao atualizar interação: {e}")
            return False

    def add_suggested_sources(self, document_id: str, uid: str, claim_id: str, sources: List[Dict[str, str]], observation: str = "") -> bool:
        """
        Adiciona fontes sugeridas por um revisor para uma claim específica.
        Só permite se o usuário já avaliou (liked_by ou disliked_by).
        sources: lista de { url: str, title: str }
        observation: observação opcional do revisor
        Armazena em suggested_sources.{uid}.{claim_id} = { items: [...], observation: str }
        """
        if not self.client: return False
        
        try:
            doc_ref = self.analises_collection.document(document_id)
            doc = doc_ref.get()
            if not doc.exists:
                print(f"⚠️  Análise {document_id} não encontrada para sugerir fontes")
                return False
            
            data = doc.to_dict()
            liked_by = data.get("liked_by", [])
            disliked_by = data.get("disliked_by", [])
            neutral_by = data.get("neutral_by", [])
            
            # Atualiza suggested_sources como nested dict (evita dot-notation com UIDs que têm hífens)
            existing_sources = data.get("suggested_sources", {})
            if uid not in existing_sources:
                existing_sources[uid] = {}
            existing_sources[uid][claim_id] = {
                'items': sources,
                'observation': observation
            }
            
            update_data = {
                'suggested_sources': existing_sources
            }
            
            if uid not in liked_by and uid not in disliked_by and uid not in neutral_by:
                update_data['neutral_by'] = firestore.ArrayUnion([uid])
                print(f"➕ Usuário {uid} adicionado automaticamente a neutral_by ao sugerir fontes")
            
            doc_ref.update(update_data)
            
            print(f"✅ Fontes sugeridas adicionadas para claim {claim_id} por {uid} em {document_id}")
            return True
        except Exception as e:
            print(f"❌ Erro ao adicionar fontes sugeridas: {e}")
            return False

    def delete_suggested_sources(self, document_id: str, uid: str, claim_id: str) -> bool:
        """
        Remove as fontes sugeridas por um usuário para uma claim específica.
        Se o usuário não tiver mais sugestões, remove-o de neutral_by (caso esteja lá apenas como neutro).
        """
        if not self.client: return False
        
        try:
            doc_ref = self.analises_collection.document(document_id)
            doc = doc_ref.get()
            if not doc.exists:
                return False
            
            data = doc.to_dict()
            existing_sources = data.get("suggested_sources", {})
            
            # Verifica se o usuário tem sugestões para essa claim
            if uid not in existing_sources or claim_id not in existing_sources.get(uid, {}):
                return False
            
            # Remove a claim específica
            del existing_sources[uid][claim_id]
            
            # Se o usuário não tem mais nenhuma sugestão, remove o uid inteiro
            update_data = {}
            if not existing_sources[uid]:
                del existing_sources[uid]
                # Se o usuário está em neutral_by (e não em liked/disliked), remove de neutral_by
                liked_by = data.get("liked_by", [])
                disliked_by = data.get("disliked_by", [])
                neutral_by = data.get("neutral_by", [])
                if uid in neutral_by and uid not in liked_by and uid not in disliked_by:
                    update_data['neutral_by'] = firestore.ArrayRemove([uid])
                    print(f"➖ Usuário {uid} removido de neutral_by (sem mais sugestões)")
            
            update_data['suggested_sources'] = existing_sources
            doc_ref.update(update_data)
            
            print(f"🗑️ Sugestão de fontes removida: claim {claim_id} por {uid} em {document_id}")
            return True
        except Exception as e:
            print(f"❌ Erro ao remover fontes sugeridas: {e}")
            return False

    def get_suggested_sources(self, document_id: str) -> Dict[str, Any]:
        """
        Retorna todas as fontes sugeridas de uma análise.
        Retorna dict: { uid: { claim_id: [{url, title}, ...] } }
        """
        if not self.client: return {}
        
        try:
            doc_ref = self.analises_collection.document(document_id)
            doc = doc_ref.get()
            if not doc.exists:
                return {}
            
            data = doc.to_dict()
            return data.get("suggested_sources", {})
        except Exception as e:
            print(f"❌ Erro ao buscar fontes sugeridas: {e}")
            return {}

    def get_user_interactions(self, uid: str) -> List[Dict[str, Any]]:
        """
        Busca todas as análises que o usuário interagiu (like ou dislike).
        """
        if not self.client: return []
        
        interactions = []
        try:
            def _extract_user_fields(data: dict, uid: str) -> dict:
                """Extrai observação e fontes sugeridas do usuário."""
                obs_raw = data.get("observations", {}).get(uid)
                if isinstance(obs_raw, dict):
                    data["user_observation"] = obs_raw.get("text", "Sem observações")
                    data["has_custom_observation"] = obs_raw.get("has_custom_observation", False)
                elif isinstance(obs_raw, str) and obs_raw:
                    data["user_observation"] = obs_raw
                    data["has_custom_observation"] = True
                else:
                    data["user_observation"] = "Sem observações"
                    data["has_custom_observation"] = False

                # Extrai fontes sugeridas do usuário
                user_sources = data.get("suggested_sources", {}).get(uid, {})
                if user_sources:
                    # user_sources é um dict { claim_id: { items: [...], observation: str } }
                    data["user_suggested_sources"] = user_sources
                else:
                    data["user_suggested_sources"] = {}
                return data

            # Busca likes
            likes_query = self.analises_collection.where("liked_by", "array_contains", uid).stream()
            for doc in likes_query:
                data = doc.to_dict()
                data["user_interaction"] = "like"
                data = _extract_user_fields(data, uid)
                interactions.append(data)
                
            # Busca dislikes
            dislikes_query = self.analises_collection.where("disliked_by", "array_contains", uid).stream()
            for doc in dislikes_query:
                data = doc.to_dict()
                data["user_interaction"] = "dislike"
                data = _extract_user_fields(data, uid)
                interactions.append(data)
                
            # Busca neutrals
            neutrals_query = self.analises_collection.where("neutral_by", "array_contains", uid).stream()
            for doc in neutrals_query:
                data = doc.to_dict()
                data["user_interaction"] = "neutral"
                data = _extract_user_fields(data, uid)
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
        Utiliza cache in-memory com TTL de 5 minutos.

        Returns:
            Dict com 'reviewers' (lista) e 'period' ('week' ou 'all_time')
        """
        t0 = time.perf_counter()
        if not self.client: return {"reviewers": [], "period": "week"}

        try:
            # Check cache
            if self._top_reviewers_cache is not None and (time.perf_counter() - self._top_reviewers_cache_time) < self._top_reviewers_cache_ttl:
                elapsed = time.perf_counter() - t0
                print(f"⚡ get_top_reviewers() served from cache in {elapsed:.4f}s")
                return self._top_reviewers_cache

            from datetime import datetime, timedelta

            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()

            # Step 4b: Apply projection - only fetch interaction arrays
            query = (self.analises_collection
                     .where("processed_at", ">=", cutoff_date)
                     .select(["liked_by", "disliked_by", "neutral_by"])
                     .stream())

            user_counts = {}

            for doc in query:
                data = doc.to_dict()

                for uid in data.get("liked_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1
                for uid in data.get("disliked_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1
                for uid in data.get("neutral_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1

            # Se não houver revisores na semana, busca os top 5 de todos os tempos
            if not user_counts:
                print("ℹ️  Nenhum revisor encontrado na semana. Buscando top revisores de todos os tempos...")
                all_time_reviewers = self._get_all_time_top_reviewers(limit)
                result = {"reviewers": all_time_reviewers, "period": "all_time"}
                self._top_reviewers_cache = result
                self._top_reviewers_cache_time = time.perf_counter()
                elapsed = time.perf_counter() - t0
                print(f"⏱️ get_top_reviewers() completed (all_time fallback) in {elapsed:.4f}s")
                return result

            # Ordena por contagem decrescente
            sorted_users = sorted(user_counts.items(), key=lambda item: item[1], reverse=True)[:limit]

            # Step 4d: Batch user profile lookup using get_all()
            uids_to_fetch = [uid for uid, _ in sorted_users]
            doc_refs = [self.users_collection.document(uid) for uid in uids_to_fetch]
            user_docs = self.client.get_all(doc_refs)
            user_profiles = {}
            for doc in user_docs:
                if doc.exists:
                    user_profiles[doc.id] = doc.to_dict()

            top_reviewers = []
            for uid, count in sorted_users:
                profile = user_profiles.get(uid)
                if profile:
                    top_reviewers.append({
                        "user": profile,
                        "count": count
                    })

            result = {"reviewers": top_reviewers, "period": "week"}

            # Update cache
            self._top_reviewers_cache = result
            self._top_reviewers_cache_time = time.perf_counter()

            elapsed = time.perf_counter() - t0
            print(f"⏱️ get_top_reviewers() completed in {elapsed:.4f}s (Firestore query + batch lookup)")
            return result

        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"❌ get_top_reviewers() failed in {elapsed:.4f}s: {e}")
            return {"reviewers": [], "period": "week"}
    
    def _get_all_time_top_reviewers(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Retorna os top revisores de todos os tempos (sem filtro de data).
        Step 4b: Uses projection to fetch only interaction arrays.
        Step 4d: Uses batch lookup for user profiles.
        """
        if not self.client: return []

        try:
            # Step 4b: Apply projection - only fetch interaction arrays
            query = self.analises_collection.select(["liked_by", "disliked_by", "neutral_by"]).stream()

            user_counts = {}

            for doc in query:
                data = doc.to_dict()

                for uid in data.get("liked_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1
                for uid in data.get("disliked_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1
                for uid in data.get("neutral_by", []):
                    user_counts[uid] = user_counts.get(uid, 0) + 1

            # Ordena por contagem decrescente
            sorted_users = sorted(user_counts.items(), key=lambda item: item[1], reverse=True)[:limit]

            # Step 4d: Batch user profile lookup using get_all()
            uids_to_fetch = [uid for uid, _ in sorted_users]
            doc_refs = [self.users_collection.document(uid) for uid in uids_to_fetch]
            user_docs = self.client.get_all(doc_refs)
            user_profiles = {}
            for doc in user_docs:
                if doc.exists:
                    user_profiles[doc.id] = doc.to_dict()

            top_reviewers = []
            for uid, count in sorted_users:
                profile = user_profiles.get(uid)
                if profile:
                    top_reviewers.append({
                        "user": profile,
                        "count": count
                    })

            print(f"✅ Top {len(top_reviewers)} revisores de todos os tempos encontrados")
            return top_reviewers

        except Exception as e:
            print(f"❌ Erro ao buscar top reviewers de todos os tempos: {e}")
            return []
    def get_all_reviews(self) -> List[Dict[str, Any]]:
        """
        Retorna todas as reviews (interações like/dislike) de todas as análises,
        enriquecidas com dados do usuário e da análise.
        """
        if not self.client: return []
        
        try:
            # Busca apenas os campos necessários para economia de banda
            docs = self.analises_collection.select([
                "liked_by", "disliked_by", "neutral_by", "observations",
                "analysis_title", "overall_verdict", "processed_at", "document_id"
            ]).stream()
            
            reviews = []
            user_cache: Dict[str, Optional[Dict[str, Any]]] = {}
            
            for doc in docs:
                data = doc.to_dict()
                doc_id = doc.id
                analysis_title = data.get("analysis_title", "Sem título")
                overall_verdict = data.get("overall_verdict", "")
                processed_at = data.get("processed_at", "")
                observations = data.get("observations", {}) or {}
                liked_by = data.get("liked_by", []) or []
                disliked_by = data.get("disliked_by", []) or []
                neutral_by = data.get("neutral_by", []) or []
                
                # Processa likes
                for uid in liked_by:
                    obs_raw = observations.get(uid)
                    if isinstance(obs_raw, dict):
                        obs_text = obs_raw.get("text", "")
                        has_custom = obs_raw.get("has_custom_observation", False)
                    elif isinstance(obs_raw, str) and obs_raw:
                        obs_text = obs_raw
                        has_custom = True
                    else:
                        obs_text = ""
                        has_custom = False
                    
                    # Cache de usuário
                    if uid not in user_cache:
                        user_cache[uid] = self.get_user_profile(uid)
                    user_profile = user_cache[uid]
                    
                    reviews.append({
                        "document_id": doc_id,
                        "analysis_title": analysis_title,
                        "overall_verdict": overall_verdict,
                        "processed_at": processed_at,
                        "uid": uid,
                        "action": "like",
                        "observation": obs_text,
                        "has_custom_observation": has_custom,
                        "user_name": user_profile.get("displayName", "Usuário desconhecido") if user_profile else "Usuário desconhecido",
                        "user_email": user_profile.get("email", "") if user_profile else "",
                        "user_photo": user_profile.get("photoURL", "") if user_profile else "",
                    })
                
                # Processa dislikes
                for uid in disliked_by:
                    obs_raw = observations.get(uid)
                    if isinstance(obs_raw, dict):
                        obs_text = obs_raw.get("text", "")
                        has_custom = obs_raw.get("has_custom_observation", False)
                    elif isinstance(obs_raw, str) and obs_raw:
                        obs_text = obs_raw
                        has_custom = True
                    else:
                        obs_text = ""
                        has_custom = False
                    
                    if uid not in user_cache:
                        user_cache[uid] = self.get_user_profile(uid)
                    user_profile = user_cache[uid]
                    
                    reviews.append({
                        "document_id": doc_id,
                        "analysis_title": analysis_title,
                        "overall_verdict": overall_verdict,
                        "processed_at": processed_at,
                        "uid": uid,
                        "action": "dislike",
                        "observation": obs_text,
                        "has_custom_observation": has_custom,
                        "user_name": user_profile.get("displayName", "Usuário desconhecido") if user_profile else "Usuário desconhecido",
                        "user_email": user_profile.get("email", "") if user_profile else "",
                        "user_photo": user_profile.get("photoURL", "") if user_profile else "",
                    })
                
                # Processa neutrals
                for uid in neutral_by:
                    obs_raw = observations.get(uid)
                    if isinstance(obs_raw, dict):
                        obs_text = obs_raw.get("text", "")
                        has_custom = obs_raw.get("has_custom_observation", False)
                    elif isinstance(obs_raw, str) and obs_raw:
                        obs_text = obs_raw
                        has_custom = True
                    else:
                        obs_text = ""
                        has_custom = False
                    
                    if uid not in user_cache:
                        user_cache[uid] = self.get_user_profile(uid)
                    user_profile = user_cache[uid]
                    
                    reviews.append({
                        "document_id": doc_id,
                        "analysis_title": analysis_title,
                        "overall_verdict": overall_verdict,
                        "processed_at": processed_at,
                        "uid": uid,
                        "action": "neutral",
                        "observation": obs_text,
                        "has_custom_observation": has_custom,
                        "user_name": user_profile.get("displayName", "Usuário desconhecido") if user_profile else "Usuário desconhecido",
                        "user_email": user_profile.get("email", "") if user_profile else "",
                        "user_photo": user_profile.get("photoURL", "") if user_profile else "",
                    })
            
            # Ordena por data da análise (mais recente primeiro)
            reviews.sort(key=lambda x: x.get("processed_at", ""), reverse=True)
            
            print(f"✅ {len(reviews)} reviews encontradas no total")
            return reviews
            
        except Exception as e:
            print(f"❌ Erro ao buscar todas as reviews: {e}")
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
