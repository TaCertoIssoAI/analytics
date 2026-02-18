from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import csv
import io
from datetime import datetime

from app.models.input_format import AnaliseInputFormat
from app.models.new_format import AnaliseNewFormat
from app.models.responses import (
    AnaliseCreateResponse,
    AnaliseGetResponse,
    ErrorResponse
)
from app.services.transformer import transformer
from app.services.firestore_service import firestore_service
from app.services.bigquery_service import bigquery_service

# ... (imports)

# ... (inside create_analise)
from app.config import settings

router = APIRouter(prefix="/analises", tags=["Análises"])


@router.get(
    "/stats",
    summary="Obter estatísticas gerais",
    description="Retorna estatísticas agregadas de todas as análises"
)
async def get_stats() -> Dict[str, Any]:
    """
    Endpoint para obter estatísticas gerais.

    Returns:
        Dict com estatísticas:
        - total_verificacoes: número total de análises
        - total_afirmacoes: número total de claims
        - percentual_falso: percentual de claims falsas
    """
    try:
        print("\n" + "="*60)
        print("📊 Buscando estatísticas...")
        print("="*60)

        stats = bigquery_service.get_stats()

        if not stats:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar estatísticas"
            )

        print(f"✅ Estatísticas obtidas com sucesso!")
        print("="*60 + "\n")

        return {
            "success": True,
            "data": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar estatísticas: {e}")
        print("="*60 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get(
    "/dashboard",
    summary="Obter dados do dashboard",
    description="Retorna dados agregados para o dashboard com filtros opcionais"
)
async def get_dashboard(
    search: str = Query(None, description="Termo de busca"),
    start_date: Optional[datetime] = Query(None, description="Data/hora inicial (ISO 8601)"),
    end_date: Optional[datetime] = Query(None, description="Data/hora final (ISO 8601)"),
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_out_of_context_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de fora de contexto"),
    max_out_of_context_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de fora de contexto"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
    min_unverified_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de inverificável"),
    max_unverified_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de inverificável"),
) -> Dict[str, Any]:
    """
    Endpoint para obter dados do dashboard (gráficos e totais).
    """
    try:
        filters = {
            "search": search,
            "start_date": start_date,
            "end_date": end_date,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_out_of_context_score": min_out_of_context_score,
            "max_out_of_context_score": max_out_of_context_score,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
            "min_unverified_score": min_unverified_score,
            "max_unverified_score": max_unverified_score,
        }

        print("\n" + "="*60)
        print("📊 Buscando dados do dashboard...")
        print(f"   Filtros: {filters}")
        print("="*60)

        data = bigquery_service.get_analytics_dashboard(filters)

        if not data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar dados do dashboard"
            )

        return {
            "success": True,
            "data": data
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar dashboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get(
    "",
    summary="Listar análises",
    description="Lista análises com paginação e filtros"
)
async def list_analises(
    limit: int = Query(default=10, ge=1, le=100, description="Número de resultados por página"),
    offset: int = Query(default=0, ge=0, description="Número de resultados a pular"),
    search: str = Query(None, description="Termo de busca"),
    start_date: Optional[datetime] = Query(None, description="Data/hora inicial (ISO 8601)"),
    end_date: Optional[datetime] = Query(None, description="Data/hora final (ISO 8601)"),
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_out_of_context_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de fora de contexto"),
    max_out_of_context_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de fora de contexto"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
    min_unverified_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de inverificável"),
    max_unverified_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de inverificável"),
) -> Dict[str, Any]:
    """
    Endpoint para listar análises com paginação e filtros.
    """
    try:
        filters = {
            "search": search,
            "start_date": start_date,
            "end_date": end_date,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_out_of_context_score": min_out_of_context_score,
            "max_out_of_context_score": max_out_of_context_score,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
            "min_unverified_score": min_unverified_score,
            "max_unverified_score": max_unverified_score,
        }

        print("\n" + "="*60)
        print(f"📄 Listando análises (limit={limit}, offset={offset})...")
        print(f"   Filtros: {filters}")
        print("="*60)

        if search:
            # se tiver query de busca, usa big query para busca semântica
            result = bigquery_service.list_analises(limit=limit, offset=offset, filters=filters)
        else:
            # Usa Firestore em vez de BigQuery se não tiver busca semântica
            result = firestore_service.list_analises(limit=limit, offset=offset, filters=filters)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar análises"
            )

        # Converte cada item para AnaliseNewFormat
        items = []
        conversion_errors = []
        for item_data in result["items"]:
            try:
                analise = AnaliseNewFormat(**item_data)
                items.append(analise)
            except Exception as e:
                print(f"⚠️  Erro ao converter análise: {e}")
                conversion_errors.append(str(e))
                continue

        print(f"✅ {len(items)} análises listadas!")
        print("="*60 + "\n")

        return {
            "success": True,
            "data": {
                "items": items,
                "conversion_errors": conversion_errors,
                "total": result["total"],
                "limit": result["limit"],
                "offset": result["offset"],
                "has_more": (result["offset"] + len(items)) < result["total"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao listar análises: {e}")
        print("="*60 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get(
    "/sources",
    summary="Listar fontes",
    description="Lista fontes citadas com paginação e filtros"
)
async def list_sources(
    limit: int = Query(default=10, ge=1, le=100, description="Número de resultados por página"),
    offset: int = Query(default=0, ge=0, description="Número de resultados a pular"),
    search: str = Query(None, description="Termo de busca"),
    start_date: Optional[datetime] = Query(None, description="Data/hora inicial (ISO 8601)"),
    end_date: Optional[datetime] = Query(None, description="Data/hora final (ISO 8601)"),
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_out_of_context_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de fora de contexto"),
    max_out_of_context_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de fora de contexto"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
    min_unverified_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de inverificável"),
    max_unverified_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de inverificável"),
) -> Dict[str, Any]:
    """
    Endpoint para listar fontes com paginação.
    """
    try:
        filters = {
            "search": search,
            "start_date": start_date,
            "end_date": end_date,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_out_of_context_score": min_out_of_context_score,
            "max_out_of_context_score": max_out_of_context_score,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
            "min_unverified_score": min_unverified_score,
            "max_unverified_score": max_unverified_score,
        }

        print("\n" + "="*60)
        print(f"📚 Listando fontes (limit={limit}, offset={offset})...")
        print(f"   Filtros: {filters}")
        print("="*60)

        result = bigquery_service.list_sources(limit=limit, offset=offset, filters=filters)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar fontes"
            )

        print(f"✅ {len(result['items'])} fontes listadas!")
        print("="*60 + "\n")

        return {
            "success": True,
            "data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao listar fontes: {e}")
        print("="*60 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.post(
    "",
    response_model=AnaliseCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova análise",
    description="""
    Recebe uma análise no formato novo (snake_case, com ResponseByDataSource),
    converte para o formato interno, classifica tópicos,
    salva no BigQuery e retorna a URL de verificação.
    """
)
async def create_analise(analise_input: AnaliseInputFormat) -> AnaliseCreateResponse:
    """
    Endpoint para criar uma nova análise.

    Fluxo:
    1. Recebe AnaliseInputFormat do bot
    2. Transforma para AnaliseNewFormat
    3. Salva no BigQuery
    4. Retorna URL de verificação

    Args:
        analise_input: Análise no formato de entrada

    Returns:
        AnaliseCreateResponse com URL de verificação

    Raises:
        HTTPException 409: Se a análise já existe
        HTTPException 500: Se houver erro ao salvar
    """
    try:
        document_id = analise_input.DocumentId

        # Verifica se já existe
        if bigquery_service.analise_exists(document_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Análise {document_id} já existe no BigQuery"
            )

        print(f"\n{'='*60}")
        print(f"📥 Recebendo nova análise: {document_id}")
        print(f"{'='*60}")

        # Transforma para o formato novo
        print(f"🔄 Transformando análise...")
        analise_new = transformer.transform(analise_input)

        # Salva no BigQuery
        print(f"💾 Salvando no BigQuery...")
        success = bigquery_service.insert_analise(analise_new)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao salvar análise no BigQuery"
            )

        # Salva no Firestore (Backup / Fast Retrieval)
        print(f"🔥 Salvando no Firestore...")
        firestore_service.save_analise(analise_new)

        # Monta URL de verificação
        verification_url = f"{settings.VERIFICATION_URL_BASE}/{document_id}"

        print(f"✅ Análise criada com sucesso!")
        print(f"🔗 URL de verificação: {verification_url}")
        print(f"{'='*60}\n")

        return AnaliseCreateResponse(
            success=True,
            message="Análise criada com sucesso",
            document_id=document_id,
            verification_url=verification_url
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao criar análise: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao processar análise: {str(e)}"
        )


@router.get(
    "/{document_id}",
    response_model=AnaliseGetResponse,
    summary="Buscar análise por ID",
    description="""
    Busca uma análise no BigQuery pelo document_id.
    Este endpoint é usado pelo frontend para exibir a página de verificação.
    """
)
async def get_analise(document_id: str) -> AnaliseGetResponse:
    """
    Endpoint para buscar uma análise existente.

    Args:
        document_id: ID único do documento

    Returns:
        AnaliseGetResponse com os dados da análise

    Raises:
        HTTPException 404: Se a análise não for encontrada
        HTTPException 500: Se houver erro ao buscar
    """
    try:
        print(f"\n{'='*60}")
        print(f"🔍 Buscando análise: {document_id}")
        print(f"{'='*60}")

        # [MODIFIED] Busca no Firestore em vez de BigQuery
        data = firestore_service.get_analise(document_id)

        if not data:
            print(f"❌ Análise não encontrada")
            print(f"{'='*60}\n")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Análise {document_id} não encontrada"
            )

        # Converte dict para AnaliseNewFormat
        analise = AnaliseNewFormat(**data)

        print(f"✅ Análise encontrada!")
        print(f"📊 Veredito: {analise.overall_verdict}")
        print(f"📝 Claims: {len(analise.claims)}")
        print(f"{'='*60}\n")

        return AnaliseGetResponse(
            success=True,
            data=analise,
            message="Análise encontrada"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar análise: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao buscar análise: {str(e)}"
        )


@router.get(
    "/admin/search",
    summary="Buscar análise (Admin)",
    description="Busca análise por ID no BigQuery e Firestore para validação cruzada"
)
async def admin_search_analise(document_id: str = Query(..., description="ID do documento")):
    """
    Endpoint administrativo para buscar uma análise em ambas as fontes de dados.
    """
    try:
        print(f"\n{'='*60}")
        print(f"🔍 [Admin] Buscando análise: {document_id}")
        print(f"{'='*60}")

        # Busca no BigQuery
        bq_data = bigquery_service.get_analise(document_id)
        bq_exists = bq_data is not None

        # Busca no Firestore
        fs_data = firestore_service.get_analise(document_id)
        fs_exists = fs_data is not None

        # Dados consolidadados (mantendo retrocompatibilidade no campo 'analise' por enquanto, ou apenas removendo uso dele no front)
        # Vamos manter 'analise' como um fallback/consolidado, mas adicionar os campos específicos.
        analise_consolidada = bq_data if bq_exists else fs_data
        
        return {
            "success": True,
            "data": {
                "document_id": document_id,
                "bigquery_exists": bq_exists,
                "firestore_exists": fs_exists,
                "analise": analise_consolidada, # Depreciado, mas mantido por segurança
                "bigquery_data": bq_data,
                "firestore_data": fs_data
            }
        }

    except Exception as e:
        print(f"❌ Erro na busca administrativa: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get(
    "/admin/reviews",
    summary="Listar todas as reviews (Admin)",
    description="Retorna todas as reviews (likes/dislikes) de todos os usuários em todas as análises"
)
async def admin_list_reviews(
    action: Optional[str] = Query(None, description="Filtrar por tipo: 'like' ou 'dislike'"),
    has_observation: Optional[bool] = Query(None, description="Filtrar por presença de observação"),
    search: Optional[str] = Query(None, description="Busca textual por nome de usuário, título ou observação"),
    limit: int = Query(20, ge=1, le=100, description="Itens por página"),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
):
    """
    Endpoint administrativo para listar todas as reviews feitas por todos os usuários.
    Suporta filtros por tipo (positiva/negativa), presença de observação e busca textual.
    Paginado no servidor.
    """
    try:
        print(f"\n{'='*60}")
        print(f"📋 [Admin] Listando reviews (limit={limit}, offset={offset})...")
        print(f"{'='*60}")

        reviews = firestore_service.get_all_reviews()

        # Aplicar filtros
        if action:
            reviews = [r for r in reviews if r["action"] == action]

        if has_observation is not None:
            if has_observation:
                reviews = [r for r in reviews if r["has_custom_observation"] and r["observation"].strip()]
            else:
                reviews = [r for r in reviews if not r["has_custom_observation"] or not r["observation"].strip()]

        if search:
            term = search.lower()
            reviews = [r for r in reviews if
                       term in (r.get("user_name") or "").lower() or
                       term in (r.get("analysis_title") or "").lower() or
                       term in (r.get("observation") or "").lower()]

        total = len(reviews)
        paginated = reviews[offset:offset + limit]

        print(f"✅ {total} reviews no total, retornando {len(paginated)} (offset={offset})")
        return {
            "success": True,
            "data": {
                "reviews": paginated,
                "total": total,
                "limit": limit,
                "offset": offset
            }
        }

    except Exception as e:
        print(f"❌ Erro ao listar reviews: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get(
    "/admin/inconsistencies",
    summary="Verificar inconsistências (Admin)",
    description="Identifica análises que existem em apenas um dos bancos (BigQuery ou Firestore)"
)
async def check_inconsistencies():
    """
    Endpoint administrativo para verificar consistência entre bancos.
    """
    try:
        print(f"\n{'='*60}")
        print(f"🔍 [Admin] Verificando inconsistências...")
        print(f"{'='*60}")

        # Busca todos os IDs
        bq_ids = set(bigquery_service.get_all_ids())
        fs_ids = set(firestore_service.get_all_ids())

        print(f"📊 Total BigQuery: {len(bq_ids)}")
        print(f"🔥 Total Firestore: {len(fs_ids)}")

        # Calcula diferenças
        missing_in_firestore = list(bq_ids - fs_ids)
        missing_in_bigquery = list(fs_ids - bq_ids)

        inconsistencies = []

        # Formata resposta
        for doc_id in missing_in_firestore:
            inconsistencies.append({
                "document_id": doc_id,
                "issue": "Missing in Firestore",
                "source": "BigQuery"
            })
        
        for doc_id in missing_in_bigquery:
            inconsistencies.append({
                "document_id": doc_id,
                "issue": "Missing in BigQuery",
                "source": "Firestore"
            })

        print(f"⚠️  Encontradas {len(inconsistencies)} inconsistências")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "data": {
                "total_inconsistencies": len(inconsistencies),
                "inconsistencies": inconsistencies,
                "stats": {
                    "total_bigquery": len(bq_ids),
                    "total_firestore": len(fs_ids)
                }
            }
        }

    except Exception as e:
        print(f"❌ Erro na verificação de inconsistências: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.delete(
    "/admin/inconsistencies",
    summary="Resolver inconsistências (Admin)",
    description="Remove automaticamente todas as análises que não estão em ambos os bancos"
)
async def resolve_inconsistencies():
    """
    Endpoint administrativo para limpar inconsistências.
    Apaga registros que existem em apenas um dos bancos.
    """
    try:
        print(f"\n{'='*60}")
        print(f"🧹 [Admin] Resolvendo inconsistências...")
        print(f"{'='*60}")

        # Busca todos os IDs
        bq_ids = set(bigquery_service.get_all_ids())
        fs_ids = set(firestore_service.get_all_ids())

        # Identifica inconsistências
        missing_in_firestore = list(bq_ids - fs_ids) # Existem no BQ, mas não no FS -> Apagar do BQ
        missing_in_bigquery = list(fs_ids - bq_ids)  # Existem no FS, mas não no BQ -> Apagar do FS

        deleted_bq = 0
        deleted_fs = 0

        # Apaga do BigQuery (os que faltam no Firestore)
        for doc_id in missing_in_firestore:
           if bigquery_service.delete_analise(doc_id):
               deleted_bq += 1

        # Apaga do Firestore (os que faltam no BigQuery)
        for doc_id in missing_in_bigquery:
            if firestore_service.delete_analise(doc_id):
                deleted_fs += 1

        print(f"✅ Removidos do BigQuery: {deleted_bq}")
        print(f"✅ Removidos do Firestore: {deleted_fs}")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "data": {
                "deleted_from_bigquery": deleted_bq,
                "deleted_from_firestore": deleted_fs,
                "total_resolved": deleted_bq + deleted_fs
            }
        }

    except Exception as e:
        print(f"❌ Erro ao resolver inconsistências: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.delete(
    "/{document_id}",
    summary="Deletar análise",
    description="Remove uma análise do BigQuery e do Firestore"
)
async def delete_analise(document_id: str):
    """
    Endpoint para deletar uma análise.
    Tenta remover de ambos os bancos.
    """
    try:
        print(f"\n{'='*60}")
        print(f"🗑️ Deletando análise: {document_id}")
        print(f"{'='*60}")

        bq_success = bigquery_service.delete_analise(document_id)
        fs_success = firestore_service.delete_analise(document_id)

        if not bq_success and not fs_success:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Análise {document_id} não encontrada ou erro ao deletar"
            )

        print(f"✅ Análise deletada (BQ: {bq_success}, FS: {fs_success})")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "message": "Análise removida com sucesso",
            "details": {
                "bigquery_deleted": bq_success,
                "firestore_deleted": fs_success
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao deletar análise: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get(
    "/{document_id}/recommendations",
    summary="Buscar verificações similares",
    description="""
    Busca verificações similares baseado nos tópicos IPTC das afirmações.
    Rankeia da classificação de nível mais baixo (mais específico) para o mais alto (mais geral).
    Retorna até 8 verificações similares.
    """
)
async def get_recommendations(
    document_id: str,
    limit: int = Query(default=8, ge=1, le=20, description="Número máximo de recomendações")
) -> Dict[str, Any]:
    """
    Endpoint para buscar verificações similares.
    
    Args:
        document_id: ID da análise para buscar similares
        limit: Número máximo de resultados (default: 8)
    
    Returns:
        Lista de análises similares ordenadas por relevância
    
    Raises:
        HTTPException 404: Se a análise original não for encontrada
        HTTPException 500: Se houver erro ao buscar
    """
    try:
        print(f"\n{'='*60}")
        print(f"🔍 Buscando recomendações para: {document_id}")
        print(f"{'='*60}")

        # Busca análises similares no BigQuery
        similar = bigquery_service.get_similar_analyses(document_id, limit)

        if similar is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar recomendações"
            )

        print(f"✅ {len(similar)} recomendações encontradas!")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "data": {
                "items": similar,
                "total": len(similar)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar recomendações: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao buscar recomendações: {str(e)}"
        )


