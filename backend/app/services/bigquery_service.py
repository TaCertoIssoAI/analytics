import os
import json
import time
from typing import Optional, Dict, Any, List, Tuple
from google.cloud import bigquery
from google.api_core import exceptions
from datetime import datetime
from google import genai
from google.genai.types import EmbedContentConfig

from app.config import settings
from app.models.new_format import AnaliseNewFormat


class BigQueryService:
    """
    Serviço para interagir com o BigQuery.
    Responsável por salvar e buscar análises.
    """

    def __init__(self):
        """Inicializa o cliente BigQuery"""
        # Configura credenciais do Google Cloud
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS

        self.client = bigquery.Client(project=settings.PROJECT_ID)
        self.dataset_id = settings.DATASET_ID
        self.table_id = settings.TABLE_ID
        self.full_table_id = f"{settings.PROJECT_ID}.{settings.DATASET_ID}.{settings.TABLE_ID}"

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key is None:
            api_key = os.getenv("GOOGLE_API_KEY")
            if api_key is None:
                raise RuntimeError("Need Gemini API Key to instantiate client")
        
        self.google_genai_client = genai.Client(
            api_key=api_key,
        )

        # Small in-memory embedding cache to speed up repeated queries
        self._embedding_cache: Dict[str, list[float]] = {}
        self._embedding_cache_order: list[str] = []
        self._embedding_cache_max = 128

        # Stats cache (TTL-based in-memory)
        self._stats_cache: Optional[Dict[str, Any]] = None
        self._stats_cache_time: float = 0.0
        self._stats_cache_ttl: float = 300.0  # 5 minutes

        # Dashboard cache (TTL-based in-memory, keyed by filter hash)
        self._dashboard_cache: Dict[str, Tuple[Dict, float]] = {}
        self._dashboard_cache_order: List[str] = []
        self._dashboard_cache_max: int = 50
        self._dashboard_cache_ttl: float = 300.0  # 5 minutes

        # Sources cache (TTL-based in-memory, keyed by filter+pagination hash)
        self._sources_cache: Dict[str, Tuple[Dict, float]] = {}
        self._sources_cache_order: List[str] = []
        self._sources_cache_max: int = 50
        self._sources_cache_ttl: float = 300.0  # 5 minutes

        # Recommendations cache (LRU + TTL) — IPTC topics are stable
        self._recommendations_cache: Dict[str, Tuple[List, float]] = {}
        self._recommendations_cache_order: List[str] = []
        self._recommendations_cache_max: int = 50
        self._recommendations_cache_ttl: float = 1800.0  # 30 minutes

        print(f"📊 BigQuery client inicializado:")
        print(f"   Project: {settings.PROJECT_ID}")
        print(f"   Dataset: {settings.DATASET_ID}")
        print(f"   Table: {settings.TABLE_ID}")

    def insert_analise(self, analise: AnaliseNewFormat) -> bool:
        """
        Insere uma análise no BigQuery.

        Args
            analise: Análise no formato novo (AnaliseNewFormat)

        Returns:
            True se sucesso, False se erro
        """
        try:
            # Converte Pydantic model para dict
            # Exclui campos que não existem no BigQuery (liked_by, disliked_by, neutral_by)
            row_data = analise.model_dump(exclude={'liked_by', 'disliked_by', 'neutral_by'})

            # Garante que processed_at está em formato ISO
            if "processed_at" in row_data and isinstance(row_data["processed_at"], str):
                # Já está em string ISO, mantém como está
                pass
            elif "processed_at" in row_data:
                # Converte para string ISO se necessário
                row_data["processed_at"] = row_data["processed_at"].isoformat()

            final_message_text = row_data.get('full_combined_text')
            if final_message_text:
                embeddings = self._embed_text(final_message_text)
                if embeddings:
                    row_data['embedding'] = embeddings

            # Insere no BigQuery
            errors = self.client.insert_rows_json(
                table=self.full_table_id,
                json_rows=[row_data]
            )

            if errors:
                print(f"❌ Erro ao inserir no BigQuery: {errors}")
                return False

            # Invalidate all caches on new analysis
            self._stats_cache = None
            self._dashboard_cache.clear()
            self._dashboard_cache_order.clear()
            self._sources_cache.clear()
            self._sources_cache_order.clear()
            self._recommendations_cache.clear()
            self._recommendations_cache_order.clear()

            print(f"✅ Análise {analise.document_id} inserida no BigQuery com sucesso!")
            return True

        except Exception as e:
            print(f"❌ Exceção ao inserir no BigQuery: {e}")
            return False

    def get_analise(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Busca uma análise no BigQuery pelo document_id.

        Args:
            document_id: ID único do documento

        Returns:
            Dict com os dados da análise ou None se não encontrado
        """
        try:
            query = f"""
                SELECT *
                FROM `{self.full_table_id}`
                WHERE document_id = @document_id
                LIMIT 1
            """

            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("document_id", "STRING", document_id)
                ]
            )

            query_job = self.client.query(query, job_config=job_config)
            results = list(query_job.result())

            if not results:
                print(f"⚠️  Análise {document_id} não encontrada no BigQuery")
                return None

            # Converte Row para dict
            row = results[0]
            data = dict(row.items())

            # Converte datetime para string ISO (BigQuery retorna datetime objects)
            data = self._convert_datetimes_to_strings(data)

            print(f"✅ Análise {document_id} encontrada no BigQuery")
            return data

        except exceptions.NotFound:
            print(f"⚠️  Tabela {self.full_table_id} não encontrada")
            return None
        except Exception as e:
            print(f"❌ Erro ao buscar análise {document_id}: {e}")
            return None

    def _convert_datetimes_to_strings(self, data: Any) -> Any:
        """
        Converte recursivamente objetos datetime para strings ISO.
        BigQuery retorna datetime objects que precisam ser convertidos.

        Args:
            data: Dados a serem convertidos (dict, list, ou valor)

        Returns:
            Dados com datetimes convertidos para strings ISO
        """
        if isinstance(data, datetime):
            return data.isoformat()
        elif isinstance(data, dict):
            return {k: self._convert_datetimes_to_strings(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._convert_datetimes_to_strings(item) for item in data]
        else:
            return data

    def analise_exists(self, document_id: str) -> bool:
        """
        Verifica se uma análise já existe no BigQuery.

        Args:
            document_id: ID único do documento

        Returns:
            True se existe, False caso contrário
        """
        try:
            query = f"""
                SELECT COUNT(*) as count
                FROM `{self.full_table_id}`
                WHERE document_id = @document_id
            """

            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("document_id", "STRING", document_id)
                ]
            )

            query_job = self.client.query(query, job_config=job_config)
            results = list(query_job.result())

            count = results[0]["count"] if results else 0
            return count > 0

        except Exception as e:
            print(f"❌ Erro ao verificar existência de {document_id}: {e}")
            return False

    def delete_analise(self, document_id: str) -> bool:
        """
        Remove uma análise do BigQuery.
        Necessário para resolver inconsistências ou limpeza.

        Args:
            document_id: ID do documento a ser removido

        Returns:
            True se sucesso, False se erro
        """
        try:
            # BigQuery DELETE DML
            query = f"""
                DELETE FROM `{self.full_table_id}`
                WHERE document_id = @document_id
            """

            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("document_id", "STRING", document_id)
                ]
            )

            query_job = self.client.query(query, job_config=job_config)
            query_job.result() # Wait for job to complete

            print(f"✅ Análise {document_id} removida do BigQuery com sucesso!")
            return True

        except Exception as e:
            print(f"❌ Erro ao deletar do BigQuery: {e}")
            return False

    def get_stats(self) -> Optional[Dict[str, Any]]:
        """
        Retorna estatísticas gerais das análises.
        Utiliza cache in-memory com TTL de 5 minutos.

        Returns:
            Dict com:
            - total_verificacoes: número total de análises
            - total_afirmacoes: número total de claims
            - percentual_falso: percentual de claims falsas
        """
        t0 = time.perf_counter()
        try:
            # Check cache
            if self._stats_cache is not None and (time.perf_counter() - self._stats_cache_time) < self._stats_cache_ttl:
                elapsed = time.perf_counter() - t0
                print(f"⚡ get_stats() served from cache in {elapsed:.4f}s")
                return self._stats_cache

            query = f"""
                WITH claims_data AS (
                    SELECT
                        document_id,
                        claim
                    FROM `{self.full_table_id}`,
                    UNNEST(claims) AS claim
                )
                SELECT
                    COUNT(DISTINCT document_id) as total_verificacoes,
                    COUNT(*) as total_afirmacoes,
                    COUNTIF(UPPER(claim.verdict) IN ('FAKE', 'FALSO', 'FALSE')) as total_falsas
                FROM claims_data
            """

            query_job = self.client.query(query)
            results = list(query_job.result())

            if not results:
                return None

            row = results[0]
            total_verificacoes = row["total_verificacoes"]
            total_afirmacoes = row["total_afirmacoes"]
            total_falsas = row["total_falsas"]

            percentual_falso = (total_falsas / total_afirmacoes * 100) if total_afirmacoes > 0 else 0

            stats = {
                "total_verificacoes": total_verificacoes,
                "total_afirmacoes": total_afirmacoes,
                "percentual_falso": round(percentual_falso, 1)
            }

            # Update cache
            self._stats_cache = stats
            self._stats_cache_time = time.perf_counter()

            elapsed = time.perf_counter() - t0
            print(f"📊 get_stats() completed in {elapsed:.4f}s (BigQuery query): {stats}")
            return stats

        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"❌ get_stats() failed in {elapsed:.4f}s: {e}")
            return None

    @staticmethod
    def _cache_key(*args) -> str:
        """Generate a deterministic cache key from arbitrary arguments."""
        return json.dumps(args, sort_keys=True, default=str)

    def _lru_put(self, cache: Dict, order: List[str], max_size: int, key: str, value: Any) -> None:
        """Insert into an LRU cache dict, evicting oldest if over max_size."""
        cache[key] = value
        order.append(key)
        while len(order) > max_size:
            oldest = order.pop(0)
            cache.pop(oldest, None)

    def _build_filter_clause(self, filters: Dict[str, Any]) -> str:
        """
        Constrói a cláusula WHERE baseada nos filtros.
        """
        clauses = []

        # Filtro de busca (texto) - DEPRECATED
        # Search is now handled via VECTOR_SEARCH in list_analises and get_analytics_dashboard
        # This LIKE-based search is kept only for backward compatibility if search is in filters
        # but should not be used when semantic search is available
        if filters.get("search"):
            search = filters["search"].lower()
            # Note: This LIKE search is deprecated in favor of VECTOR_SEARCH
            # Busca em user_message_text, full_combined_text, e tópicos
            clauses.append(f"""
                (LOWER(user_message_text) LIKE '%{search}%'
                 OR LOWER(full_combined_text) LIKE '%{search}%'
                 OR EXISTS(
                     SELECT 1
                     FROM UNNEST(claims) c, UNNEST(c.topics) t
                     WHERE LOWER(t) LIKE '%{search}%'
                 ))
            """)

        # Filtro de tipo de mensagem
        msg_types = []
        if filters.get("message_type_whatsapp"):
            msg_types.append("'FromWhatsappGroup'")
        if filters.get("message_type_direct"):
            msg_types.append("'FromDirectMessage'")
        
        if msg_types:
            clauses.append(f"source_type IN ({', '.join(msg_types)})")
        elif "message_type_whatsapp" in filters or "message_type_direct" in filters:
            # Se filtros foram passados mas nenhum selecionado, não retorna nada
            clauses.append("1=0")

        # Filtro de modalidade (OR logic)
        modality_clauses = []
        if filters.get("modality_text"):
            modality_clauses.append("user_message_text IS NOT NULL AND LENGTH(user_message_text) > 0")
        if filters.get("modality_audio"):
            modality_clauses.append("media_info.has_audio = TRUE")
        if filters.get("modality_video"):
            modality_clauses.append("media_info.has_video = TRUE")
        if filters.get("modality_image"):
            modality_clauses.append("media_info.has_image = TRUE")
        
        if modality_clauses:
            clauses.append(f"({' OR '.join(modality_clauses)})")
        elif any(k.startswith("modality_") for k in filters.keys()):
             # Se filtros foram passados mas nenhum selecionado
            clauses.append("1=0")

        # Filtro por intervalo de datas (processed_at)
        # Aceita datetime ou string ISO.
        start_date = filters.get("start_date")
        end_date = filters.get("end_date")

        if start_date:
            if isinstance(start_date, datetime):
                start_date = start_date.isoformat()
            # CAST(processed_at AS TIMESTAMP) funciona tanto para coluna TIMESTAMP quanto STRING/DATETIME compatíveis
            clauses.append(f"CAST(processed_at AS TIMESTAMP) >= TIMESTAMP('{start_date}')")

        if end_date:
            if isinstance(end_date, datetime):
                end_date = end_date.isoformat()
            clauses.append(f"CAST(processed_at AS TIMESTAMP) <= TIMESTAMP('{end_date}')")

        # Filtro de resultado (overall_verdict) - REMOVIDO
        # Agora usamos filtros de porcentagem (analysis_metrics)
        # verdicts = []
        # if filters.get("result_fake"):
        #     verdicts.append("'FALSO'")
        # if filters.get("result_true"):
        #     verdicts.append("'VERDADEIRO'")
        # if filters.get("result_unknown"):
        #     verdicts.extend(["'CHECK'", "'UNVERIFIED'", "'DESCONHECIDO'"])

        # if verdicts:
        #     clauses.append(f"overall_verdict IN ({', '.join(verdicts)})")
        # elif any(k.startswith("result_") and k != "result_misleading" for k in filters.keys()):
        #      # Se filtros foram passados mas nenhum selecionado
        #     clauses.append("1=0")

        # Filtros de porcentagem (usando analysis_metrics)
        min_truth = filters.get("min_truth_score")
        max_truth = filters.get("max_truth_score")
        min_fake = filters.get("min_fake_score")
        max_fake = filters.get("max_fake_score")
        min_unverified = filters.get("min_unverified_score")
        max_unverified = filters.get("max_unverified_score")

        if min_truth is not None and min_truth > 0:
            clauses.append(f"analysis_metrics.truth_score >= {min_truth}")
        if max_truth is not None and max_truth < 100:
            clauses.append(f"analysis_metrics.truth_score <= {max_truth}")
        if min_fake is not None and min_fake > 0:
            clauses.append(f"analysis_metrics.fake_score >= {min_fake}")
        if max_fake is not None and max_fake < 100:
            clauses.append(f"analysis_metrics.fake_score <= {max_fake}")
        if min_unverified is not None and min_unverified > 0:
            clauses.append(f"analysis_metrics.unverified_score >= {min_unverified}")
        if max_unverified is not None and max_unverified < 100:
            clauses.append(f"analysis_metrics.unverified_score <= {max_unverified}")

        # Filtros de porcentagem: fora de contexto
        min_ooc = filters.get("min_out_of_context_score")
        max_ooc = filters.get("max_out_of_context_score")

        if min_ooc is not None and min_ooc > 0:
            clauses.append(f"analysis_metrics.out_of_context_score >= {min_ooc}")
        if max_ooc is not None and max_ooc < 100:
            clauses.append(f"analysis_metrics.out_of_context_score <= {max_ooc}")

        return " AND ".join(clauses) if clauses else "1=1"

    # Columns to project in list queries — excludes embedding (3072 floats),
    # scraped_links (large arrays) and full_combined_text (long text).
    _BQ_LIST_COLUMNS = (
        "document_id, processed_at, source_type, analysis_title, "
        "user_message_text, overall_verdict, media_info, analysis_metrics, "
        "claims, final_comment"
    )

    def list_analises(self, limit: int = 5, offset: int = 0, filters: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Lista análises com paginação e filtros.
        """
        t0 = time.perf_counter()
        try:
            filters = filters or {}

            # Check if semantic search is needed
            has_search = bool(filters.get("search"))

            if has_search:
                # Use VECTOR_SEARCH for semantic similarity
                query_text = filters["search"]
                query_embedding = self._embed_text(query_text)

                # Tune for speed; caller accepts fewer results.
                # COSINE distance: smaller is more similar.
                top_k = 200
                max_distance = 0.45

                # Build WHERE clause without search (other filters only)
                non_semantic_filters = {k: v for k, v in filters.items() if k != "search"}
                where_clause = self._build_filter_clause(non_semantic_filters)

                print(f"🔍 Using VECTOR_SEARCH for semantic search: '{query_text}'")

                # Query with VECTOR_SEARCH
                # OFFSET isn't supported; we fetch a sufficiently large TOP-K and paginate in memory.
                # Safety cap avoids runaway queries.
                query = f"""
                    SELECT {', '.join(f'base.{c.strip()}' for c in self._BQ_LIST_COLUMNS.split(','))}, distance
                    FROM VECTOR_SEARCH(
                        (SELECT * FROM `{self.full_table_id}` WHERE {where_clause} AND embedding IS NOT NULL AND ARRAY_LENGTH(embedding) > 0),
                        'embedding',
                        (SELECT @query_emb AS prompt_embedding),
                        top_k => {top_k},
                        distance_type => 'COSINE'
                    )
                    WHERE distance <= @max_distance
                    ORDER BY distance ASC, processed_at DESC
                """

                job_config = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ArrayQueryParameter("query_emb", "FLOAT64", query_embedding),
                        bigquery.ScalarQueryParameter("max_distance", "FLOAT64", max_distance),
                    ]
                )

                query_job = self.client.query(query, job_config=job_config)
                all_results = list(query_job.result())

                # Apply offset and limit in memory
                total = len(all_results)
                results = all_results[offset:offset + limit]

            else:
                # Use traditional WHERE clause for non-semantic filters
                where_clause = self._build_filter_clause(filters)
                print(f"🔍 WHERE clause: {where_clause}")

                # Single query: projected columns + COUNT(*) OVER() for total
                query = f"""
                    SELECT {self._BQ_LIST_COLUMNS}, COUNT(*) OVER() AS _total_count
                    FROM `{self.full_table_id}`
                    WHERE {where_clause}
                    ORDER BY processed_at DESC
                    LIMIT @limit
                    OFFSET @offset
                """

                job_config = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ScalarQueryParameter("limit", "INT64", limit),
                        bigquery.ScalarQueryParameter("offset", "INT64", offset)
                    ]
                )

                query_job = self.client.query(query, job_config=job_config)
                results = list(query_job.result())

                # Extract total from the first row's window function
                if results:
                    total = results[0]["_total_count"]
                else:
                    total = 0

            # Converte resultados para lista de dicts
            items = []
            for row in results:
                data = dict(row.items())
                data = self._convert_datetimes_to_strings(data)
                # Remove internal/extra columns
                data.pop("distance", None)
                data.pop("_total_count", None)

                metrics = data.get("analysis_metrics")
                if isinstance(metrics, dict):
                    for key in (
                        "true_count",
                        "fake_count",
                        "unverified_count",
                        "out_of_context_count",
                        "truth_score",
                        "fake_score",
                        "unverified_score",
                        "out_of_context_score",
                    ):
                        if metrics.get(key) is None:
                            metrics[key] = 0
                        else:
                            try:
                                metrics[key] = int(metrics.get(key))
                            except Exception:
                                metrics[key] = 0
                    data["analysis_metrics"] = metrics

                items.append(data)

            response = {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset
            }

            elapsed = time.perf_counter() - t0
            path_label = "VECTOR_SEARCH" if has_search else "WHERE (single query)"
            print(f"⏱️ list_analises() {path_label} in {elapsed:.4f}s — {len(items)} items, total={total}")
            return response

        except Exception as e:
            elapsed = time.perf_counter() - t0
            embedding_info = ""
            if has_search:
                embedding_info = f" | query_embedding_dim={len(query_embedding)}, expected_table_dim=3072"
            print(f"❌ list_analises() failed in {elapsed:.4f}s: {type(e).__name__}: {e}{embedding_info}")
            return None

    def get_analytics_dashboard(self, filters: Dict[str, Any] = None, k_results:int = 200) -> Optional[Dict[str, Any]]:
        t0 = time.perf_counter()
        try:
            filters = filters or {}

            # Check dashboard cache
            cache_key = self._cache_key("dashboard", filters, k_results)
            cached = self._dashboard_cache.get(cache_key)
            if cached is not None:
                value, ts = cached
                if (time.perf_counter() - ts) < self._dashboard_cache_ttl:
                    elapsed = time.perf_counter() - t0
                    print(f"⚡ get_analytics_dashboard() served from cache in {elapsed:.4f}s")
                    return value
                else:
                    self._dashboard_cache.pop(cache_key, None)

            non_semantic_filters = {k: v for k, v in filters.items() if k != "search"}
            where_clause = self._build_filter_clause(non_semantic_filters)

            query_parameters = []

            has_search = bool(filters.get("search"))
            if has_search:
                query_text = filters["search"]
                query_embedding = self._embed_text(query_text)

                max_distance = 0.45

                filtered_analyses_base = f"""
                    (
                        SELECT base.*
                        FROM VECTOR_SEARCH(
                            (SELECT * FROM `{self.full_table_id}` WHERE {where_clause} AND embedding IS NOT NULL AND ARRAY_LENGTH(embedding) > 0),
                            'embedding',
                            (SELECT @query_emb AS prompt_embedding),
                            top_k => {k_results},
                            distance_type => 'COSINE'
                        )
                        WHERE distance <= @max_distance
                    )
                """

                from google.cloud import bigquery
                query_parameters.append(
                    bigquery.ArrayQueryParameter("query_emb", "FLOAT64", query_embedding)
                )
                query_parameters.append(
                    bigquery.ScalarQueryParameter("max_distance", "FLOAT64", max_distance)
                )
            else:
                filtered_analyses_base = f"""
                    (
                        SELECT *
                        FROM `{self.full_table_id}`
                        WHERE {where_clause}
                    )
                """

            query = f"""
                WITH filtered_analyses AS {filtered_analyses_base},
                claims_unpacked AS (
                    SELECT 
                        c.verdict AS claim_verdict
                    FROM filtered_analyses,
                        UNNEST(claims) AS c
                ),
                all_sources AS (
                    SELECT source.url AS source_url
                    FROM filtered_analyses,
                        UNNEST(claims) AS c,
                        UNNEST(c.sources) AS source
                )
                SELECT
                    -- stats
                    (SELECT COUNT(*) FROM filtered_analyses) AS total_messages,
                    (SELECT COUNT(*) FROM claims_unpacked) AS total_claims,
                    (SELECT COUNTIF(UPPER(claim_verdict) IN ('FAKE', 'FALSO', 'FALSE')) FROM claims_unpacked) AS count_fake,
                    (SELECT COUNTIF(UPPER(claim_verdict) IN ('TRUE', 'VERDADEIRO', 'VERDADE')) FROM claims_unpacked) AS count_true,
                    (SELECT COUNTIF(UPPER(claim_verdict) IN ('UNKNOWN', 'CHECK', 'UNVERIFIED', 'DESCONHECIDO', 'FONTES INSUFICIENTES', 'INSUFFICIENT_RESOURCES', 'MISLEADING', 'ENGANOSO')) FROM claims_unpacked) AS count_unverifiable,
                    (SELECT COUNTIF(UPPER(claim_verdict) IN ('FORA_DE_CONTEXTO', 'FORA DE CONTEXTO', 'OUT_OF_CONTEXT', 'OUT OF CONTEXT')) FROM claims_unpacked) AS count_out_of_context,

                    -- modalities
                    (SELECT COUNTIF(user_message_text IS NOT NULL AND LENGTH(user_message_text) > 0)
                    FROM filtered_analyses) AS count_text,
                    (SELECT COUNTIF(media_info.has_audio = TRUE)
                    FROM filtered_analyses) AS count_audio,
                    (SELECT COUNTIF(media_info.has_video = TRUE)
                    FROM filtered_analyses) AS count_video,
                    (SELECT COUNTIF(media_info.has_image = TRUE)
                    FROM filtered_analyses) AS count_image,

                    -- top sources as array of structs
                    ARRAY(
                    SELECT AS STRUCT source_url AS source, COUNT(*) AS count
                    FROM all_sources
                    WHERE source_url IS NOT NULL
                    GROUP BY source_url
                    ORDER BY count DESC
                    LIMIT 20
                    ) AS top_sources
            """

            from google.cloud import bigquery
            job_config = bigquery.QueryJobConfig(
                query_parameters=query_parameters
            ) if query_parameters else None

            job = self.client.query(query, job_config=job_config)
            rows = list(job.result())

            if not rows:
                return {
                    "total_messages": 0,
                    "total_claims": 0,
                    "total_out_of_context_claims": 0,
                    "results_distribution": [
                        {"name": "Falso", "value": 0},
                        {"name": "Verdadeiro", "value": 0},
                        {"name": "Fontes insuficientes para verificar", "value": 0},
                    ],
                    "modalities_distribution": [
                        {"name": "Texto", "value": 0},
                        {"name": "Áudio", "value": 0},
                        {"name": "Vídeo", "value": 0},
                        {"name": "Imagem", "value": 0},
                    ],
                    "top_sources": [],
                }

            row = rows[0]
            top_sources = row["top_sources"] or []

            dashboard_data = {
                "total_messages": row["total_messages"],
                "total_claims": row["total_claims"],
                "total_out_of_context_claims": row["count_out_of_context"],
                "results_distribution": [
                    {"name": "Falso", "value": row["count_fake"]},
                    {"name": "Verdadeiro", "value": row["count_true"]},
                    {"name": "Fontes insuficientes para verificar", "value": row["count_unverifiable"]},
                ],
                "modalities_distribution": [
                    {"name": "Texto", "value": row["count_text"]},
                    {"name": "Áudio", "value": row["count_audio"]},
                    {"name": "Vídeo", "value": row["count_video"]},
                    {"name": "Imagem", "value": row["count_image"]},
                ],
                "top_sources": [
                    {"source": s["source"], "count": s["count"]}
                    for s in top_sources
                ],
            }

            # Store in cache
            self._lru_put(
                self._dashboard_cache, self._dashboard_cache_order,
                self._dashboard_cache_max, cache_key,
                (dashboard_data, time.perf_counter()),
            )

            elapsed = time.perf_counter() - t0
            print(f"📊 get_analytics_dashboard() completed in {elapsed:.4f}s (BigQuery query)")
            return dashboard_data

        except Exception as e:
            elapsed = time.perf_counter() - t0
            embedding_info = ""
            if has_search:
                embedding_info = f" | query_embedding_dim={len(query_embedding)}, expected_table_dim=3072"
            print(f"❌ get_analytics_dashboard() failed in {elapsed:.4f}s: {type(e).__name__}: {e}{embedding_info}")
            return None

    def list_sources(self, limit: int = 10, offset: int = 0, filters: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Lista fontes com paginação e filtros.
        """
        t0 = time.perf_counter()
        try:
            filters = filters or {}

            # Check sources cache
            cache_key = self._cache_key("sources", filters, limit, offset)
            cached = self._sources_cache.get(cache_key)
            if cached is not None:
                value, ts = cached
                if (time.perf_counter() - ts) < self._sources_cache_ttl:
                    elapsed = time.perf_counter() - t0
                    print(f"⚡ list_sources() served from cache in {elapsed:.4f}s")
                    return value
                else:
                    self._sources_cache.pop(cache_key, None)

            has_search = bool(filters.get("search"))

            query_parameters = []

            if has_search:
                # Semantic search over analyses content (same behavior as list_analises)
                query_text = filters["search"]
                query_embedding = self._embed_text(query_text)

                top_k = 200
                max_distance = 0.45

                non_semantic_filters = {k: v for k, v in filters.items() if k != "search"}
                where_clause = self._build_filter_clause(non_semantic_filters)

                filtered_analyses_query = f"""
                    SELECT base.*
                    FROM VECTOR_SEARCH(
                        (SELECT * FROM `{self.full_table_id}` WHERE {where_clause} AND embedding IS NOT NULL AND ARRAY_LENGTH(embedding) > 0),
                        'embedding',
                        (SELECT @query_emb AS prompt_embedding),
                        top_k => {top_k},
                        distance_type => 'COSINE'
                    )
                    WHERE distance <= @max_distance
                """

                query_parameters.append(
                    bigquery.ArrayQueryParameter("query_emb", "FLOAT64", query_embedding)
                )
                query_parameters.append(
                    bigquery.ScalarQueryParameter("max_distance", "FLOAT64", max_distance)
                )
            else:
                where_clause = self._build_filter_clause(filters)
                filtered_analyses_query = f"""
                    SELECT *
                    FROM `{self.full_table_id}`
                    WHERE {where_clause}
                """

            # Query para extrair, agrupar e contar fontes
            # Usamos uma CTE para primeiro filtrar as análises, depois explodir as fontes
            query = f"""
                WITH filtered_analyses AS (
                    {filtered_analyses_query}
                ),
                all_sources AS (
                    SELECT source.url AS source_url
                    FROM filtered_analyses,
                    UNNEST(claims) AS c,
                    UNNEST(c.sources) AS source
                    WHERE source.url IS NOT NULL AND source.url != ''
                ),
                source_counts AS (
                    SELECT source_url, COUNT(*) as count
                    FROM all_sources
                    GROUP BY source_url
                )
                SELECT *
                FROM source_counts
                ORDER BY count DESC
                LIMIT @limit
                OFFSET @offset
            """
            
            # Query para contar o total de fontes únicas (para paginação)
            count_query = f"""
                WITH filtered_analyses AS (
                    {filtered_analyses_query}
                ),
                all_sources AS (
                    SELECT source.url AS source_url
                    FROM filtered_analyses,
                    UNNEST(claims) AS c,
                    UNNEST(c.sources) AS source
                    WHERE source.url IS NOT NULL AND source.url != ''
                )
                SELECT COUNT(DISTINCT source_url) as total
                FROM all_sources
            """

            # Executa count
            count_job = self.client.query(
                count_query,
                job_config=bigquery.QueryJobConfig(query_parameters=query_parameters) if query_parameters else None,
            )
            count_results = list(count_job.result())
            total = count_results[0]["total"] if count_results else 0

            # Executa listagem
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    *query_parameters,
                    bigquery.ScalarQueryParameter("limit", "INT64", limit),
                    bigquery.ScalarQueryParameter("offset", "INT64", offset),
                ]
            )

            query_job = self.client.query(query, job_config=job_config)
            results = list(query_job.result())

            items = []
            for row in results:
                items.append({
                    "source": row["source_url"],
                    "count": row["count"]
                })

            result = {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset
            }

            # Store in cache
            self._lru_put(
                self._sources_cache, self._sources_cache_order,
                self._sources_cache_max, cache_key,
                (result, time.perf_counter()),
            )

            elapsed = time.perf_counter() - t0
            print(f"⏱️ list_sources() completed in {elapsed:.4f}s (BigQuery query)")
            return result

        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"❌ list_sources() failed in {elapsed:.4f}s: {e}")
            return None

    def get_similar_analyses(self, document_id: str, limit: int = 8) -> Optional[List[Dict[str, Any]]]:
        """
        Busca análises similares baseado nos tópicos IPTC.
        Rankeia por nível de especificidade: primeiro busca tópicos de nível mais baixo (mais específicos),
        depois vai subindo na hierarquia IPTC para tópicos mais gerais.

        Args:
            document_id: ID do documento para buscar similares
            limit: Número máximo de resultados (default: 8)

        Returns:
            Lista de análises similares ordenadas por relevância, ou None em caso de erro
        """
        t0 = time.perf_counter()
        cache_key = f"{document_id}:{limit}"

        # Check cache
        cached = self._recommendations_cache.get(cache_key)
        if cached:
            data, ts = cached
            if (time.perf_counter() - ts) < self._recommendations_cache_ttl:
                elapsed = time.perf_counter() - t0
                print(f"⚡ get_similar_analyses({document_id}) cache HIT in {elapsed:.4f}s ({len(data)} results)")
                return data
            else:
                self._recommendations_cache.pop(cache_key, None)

        try:
            # 1. Buscar a análise original e extrair seus tópicos IPTC
            original = self.get_analise(document_id)
            if not original:
                print(f"⚠️  Análise original {document_id} não encontrada")
                return []

            # Extrair todos os tópicos de todas as claims
            all_topics = []
            for claim in original.get("claims", []):
                topics = claim.get("topics", [])
                all_topics.extend(topics)

            if not all_topics:
                print(f"⚠️  Análise {document_id} não possui tópicos IPTC")
                return []

            # 2. Normalizar e organizar tópicos por nível hierárquico
            # Tópicos IPTC seguem padrão: "categoria > subcategoria > tópico específico"
            # Exemplo: "política > eleições > campanha eleitoral"
            topics_by_level = {}
            for topic in set(all_topics):  # Remove duplicatas
                parts = topic.split(" > ")
                level = len(parts)
                if level not in topics_by_level:
                    topics_by_level[level] = []
                topics_by_level[level].append(topic)

            # 3. Construir query que busca por tópicos, priorizando níveis mais específicos
            # Vamos criar uma pontuação onde tópicos mais específicos (maior nível) têm maior peso
            max_level = max(topics_by_level.keys()) if topics_by_level else 0
            
            # Construir condições de matching para cada nível
            level_conditions = []
            for level in sorted(topics_by_level.keys(), reverse=True):  # Do mais específico ao mais geral
                topics_at_level = topics_by_level[level]
                # Peso: níveis mais específicos têm pontuação maior
                weight = level
                
                # Para cada tópico neste nível, verificar se existe em alguma claim
                topic_checks = []
                for topic in topics_at_level:
                    topic_escaped = topic.replace("'", "\\'")
                    topic_checks.append(f"'{topic_escaped}' IN UNNEST(c.topics)")
                
                if topic_checks:
                    condition = " OR ".join(topic_checks)
                    level_conditions.append(f"WHEN ({condition}) THEN {weight}")

            if not level_conditions:
                return []

            # 4. Query que calcula score de similaridade e ordena
            query = f"""
                WITH topic_matches AS (
                    SELECT 
                        a.document_id,
                        a.analysis_title,
                        a.overall_verdict,
                        a.processed_at,
                        a.analysis_metrics,
                        c.topics as claim_topics,
                        CASE
                            {chr(10).join(level_conditions)}
                            ELSE 0
                        END as match_score
                    FROM `{self.full_table_id}` a,
                    UNNEST(a.claims) as c
                    WHERE a.document_id != @document_id
                ),
                aggregated_scores AS (
                    SELECT
                        document_id,
                        analysis_title,
                        overall_verdict,
                        processed_at,
                        analysis_metrics,
                        SUM(match_score) as total_score,
                        MAX(match_score) as max_level_match
                    FROM topic_matches
                    WHERE match_score > 0
                    GROUP BY document_id, analysis_title, overall_verdict, processed_at, analysis_metrics
                )
                SELECT *
                FROM aggregated_scores
                ORDER BY max_level_match DESC, total_score DESC, processed_at DESC
                LIMIT @limit
            """

            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("document_id", "STRING", document_id),
                    bigquery.ScalarQueryParameter("limit", "INT64", limit)
                ]
            )

            query_job = self.client.query(query, job_config=job_config)
            results = list(query_job.result())

            # 5. Converter resultados para formato esperado
            similar_analyses = []
            for row in results:
                data = dict(row.items())
                data = self._convert_datetimes_to_strings(data)
                similar_analyses.append(data)

            # Store in cache
            self._lru_put(
                self._recommendations_cache, self._recommendations_cache_order,
                self._recommendations_cache_max, cache_key,
                (similar_analyses, time.perf_counter()),
            )

            elapsed = time.perf_counter() - t0
            print(f"✅ get_similar_analyses({document_id}) cache MISS in {elapsed:.4f}s ({len(similar_analyses)} results)")
            return similar_analyses

        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"❌ Erro ao buscar análises similares in {elapsed:.4f}s: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_all_ids(self) -> List[str]:
        """
        Retorna todos os document_ids da tabela.
        Útil para verificação de chaves e consistência.
        """
        try:
            query = f"SELECT document_id FROM `{self.full_table_id}`"
            query_job = self.client.query(query)
            results = list(query_job.result())
            return [row.document_id for row in results]
        except Exception as e:
            print(f"❌ Erro ao buscar todos os IDs no BigQuery: {e}")
            return []

    def semantic_search(self, query:str):
        pass

    def _embed_text(self,text:str)->list[float]:
        key = (text or "").strip().lower()
        if not key:
            return []

        cached = self._embedding_cache.get(key)
        if cached is not None:
            return cached

        resp = self.google_genai_client.models.embed_content(
            model="gemini-embedding-001",
            contents=[text],
            config=EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )

        vector = resp.embeddings[0].values  # list[float]

        self._embedding_cache[key] = vector
        self._embedding_cache_order.append(key)
        if len(self._embedding_cache_order) > self._embedding_cache_max:
            oldest = self._embedding_cache_order.pop(0)
            self._embedding_cache.pop(oldest, None)

        return vector
# Instância global
bigquery_service = BigQueryService()
