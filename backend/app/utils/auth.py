from fastapi import Depends, HTTPException, status, Header
from firebase_admin import auth, credentials, initialize_app
import firebase_admin
from app.config import settings
import os

# Inicializa Firebase Admin SDK se não estiver inicializado
try:
    firebase_admin.get_app()
except ValueError:
    cred = None
    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
    
    initialize_app(cred)

async def verify_token(authorization: str = Header(...)):
    """
    Verifica o token do Firebase no header Authorization.
    Formato: Bearer <token>
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Use 'Bearer <token>'"
        )
    
    token = authorization.split("Bearer ")[1]
    
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"❌ Erro ao verificar token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )



# Import top-level to ensure it works
from app.services.firestore_service import firestore_service

async def verify_admin(decoded_token: dict = Depends(verify_token)):
    """
    Dependency para verificar se o usuário é admin.
    Verifica tanto o token quanto o banco de dados em tempo real para garantir revogação imediata.
    """
    print(f"🔐 Verificando admin (Token User: {decoded_token.get('uid')})")

    # 1. Verificação básica do token (fail-fast)
    if not decoded_token.get("admin"):
        print("❌ Acesso negado: Token claim 'admin' ausente.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin privileges required (Token claim)."
        )
    
    # 2. Verificação rigorosa no Firestore (Real-time revocation check)
    try:
        uid = decoded_token.get("uid")
        if not uid:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no UID"
            )

        print(f"🔍 Buscando perfil no Firestore para UID: {uid}")
        user_profile = firestore_service.get_user_profile(uid)
        
        if not user_profile:
             print(f"❌ Perfil não encontrado no Firestore para UID: {uid}")
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. User profile not found."
            )
        
        current_role = user_profile.get("role")
        print(f"👤 Role atual no Firestore: '{current_role}'")

        if current_role != "admin":
             print(f"❌ Acesso negado: Role no banco é '{current_role}', não 'admin'.")
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Admin privileges revoked."
            )
        
        print("✅ Acesso admin confirmado via Firestore.")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro na verificação de admin online: {e}")
        # Em caso de erro de conexão com DB, fail-safe (bloqueia)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify admin status currently."
        )

    return decoded_token