class InteractionRequest(BaseModel):
    uid: str
    action: str
    observation: Optional[str] = None  # Observação opcional, max 144 chars

@router.post(
    "/{document_id}/interaction",
    summary="Interagir com análise",
    description="Adiciona/Remove like ou dislike com observação opcional"
)
async def interact_with_analise(document_id: str, request: InteractionRequest):
    # Monta observação: texto + flag de personalização
    raw = (request.observation or "").strip()[:144]
    if raw:
        observation = {"text": raw, "has_custom_observation": True}
    else:
        observation = {"text": "Sem observações", "has_custom_observation": False}
    success = firestore_service.update_analise_interaction(document_id, request.uid, request.action, observation)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar interação"
        )
    return {"message": "Interação atualizada com sucesso"}
    return {"message": "Interação atualizada com sucesso"}

@router.get(
    "/{document_id}/interactions",
    summary="Listar interações",
    description="Retorna lista de usuários que deram like/dislike"
)
async def get_analise_interactions(document_id: str):
    # 1. Busca a análise para pegar os IDs
    analise_data = firestore_service.get_analise(document_id)
    if not analise_data:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    
    liked_by = analise_data.get("liked_by", [])
    disliked_by = analise_data.get("disliked_by", [])
    
    all_uids = list(set(liked_by + disliked_by))
    
    # 2. Busca os perfis dos usuários
    users = firestore_service.get_users_by_ids(all_uids)
    users_map = {u["uid"]: u for u in users}
    
    # 3. Monta a resposta
    interactions = []
    
    observations = analise_data.get("observations", {})
    
    def _normalize_obs(obs):
        """Normaliza observação para formato { text, has_custom_observation }."""
        if isinstance(obs, dict):
            return obs
        if isinstance(obs, str) and obs:
            return {"text": obs, "has_custom_observation": True}
        return {"text": "Sem observações", "has_custom_observation": False}
    
    for uid in liked_by:
        user = users_map.get(uid)
        if user:
            obs = _normalize_obs(observations.get(uid))
            interactions.append({
                "uid": uid,
                "displayName": user.get("displayName", "Usuário"),
                "photoURL": user.get("photoURL"),
                "occupation": user.get("occupation"),
                "socials": user.get("socials"),
                "action": "like",
                "observation": obs["text"],
                "has_custom_observation": obs["has_custom_observation"]
            })
            
    for uid in disliked_by:
        user = users_map.get(uid)
        if user:
            obs = _normalize_obs(observations.get(uid))
            interactions.append({
                "uid": uid,
                "displayName": user.get("displayName", "Usuário"),
                "photoURL": user.get("photoURL"),
                "occupation": user.get("occupation"),
                "socials": user.get("socials"),
                "action": "dislike",
                "observation": obs["text"],
                "has_custom_observation": obs["has_custom_observation"]
            })

    return {"interactions": interactions}


