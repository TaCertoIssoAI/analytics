import os
from typing import Optional, Dict, Any
from google.cloud import bigquery
from google.api_core import exceptions
from datetime import datetime

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

        print(f"📊 BigQuery client inicializado:")
        print(f"   Project: {settings.PROJECT_ID}")
        print(f"   Dataset: {settings.DATASET_ID}")
        print(f"   Table: {settings.TABLE_ID}")

    def insert_analise(self, analise: AnaliseNewFormat) -> bool:
        """
        Insere uma análise no BigQuery.

        Args:
            analise: Análise no formato novo (AnaliseNewFormat)

        Returns:
            True se sucesso, False se erro
        """
        try:
            # Converte Pydantic model para dict
            row_data = analise.model_dump()

            # Garante que processed_at está em formato ISO
            if "processed_at" in row_data and isinstance(row_data["processed_at"], str):
                # Já está em string ISO, mantém como está
                pass
            elif "processed_at" in row_data:
                # Converte para string ISO se necessário
                row_data["processed_at"] = row_data["processed_at"].isoformat()

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
                    COUNTIF(claim.verdict = 'Fake') as total_falsas
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

    def list_analises(self, limit: int = 10, offset: int = 0) -> Optional[Dict[str, Any]]:
        """
        Lista análises com paginação.

        Args:
            limit: Número máximo de resultados
            offset: Número de resultados a pular

        Returns:
            Dict com:
            - items: lista de análises
            - total: número total de análises
            - limit: limite usado
            - offset: offset usado
        """
        try:
            # Query para contar total
            count_query = f"""
                SELECT COUNT(*) as total
                FROM `{self.full_table_id}`
            """

            count_job = self.client.query(count_query)
            count_results = list(count_job.result())
            total = count_results[0]["total"] if count_results else 0

            # Query para buscar análises paginadas
            query = f"""
                SELECT *
                FROM `{self.full_table_id}`
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
                # Converte datetime para string ISO
                data = self._convert_datetimes_to_strings(data)
                items.append(data)

            response = {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset
            }

            print(f"📄 Listagem: {len(items)} análises (total: {total})")
            return response

        except Exception as e:
            print(f"❌ Erro ao listar análises: {e}")
            return None


# Instância global
bigquery_service = BigQueryService()
