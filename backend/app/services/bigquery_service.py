import os
from typing import Optional, Dict, Any
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
            # Exclui campos que não existem no BigQuery (liked_by, disliked_by)
            row_data = analise.model_dump(exclude={'liked_by', 'disliked_by'})

            # Garante que processed_at está em formato ISO
            if "processed_at" in row_data and isinstance(row_data["processed_at"], str):
                # Já está em string ISO, mantém como está
                pass
            elif "processed_at" in row_data:
                # Converte para string ISO se necessário
                row_data["processed_at"] = row_data["processed_at"].isoformat()

            final_message_text = row_data.get('full_combined_text')
            if final_message_text is not None:
                embeddings = self._embed_text(final_message_text)
                row_data['embedding'] = embeddings

            # Insere no BigQuery
            errors = self.client.insert_rows_json(
                table=self.full_table_id,
                json_rows=[row_data]
            )

            if errors:
                print(f"❌ Erro ao inserir no BigQuery: {errors}")
                return False

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

    def get_stats(self) -> Optional[Dict[str, Any]]:
        """
        Retorna estatísticas gerais das análises.

        Returns:
            Dict com:
            - total_verificacoes: número total de análises
            - total_afirmacoes: número total de claims
            - percentual_falso: percentual de claims falsas
        """
        try:
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

            print(f"📊 Estatísticas calculadas: {stats}")
            return stats

        except Exception as e:
            print(f"❌ Erro ao buscar estatísticas: {e}")
            return None

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

        if min_truth is not None and min_truth > 0:
            clauses.append(f"analysis_metrics.truth_score >= {min_truth}")
        if max_truth is not None and max_truth < 100:
            clauses.append(f"analysis_metrics.truth_score <= {max_truth}")
        if min_fake is not None and min_fake > 0:
            clauses.append(f"analysis_metrics.fake_score >= {min_fake}")
        if max_fake is not None and max_fake < 100:
            clauses.append(f"analysis_metrics.fake_score <= {max_fake}")

        return " AND ".join(clauses) if clauses else "1=1"

    def list_analises(self, limit: int = 5, offset: int = 0, filters: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Lista análises com paginação e filtros.
        """
        try:
            filters = filters or {}

            # Check if semantic search is needed
            has_search = bool(filters.get("search"))

            if has_search:
                # Use VECTOR_SEARCH for semantic similarity
                query_text = filters["search"]
                query_embedding = self._embed_text(query_text)

                # Build WHERE clause without search (other filters only)
                non_semantic_filters = {k: v for k, v in filters.items() if k != "search"}
                where_clause = self._build_filter_clause(non_semantic_filters)

                print(f"🔍 Using VECTOR_SEARCH for semantic search: '{query_text}'")

                # Query with VECTOR_SEARCH
                # Note: VECTOR_SEARCH doesn't support traditional OFFSET, so we need a workaround
                # We'll fetch more results and slice them in memory
                # Using same pattern as get_analytics_dashboard
                # we will use limit for the TOP-K results in vector search
                query = f"""
                    SELECT base.*
                    FROM VECTOR_SEARCH(
                        (SELECT * FROM `{self.full_table_id}` WHERE {where_clause}),
                        'embedding',
                        (SELECT @query_emb AS prompt_embedding),
                        top_k => {limit},
                        distance_type => 'COSINE'
                    )
                    ORDER BY processed_at DESC
                """

                job_config = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ArrayQueryParameter("query_emb", "FLOAT64", query_embedding)
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

                # Query para contar total com filtros
                count_query = f"""
                    SELECT COUNT(*) as total
                    FROM `{self.full_table_id}`
                    WHERE {where_clause}
                """

                count_job = self.client.query(count_query)
                count_results = list(count_job.result())
                total = count_results[0]["total"] if count_results else 0

                # Query para buscar análises paginadas com filtros
                query = f"""
                    SELECT *
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

            # Converte resultados para lista de dicts
            items = []
            for row in results:
                data = dict(row.items())
                data = self._convert_datetimes_to_strings(data)
                items.append(data)

            response = {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset
            }

            print(f"📄 Listagem: {len(items)} análises (total filtrado: {total})")
            return response

        except Exception as e:
            print(f"❌ Erro ao listar análises: {e}")
            return None

    def get_analytics_dashboard(self, filters: Dict[str, Any] = None, k_results:int = 10) -> Optional[Dict[str, Any]]:
        try:
            filters = filters or {}

            non_semantic_filters = {k: v for k, v in filters.items() if k != "search"}
            where_clause = self._build_filter_clause(non_semantic_filters)

            query_parameters = []

            has_search = bool(filters.get("search"))
            if has_search:
                query_text = filters["search"]
                query_embedding = self._embed_text(query_text)

                filtered_analyses_base = f"""
                    (
                        SELECT
                        base.*
                        FROM VECTOR_SEARCH(
                            (SELECT * FROM `{self.full_table_id}` WHERE {where_clause}),
                            'embedding',
                            (SELECT @query_emb AS prompt_embedding),
                            top_k => {k_results},
                            distance_type => 'COSINE'
                        )
                    )
                """

                from google.cloud import bigquery
                query_parameters.append(
                    bigquery.ArrayQueryParameter("query_emb", "FLOAT64", query_embedding)
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

            print("📊 Dashboard data calculated")
            return dashboard_data

        except Exception as e:
            print(f"❌ Erro ao gerar dashboard analytics: {e}")
            return None

    def list_sources(self, limit: int = 10, offset: int = 0, filters: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Lista fontes com paginação e filtros.
        """
        try:
            filters = filters or {}
            
            # Remove search do filtro padrão pois vamos tratar diferente para fontes
            # Se o search for para buscar NOME da fonte, precisamos ajustar.
            # Por enquanto, vamos assumir que os filtros filtram as ANÁLISES, e listamos as fontes dessas análises.
            
            where_clause = self._build_filter_clause(filters)
            
            # Query base para filtrar análises
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
            count_job = self.client.query(count_query)
            count_results = list(count_job.result())
            total = count_results[0]["total"] if count_results else 0

            # Executa listagem
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("limit", "INT64", limit),
                    bigquery.ScalarQueryParameter("offset", "INT64", offset)
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

            return {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset
            }

        except Exception as e:
            print(f"❌ Erro ao listar fontes: {e}")
            return None

    def semantic_search(self, query:str):
        pass

    def _embed_text(self,text:str)->list[float]:
        resp = self.google_genai_client.models.embed_content(
            model="gemini-embedding-001",
            contents=[text],
            config=EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )

        vector = resp.embeddings[0].values  # list[float]
        return vector
# Instância global
bigquery_service = BigQueryService()