@router.get(
    "/export/dashboard",
    summary="Exportar dados do dashboard como CSV",
    description="Retorna CSV com estatísticas agregadas"
)
async def export_dashboard_csv(
    search: str = Query(None, description="Termo de busca"),
    start_date: Optional[datetime] = Query(None, description="Data/hora inicial (ISO 8601)"),
    end_date: Optional[datetime] = Query(None, description="Data/hora final (ISO 8601)"),
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_out_of_context_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de fora de contexto"),
    max_out_of_context_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de fora de contexto"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
    min_unverified_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de inverificável"),
    max_unverified_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de inverificável"),
):
    """
    Exporta dados do dashboard como CSV
    """
    try:
        filters = {
            "search": search,
            "start_date": start_date,
            "end_date": end_date,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_out_of_context_score": min_out_of_context_score,
            "max_out_of_context_score": max_out_of_context_score,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
            "min_unverified_score": min_unverified_score,
            "max_unverified_score": max_unverified_score,
        }

        print("\n" + "="*60)
        print("📊 Exportando dashboard para CSV...")
        print("="*60)

        data = bigquery_service.get_analytics_dashboard(filters)

        if not data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar dados do dashboard"
            )

        # Criar CSV em memória
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Header
        writer.writerow(["Métrica", "Valor"])

        # Stats
        writer.writerow(["Total de Mensagens", data["total_messages"]])
        writer.writerow(["Total de Afirmações", data["total_claims"]])
        writer.writerow(["Total de Afirmações Fora de Contexto", data.get("total_out_of_context_claims", 0)])

        # Calculate totals from results distribution
        total_true = 0
        total_fake = 0
        total_unknown = 0

        for item in data["results_distribution"]:
            if item["name"] == "Verdadeiro":
                total_true = item["value"]
            elif item["name"] == "Falso":
                total_fake = item["value"]
            elif item["name"] == "Fontes insuficientes para verificar":
                total_unknown = item["value"]

        writer.writerow(["Total Verdadeiras", total_true])
        writer.writerow(["Total Falsas", total_fake])
        writer.writerow(["Total Fontes Insuficientes", total_unknown])

        # Results distribution
        for item in data["results_distribution"]:
            writer.writerow([f"Afirmações {item['name']}", item["value"]])

        # Modalities distribution
        for item in data["modalities_distribution"]:
            writer.writerow([f"Mensagens com {item['name']}", item["value"]])

        output.seek(0)

        print("✅ Dashboard CSV gerado com sucesso!")
        print("="*60 + "\n")

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=dashboard_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao exportar dashboard CSV: {e}")
        print("="*60 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao exportar CSV: {str(e)}"
        )


