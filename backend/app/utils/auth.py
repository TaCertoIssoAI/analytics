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

async def verify_admin(decoded_token: dict = Depends(verify_token)):
    """
    Dependency para verificar se o usuário é admin.
    """
    if not decoded_token.get("admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin privileges required."
        )
    return decoded_token
