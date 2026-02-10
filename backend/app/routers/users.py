from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.services.firestore_service import firestore_service
from app.utils.auth import verify_admin
from firebase_admin import auth
from fastapi import Depends

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

class CreateUserRequest(BaseModel):
    email: str
    password: str
    displayName: str
    role: str = "user"


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

@router.get("/top-reviewers")
async def get_top_reviewers():
    """
    Retorna os top reviewers da semana.
    """
    top_reviewers = firestore_service.get_top_reviewers()
    return {"success": True, "data": top_reviewers}

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
    """
    return firestore_service.list_users(limit, offset)

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
