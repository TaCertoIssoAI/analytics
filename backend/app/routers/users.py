from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any
from app.services.firestore_service import firestore_service
from app.utils.auth import verify_admin, verify_token
from firebase_admin import auth
from fastapi import Depends

_PRIVATE_FIELDS = {"email"}

def _public_profile(profile: dict) -> dict:
    """Strip private fields from a user profile for public consumption."""
    return {k: v for k, v in profile.items() if k not in _PRIVATE_FIELDS}

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

class UserRoleRequest(BaseModel):
    role: str

class UpdateUserProfileRequest(BaseModel):
    bio: Optional[str] = None
    occupation: Optional[str] = None
    socials: Optional[dict] = None  # { "linkedin": "...", "twitter": "...", "instagram": "..." }

class ResetPasswordRequest(BaseModel):
    new_password: str

class CreateUserRequest(BaseModel):
    email: str
    password: str
    displayName: str
    photoURL: Optional[str] = None
    role: str = "user"


@router.post("/profile")
async def create_user_profile(
    profile: UserProfile,
    decoded_token: dict = Depends(verify_token)
):
    if decoded_token.get("uid") != profile.uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode criar ou atualizar seu próprio perfil."
        )
    success = firestore_service.create_user_profile(profile.model_dump())
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar perfil de usuário"
        )
    return {"message": "Perfil criado com sucesso"}

@router.get("/profile/{uid}")
async def get_user_profile(uid: str, request: Request):
    profile = firestore_service.get_user_profile(uid)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil não encontrado"
        )

    # Check if requester is the profile owner
    is_owner = False
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            decoded = auth.verify_id_token(auth_header[7:])
            is_owner = decoded.get("uid") == uid
        except Exception:
            pass

    return profile if is_owner else _public_profile(profile)

@router.get("/top-reviewers")
async def get_top_reviewers():
    """
    Retorna os top reviewers da semana.
    """
    top_reviewers = firestore_service.get_top_reviewers()
    # Strip private fields from each reviewer's user profile
    if "reviewers" in top_reviewers:
        for entry in top_reviewers["reviewers"]:
            if "user" in entry:
                entry["user"] = _public_profile(entry["user"])
    return {"success": True, "data": top_reviewers}

@router.get("/community")
async def get_community_members(limit: int = 50, offset: int = 0, search: str = ""):
    """
    Lista membros da comunidade (público, sem autenticação).
    Search and pagination are handled server-side with in-memory cache.
    """
    result = firestore_service.list_users(limit, offset, search)

    # Strip private fields from public community listing
    result["users"] = [_public_profile(u) for u in result["users"]]

    return {"success": True, "data": result}

@router.get("/{uid}/interactions")
async def get_user_interactions(uid: str):
    interactions = firestore_service.get_user_interactions(uid)
    return {"interactions": interactions}

@router.get("")
async def list_users(
    limit: int = 10,
    offset: int = 0,
    admin_user: dict = Depends(verify_admin)
):
    """
    Lista todos os usuários (apenas admin).
    Returns full user data (no projection, no field stripping).
    """
    return firestore_service.list_users_admin(limit, offset)

@router.post("/{uid}/role")
async def set_user_role(
    uid: str, 
    role_request: UserRoleRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Define o papel (role) de um usuário (apenas admin).
    Isso atualiza tanto o Firestore quanto as Custom Claims do Firebase Auth.
    """
    role = role_request.role
    if role not in ["admin", "user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'admin' or 'user'"
        )
    
    try:
        # 1. Atualiza Custom Claims no Firebase Auth
        claims = {"admin": True} if role == "admin" else {"admin": False}
        auth.set_custom_user_claims(uid, claims)
        
        # 2. Atualiza Firestore
        success = firestore_service.update_user_role(uid, role)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update role in Firestore"
            )
            
        return {"message": f"User {uid} role updated to {role}"}
        
        
    except Exception as e:
        print(f"❌ Error setting user role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.put("/{uid}/profile")
async def admin_update_user_profile(
    uid: str,
    update_request: UpdateUserProfileRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Atualiza campos do perfil de um usuário (apenas admin).
    Permite editar bio, occupation e socials.
    """
    try:
        # Verifica se o usuário existe
        existing = firestore_service.get_user_profile(uid)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )

        # Monta dict apenas com campos que foram enviados (não None)
        fields_to_update = {}
        if update_request.bio is not None:
            fields_to_update["bio"] = update_request.bio
        if update_request.occupation is not None:
            fields_to_update["occupation"] = update_request.occupation
        if update_request.socials is not None:
            fields_to_update["socials"] = update_request.socials

        if not fields_to_update:
            return {"message": "Nenhum campo para atualizar"}

        success = firestore_service.update_user_profile_fields(uid, fields_to_update)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar perfil no Firestore"
            )

        return {"message": f"Perfil do usuário {uid} atualizado com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{uid}/password")
async def admin_reset_user_password(
    uid: str,
    password_request: ResetPasswordRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Reseta a senha de um usuário (apenas admin).
    """
    if len(password_request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter no mínimo 6 caracteres"
        )

    try:
        auth.update_user(uid, password=password_request.new_password)
        return {"message": f"Senha do usuário {uid} atualizada com sucesso"}
    except auth.UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado no Firebase Auth"
        )
    except Exception as e:
        print(f"❌ Error resetting password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("")
async def create_user(
    user_request: CreateUserRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Cria um novo usuário (apenas admin).
    Cria no Firebase Auth e no Firestore.
    """
    try:
        # 1. Cria usuário no Firebase Auth
        user = auth.create_user(
            email=user_request.email,
            password=user_request.password,
            display_name=user_request.displayName
        )
        
        # 2. Define Custom User Claims se for admin
        if user_request.role == "admin":
            auth.set_custom_user_claims(user.uid, {"admin": True})
            
        # 3. Cria perfil no Firestore
        profile_data = {
            "uid": user.uid,
            "email": user.email,
            "displayName": user.display_name,
            "photoURL": user_request.photoURL, # Salva Base64 apenas no Firestore
            "createdAt": int(datetime.utcnow().timestamp() * 1000),
            "role": user_request.role
        }
        
        success = firestore_service.create_user_profile(profile_data)
        
        if not success:
            # Tenta reverter (deletar do Auth) se falhar no Firestore
            try:
                auth.delete_user(user.uid)
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user profile in Firestore"
            )
            
        return {"message": "User created successfully", "uid": user.uid}
        
    except auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/admin/backfill-review-counts")
async def backfill_review_counts(admin_user: dict = Depends(verify_admin)):
    """
    One-shot backfill: computes review_count for all users from analises collection.
    Admin only.
    """
    counts = firestore_service.backfill_review_counts()
    return {"success": True, "users_updated": len(counts), "counts": counts}

@router.delete("/{uid}")
async def delete_user(
    uid: str,
    admin_user: dict = Depends(verify_admin)
):
    """
    Deleta um usuário (apenas admin).
    Remove do Firebase Auth e do Firestore.
    """
    # Impede deleção do próprio usuário que está fazendo a requisição
    if uid == admin_user.get("uid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
        
    try:
        # 1. Deleta do Firebase Auth
        auth.delete_user(uid)
        
        # 2. Deleta do Firestore
        firestore_service.delete_user_profile(uid)
        
        return {"message": "User deleted successfully"}
        
    except auth.UserNotFoundError:
        # Se não existe no Auth, tenta deletar só do Firestore para limpar lixo
        firestore_service.delete_user_profile(uid)
        return {"message": "User deleted (was not found in Auth)"}
        
    except Exception as e:
        print(f"❌ Error deleting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