@router.get(
    "/export/messages",
    summary="Exportar mensagens como CSV",
    description="Retorna CSV com todas as mensagens que correspondem aos filtros"
)
async def export_messages_csv(
    search: str = Query(None, description="Termo de busca"),
    start_date: Optional[datetime] = Query(None, description="Data/hora inicial (ISO 8601)"),
    end_date: Optional[datetime] = Query(None, description="Data/hora final (ISO 8601)"),
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_out_of_context_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de fora de contexto"),
    max_out_of_context_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de fora de contexto"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
    min_unverified_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de inverificável"),
    max_unverified_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de inverificável"),
    max_records: int = Query(10000, ge=1, le=50000, description="Limite de segurança"),
):
    """
    Exporta mensagens como CSV
    """
    try:
        def _escape_newlines(value: Any) -> str:
            if value is None:
                return ""
            text = str(value)
            text = text.replace("\r\n", "\n").replace("\r", "\n")
            return text.replace("\n", "\\n")

        def _normalize_claim_verdict(verdict_value: Any) -> str:
            v = str(verdict_value or "").upper().strip()

            # True
            if "VERDADEIRO" in v or v in {"TRUE"}:
                return "VERDADEIRO"

            # False
            if "FALSO" in v or v in {"FALSE"} or "FAKE" in v:
                return "FALSO"

            # Out of context
            if "FORA_DE_CONTEXTO" in v or "FORA DE CONTEXTO" in v or "OUT_OF_CONTEXT" in v or "OUT OF CONTEXT" in v:
                return "FORA_DE_CONTEXTO"

            # Everything else counts as unverified/insufficient sources for our UI
            return "UNVERIFIED"

        def _verdict_label(verdict_value: Any) -> str:
            normalized = _normalize_claim_verdict(verdict_value)
            if normalized == "VERDADEIRO":
                return "Verdadeiro"
            if normalized == "FALSO":
                return "Falso"
            if normalized == "FORA_DE_CONTEXTO":
                return "Fora de Contexto"
            return "Fontes insuficientes para verificar"

        def _format_date(date_value: str) -> str:
            try:
                date_obj = datetime.fromisoformat(date_value)
                return date_obj.strftime("%d/%m/%Y")
            except Exception:
                return date_value or ""

        def _format_type(source_type: str) -> str:
            return "WhatsApp" if source_type == "FromWhatsappGroup" else "Direta"

        def _normalize_topic(topic: str) -> str:
            return topic.split("|")[0] if isinstance(topic, str) and "|" in topic else (topic or "")

        def _join_non_empty(parts):
            return "\n\n".join([p for p in parts if isinstance(p, str) and p.strip()])

        def _compute_counts(item: Dict[str, Any]) -> Dict[str, int]:
            metrics = item.get("analysis_metrics") or {}
            if metrics:
                return {
                    "true": int(metrics.get("true_count") or 0),
                    "fake": int(metrics.get("fake_count") or 0),
                    "unverified": int(metrics.get("unverified_count") or 0),
                    "out_of_context": int(metrics.get("out_of_context_count") or 0),
                }

            counts = {"true": 0, "fake": 0, "unverified": 0, "out_of_context": 0}
            for claim in item.get("claims", []) or []:
                verdict_norm = _normalize_claim_verdict(claim.get("verdict") or claim.get("Result") or claim.get("result"))
                if verdict_norm == "VERDADEIRO":
                    counts["true"] += 1
                elif verdict_norm == "FALSO":
                    counts["fake"] += 1
                elif verdict_norm == "FORA_DE_CONTEXTO":
                    counts["out_of_context"] += 1
                else:
                    counts["unverified"] += 1
            return counts

        def _format_result(item: Dict[str, Any]) -> str:
            counts = _compute_counts(item)
            # Use line breaks (will be escaped to literal \\n) to avoid
            # consumers splitting this field into extra columns.
            return "\n".join(
                [
                    f"Verdadeiro: {counts['true']}",
                    f"Falso: {counts['fake']}",
                    f"Fontes insuficientes para verificar: {counts['unverified']}",
                    f"Fora de Contexto: {counts['out_of_context']}",
                ]
            )

        def _format_content(item: Dict[str, Any]) -> str:
            user_text = (item.get("user_message_text") or "").strip()
            media_info = item.get("media_info") or {}

            parts = []
            if user_text:
                parts.append(f"Mensagem Original:\n{user_text}")

            audio_text = (media_info.get("audio_text") or "").strip() if media_info.get("has_audio") else ""
            image_text = (media_info.get("image_text") or "").strip() if media_info.get("has_image") else ""
            video_text = (media_info.get("video_text") or "").strip() if media_info.get("has_video") else ""

            if audio_text:
                parts.append(f"Transcrição do Áudio:\n{audio_text}")
            if image_text:
                parts.append(f"Texto da Imagem:\n{image_text}")
            if video_text:
                parts.append(f"Texto do Vídeo:\n{video_text}")

            return _join_non_empty(parts)

        def _format_claims(item: Dict[str, Any]) -> str:
            blocks = []
            for i, claim in enumerate(item.get("claims", []) or [], 1):
                claim_text = (claim.get("claim_text") or claim.get("text") or "").strip()
                verdict = _verdict_label(claim.get("verdict") or claim.get("Result") or claim.get("result"))
                reasoning = (claim.get("reasoning") or "").strip()

                sources_details = []
                for source in claim.get("sources", []) or []:
                    s_url = (source.get("url") or "").strip()
                    s_title = (source.get("title") or "").strip()
                    s_publisher = (source.get("publisher") or "").strip()
                    s_citation = (source.get("citation_text") or "").strip()

                    line = "- "
                    if s_publisher:
                        line += f"[{s_publisher}] "
                    if s_title:
                        line += f"{s_title} "
                    if s_url:
                        line += f"({s_url})"
                    if s_citation:
                        line += f"\n  Citação: {s_citation}"
                    sources_details.append(line)

                sources_block = "\n".join(sources_details) if sources_details else "Nenhuma fonte citada."

                block = _join_non_empty([
                    f"Afirmação #{i}:",
                    f"Texto: {claim_text}" if claim_text else "Texto: ",
                    f"Veredito: {verdict}",
                    f"Justificativa: {reasoning}" if reasoning else "",
                    f"Fontes:\n{sources_block}",
                ])
                blocks.append(block)

            return "\n\n----------------------------------------\n\n".join(blocks)

        filters = {
            "search": search,
            "start_date": start_date,
            "end_date": end_date,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_out_of_context_score": min_out_of_context_score,
            "max_out_of_context_score": max_out_of_context_score,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
            "min_unverified_score": min_unverified_score,
            "max_unverified_score": max_unverified_score,
        }

        print("\n" + "="*60)
        print(f"📄 Exportando mensagens para CSV (max: {max_records})...")
        print("="*60)

        # Buscar TODAS as mensagens (limitado por max_records)
        if search:
            # mesma lógica do GET /analises: busca semântica vai via BigQuery
            result = bigquery_service.list_analises(limit=max_records, offset=0, filters=filters)
        else:
            result = firestore_service.list_analises(limit=max_records, offset=0, filters=filters)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar mensagens"
            )

        # Criar CSV
        output = io.StringIO()
        # QUOTE_ALL prevents values containing delimiters from shifting columns
        # in Excel/Sheets imports.
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)

        # Header
        writer.writerow([
            "Data",
            "Tipo",
            "Título",
            "Número de afirmações",
            "Resultado",
            "Tópicos",
            "Conteúdo",
            "Afirmações verificadas",
            "Conclusão"
        ])

        # Linhas
        for item in result["items"]:
            writer.writerow([
                _escape_newlines(_format_date(item.get("processed_at", ""))),
                _escape_newlines(_format_type(item.get("source_type", ""))),
                _escape_newlines(item.get("analysis_title") or "Sem título"),
                _escape_newlines(str(len(item.get("claims", []) or []))),
                _escape_newlines(_format_result(item)),
                _escape_newlines(", ".join(
                    sorted(
                        {t for claim in (item.get("claims", []) or []) for t in [_normalize_topic(x) for x in (claim.get("topics", []) or [])] if t}
                    )
                )),
                _escape_newlines(_format_content(item)),
                _escape_newlines(_format_claims(item)),
                _escape_newlines(item.get("final_comment", "") or ""),
            ])

        output.seek(0)

        print(f"✅ {len(result['items'])} mensagens exportadas para CSV!")
        print("="*60 + "\n")

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=mensagens_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao exportar mensagens CSV: {e}")
        print("="*60 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao exportar CSV: {str(e)}"
        )


