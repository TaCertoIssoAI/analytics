from fastapi import APIRouter, HTTPException, status, Query, Depends
from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional
from datetime import date as date_type, datetime
import re

from app.services.firestore_service import firestore_service
from app.utils.auth import verify_admin

router = APIRouter(prefix="/donations", tags=["Donations"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _validate_date_str(value: str) -> str:
    if not _DATE_RE.match(value):
        raise ValueError("Data deve estar no formato YYYY-MM-DD")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise ValueError("Data inválida")
    return value


class DonationLogIn(BaseModel):
    date: str = Field(..., description="Data no formato YYYY-MM-DD")
    amount_brl: float = Field(..., ge=0, description="Valor arrecadado no dia em R$")
    markdown: str = Field(..., min_length=1, description="Nota fiscal em markdown")

    @validator("date")
    def _v_date(cls, v: str) -> str:
        return _validate_date_str(v)


class DonationLogUpdate(BaseModel):
    amount_brl: float = Field(..., ge=0)
    markdown: str = Field(..., min_length=1)


@router.get("/stats", summary="Total arrecadado e metadados da vaquinha")
async def get_donation_stats() -> Dict[str, Any]:
    try:
        stats = firestore_service.get_donation_stats()
        return {"success": True, "data": stats}
    except Exception as e:
        print(f"❌ Erro em /donations/stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {e}",
        )


@router.get("/logs", summary="Listar logs do diário de bordo")
async def list_donation_logs(
    start: Optional[str] = Query(None, description="Data inicial YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="Data final YYYY-MM-DD"),
    limit: int = Query(30, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    for label, value in (("start", start), ("end", end)):
        if value is not None:
            try:
                _validate_date_str(value)
            except ValueError as ve:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parâmetro '{label}' inválido: {ve}",
                )
    try:
        result = firestore_service.list_donation_logs(
            start=start, end=end, limit=limit, offset=offset
        )
        items = result.get("items", [])
        total = result.get("total", 0)
        return {
            "success": True,
            "data": {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(items) < total,
            },
        }
    except Exception as e:
        print(f"❌ Erro em /donations/logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {e}",
        )


@router.get("/logs/{log_date}", summary="Buscar log de um dia específico")
async def get_donation_log(log_date: str) -> Dict[str, Any]:
    try:
        _validate_date_str(log_date)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    item = firestore_service.get_donation_log(log_date)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log não encontrado")
    return {"success": True, "data": item}


@router.post("/logs", summary="Criar/atualizar log do dia (admin)")
async def create_donation_log(
    payload: DonationLogIn,
    decoded_token: dict = Depends(verify_admin),
) -> Dict[str, Any]:
    uid = decoded_token.get("uid")
    ok = firestore_service.save_donation_log(
        date=payload.date,
        amount_brl=payload.amount_brl,
        markdown=payload.markdown,
        uid=uid,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao salvar log",
        )
    return {"success": True, "data": firestore_service.get_donation_log(payload.date)}


@router.put("/logs/{log_date}", summary="Atualizar log do dia (admin)")
async def update_donation_log(
    log_date: str,
    payload: DonationLogUpdate,
    decoded_token: dict = Depends(verify_admin),
) -> Dict[str, Any]:
    try:
        _validate_date_str(log_date)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    existing = firestore_service.get_donation_log(log_date)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log não encontrado")

    uid = decoded_token.get("uid")
    ok = firestore_service.save_donation_log(
        date=log_date,
        amount_brl=payload.amount_brl,
        markdown=payload.markdown,
        uid=uid,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao atualizar log",
        )
    return {"success": True, "data": firestore_service.get_donation_log(log_date)}


@router.post("/logs/migrate-timezone", summary="Migrar timestamps UTC para Brasília (admin)")
async def migrate_donation_logs_timezone(
    _: dict = Depends(verify_admin),
) -> Dict[str, Any]:
    result = firestore_service.migrate_donation_logs_to_brasilia()
    return {"success": True, "data": result}


@router.delete("/logs/{log_date}", summary="Deletar log do dia (admin)")
async def delete_donation_log(
    log_date: str,
    _: dict = Depends(verify_admin),
) -> Dict[str, Any]:
    try:
        _validate_date_str(log_date)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    if not firestore_service.get_donation_log(log_date):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log não encontrado")

    ok = firestore_service.delete_donation_log(log_date)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao deletar log",
        )
    return {"success": True}
