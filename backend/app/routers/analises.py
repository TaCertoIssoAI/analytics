from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Dict, Any, List

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
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
) -> Dict[str, Any]:
    """
    Endpoint para obter dados do dashboard (gráficos e totais).
    """
    try:
        filters = {
            "search": search,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
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
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
) -> Dict[str, Any]:
    """
    Endpoint para listar análises com paginação e filtros.
    """
    try:
        filters = {
            "search": search,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
        }

        print("\n" + "="*60)
        print(f"📄 Listando análises (limit={limit}, offset={offset})...")
        print(f"   Filtros: {filters}")
        print("="*60)

        # [MODIFIED] Usa Firestore em vez de BigQuery
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
    message_type_whatsapp: bool = Query(True, description="Incluir WhatsApp"),
    message_type_direct: bool = Query(True, description="Incluir Direct"),
    modality_text: bool = Query(True, description="Incluir Texto"),
    modality_audio: bool = Query(True, description="Incluir Áudio"),
    modality_video: bool = Query(True, description="Incluir Vídeo"),
    modality_image: bool = Query(True, description="Incluir Imagem"),
    result_fake: bool = Query(True, description="Incluir Falso"),
    result_true: bool = Query(True, description="Incluir Verdadeiro"),
    result_unknown: bool = Query(True, description="Incluir Fontes insuficientes para verificar"),
    min_truth_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de verdadeiro"),
    max_truth_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de verdadeiro"),
    min_fake_score: int = Query(0, ge=0, le=100, description="Porcentagem mínima de falso"),
    max_fake_score: int = Query(100, ge=0, le=100, description="Porcentagem máxima de falso"),
) -> Dict[str, Any]:
    """
    Endpoint para listar fontes com paginação.
    """
    try:
        filters = {
            "search": search,
            "message_type_whatsapp": message_type_whatsapp,
            "message_type_direct": message_type_direct,
            "modality_text": modality_text,
            "modality_audio": modality_audio,
            "modality_video": modality_video,
            "modality_image": modality_image,
            "result_fake": result_fake,
            "result_true": result_true,
            "result_unknown": result_unknown,
            "min_truth_score": min_truth_score,
            "max_truth_score": max_truth_score,
            "min_fake_score": min_fake_score,
            "max_fake_score": max_fake_score,
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

class InteractionRequest(BaseModel):
    uid: str
    action: str

@router.post(
    "/{document_id}/interaction",
    summary="Interagir com análise",
    description="Adiciona/Remove like ou dislike"
)
async def interact_with_analise(document_id: str, request: InteractionRequest):
    success = firestore_service.update_analise_interaction(document_id, request.uid, request.action)
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
    
    for uid in liked_by:
        user = users_map.get(uid)
        if user:
            interactions.append({
                "uid": uid,
                "displayName": user.get("displayName", "Usuário"),
                "photoURL": user.get("photoURL"),
                "occupation": user.get("occupation"),
                "socials": user.get("socials"),
                "action": "like"
            })
            
    for uid in disliked_by:
        user = users_map.get(uid)
        if user:
            interactions.append({
                "uid": uid,
                "displayName": user.get("displayName", "Usuário"),
                "photoURL": user.get("photoURL"),
                "occupation": user.get("occupation"),
                "socials": user.get("socials"),
                "action": "dislike"
            })
            
    return {"interactions": interactions}