@router.get(
    "/export/sources",
    summary="Exportar fontes como CSV",
    description="Retorna CSV com todas as fontes que correspondem aos filtros"
)
async def export_sources_csv(
    search: str = Query(None, description="Termo de busca"),
    start_date: Optional[datetime] = Query(None, description="Data/hora inicial (ISO 8601)"),
    end_date: Optional[datetime] = Query(None, description="Data/hora final (ISO 8601)"),
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_out_of_context_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de fora de contexto"),
    max_out_of_context_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de fora de contexto"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
    min_unverified_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de inverificável"),
    max_unverified_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de inverificável"),
    max_records: int = Query(10000, ge=1, le=50000, description="Limite de segurança"),
):
    """
    Exporta fontes como CSV
    """
    try:
        filters = {
            "search": search,
            "start_date": start_date,
            "end_date": end_date,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_out_of_context_score": min_out_of_context_score,
            "max_out_of_context_score": max_out_of_context_score,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
            "min_unverified_score": min_unverified_score,
            "max_unverified_score": max_unverified_score,
        }

        print("\n" + "="*60)
        print(f"📚 Exportando fontes para CSV (max: {max_records})...")
        print("="*60)

        # Buscar TODAS as fontes
        result = bigquery_service.list_sources(limit=max_records, offset=0, filters=filters)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar fontes"
            )

        # Criar CSV
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Header
        writer.writerow(["URL da Fonte", "Número de Citações"])

        # Linhas
        for item in result["items"]:
            writer.writerow([item["source"], item["count"]])

        output.seek(0)

        print(f"✅ {len(result['items'])} fontes exportadas para CSV!")
        print("="*60 + "\n")

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=fontes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao exportar fontes CSV: {e}")
        print("="*60 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao exportar CSV: {str(e)}"
        )
