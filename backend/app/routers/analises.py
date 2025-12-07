from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, List
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


@router.get(
    "/export/dashboard",
    summary="Exportar dados do dashboard como CSV",
    description="Retorna CSV com estatísticas agregadas"
)
async def export_dashboard_csv(
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
):
    """
    Exporta dados do dashboard como CSV
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
        writer.writerow(["Total de Claims", data["total_claims"]])

        # Results distribution
        for item in data["results_distribution"]:
            writer.writerow([f"Claims {item['name']}", item["value"]])

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
    max_records: int = Query(10000, ge=1, le=50000, description="Limite de segurança"),
):
    """
    Exporta mensagens como CSV
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
        print(f"📄 Exportando mensagens para CSV (max: {max_records})...")
        print("="*60)

        # Buscar TODAS as mensagens (limitado por max_records)
        result = firestore_service.list_analises(limit=max_records, offset=0, filters=filters)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar mensagens"
            )

        # Criar CSV
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Header
        writer.writerow([
            "Data",
            "Tipo",
            "Título",
            "Quantidade de Claims",
            "% Verdadeiro",
            "% Falso",
            "% Não Verificado",
            "Tópicos"
        ])

        # Linhas
        for item in result["items"]:
            # Formatar data
            try:
                date_obj = datetime.fromisoformat(item.get("processed_at", ""))
                formatted_date = date_obj.strftime("%d/%m/%Y")
            except:
                formatted_date = item.get("processed_at", "")

            # Tipo
            msg_type = "WhatsApp" if item.get("source_type") == "FromWhatsappGroup" else "Direta"

            # Título
            title = item.get("analysis_title") or "Sem título"

            # Métricas
            metrics = item.get("analysis_metrics", {})
            total_claims = len(item.get("claims", []))
            truth_score = metrics.get("truth_score", 0) if metrics else 0
            fake_score = metrics.get("fake_score", 0) if metrics else 0
            unverified_score = metrics.get("unverified_score", 0) if metrics else 0

            # Tópicos (únicos, apenas parte antes do pipe)
            all_topics = []
            for claim in item.get("claims", []):
                for topic in claim.get("topics", []):
                    topic_name = topic.split('|')[0] if '|' in topic else topic
                    if topic_name and topic_name not in all_topics:
                        all_topics.append(topic_name)
            topics_str = ", ".join(all_topics)

            writer.writerow([
                formatted_date,
                msg_type,
                title,
                total_claims,
                f"{truth_score}%",
                f"{fake_score}%",
                f"{unverified_score}%",
                topics_str
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
    max_records: int = Query(10000, ge=1, le=50000, description="Limite de segurança"),
):
    """
    Exporta fontes como CSV
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
