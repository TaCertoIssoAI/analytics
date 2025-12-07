from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from app.services.firestore_service import firestore_service

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

class UserProfile(BaseModel):
    uid: str
    email: Optional[str] = None
    displayName: Optional[str] = None
    createdAt: int
    photoURL: Optional[str] = None
    bio: Optional[str] = None
    occupation: Optional[str] = None
    socials: Optional[dict] = None  # { "linkedin": "...", "twitter": "...", "instagram": "..." }

@router.post("/profile")
async def create_user_profile(profile: UserProfile):
    success = firestore_service.create_user_profile(profile.model_dump())
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar perfil de usuário"
        )
    return {"message": "Perfil criado com sucesso"}

@router.get("/profile/{uid}")
async def get_user_profile(uid: str):
    profile = firestore_service.get_user_profile(uid)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil não encontrado"
        )
    return profile
