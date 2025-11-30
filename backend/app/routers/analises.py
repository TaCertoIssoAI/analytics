from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any

from app.models.old_format import AnaliseOldFormat
from app.models.new_format import AnaliseNewFormat
from app.models.responses import (
    AnaliseCreateResponse,
    AnaliseGetResponse,
    ErrorResponse
)
from app.services.transformer import transformer
from app.services.bigquery_service import bigquery_service
from app.config import settings

router = APIRouter(prefix="/analises", tags=["Análises"])


@router.post(
    "",
    response_model=AnaliseCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova análise",
    description="""
    Recebe uma análise no formato antigo (PascalCase do bot),
    converte para o formato novo (snake_case), classifica tópicos,
    salva no BigQuery e retorna a URL de verificação.
    """
)
async def create_analise(analise_old: AnaliseOldFormat) -> AnaliseCreateResponse:
    """
    Endpoint para criar uma nova análise.

    Fluxo:
    1. Recebe AnaliseOldFormat do bot
    2. Transforma para AnaliseNewFormat
    3. Salva no BigQuery
    4. Retorna URL de verificação

    Args:
        analise_old: Análise no formato antigo (PascalCase)

    Returns:
        AnaliseCreateResponse com URL de verificação

    Raises:
        HTTPException 409: Se a análise já existe
        HTTPException 500: Se houver erro ao salvar
    """
    try:
        document_id = analise_old.DocumentId

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
        analise_new = transformer.transform(analise_old)

        # Salva no BigQuery
        print(f"💾 Salvando no BigQuery...")
        success = bigquery_service.insert_analise(analise_new)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao salvar análise no BigQuery"
            )

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

        # Busca no BigQuery
        data = bigquery_service.get_analise(document_id)

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
