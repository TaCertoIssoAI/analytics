from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import json

from app.config import settings
from app.routers import health, analises
from app.services.iptc_service import get_iptc_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação.
    Executa tarefas no startup e shutdown.
    """
    # Startup
    print("\n" + "="*60)
    print("🚀 Iniciando Analytics WhatsApp API")
    print("="*60)

    # Força inicialização do IPTC service (singleton)
    try:
        print("\n📚 Carregando IPTC classifier...")
        _ = get_iptc_service()  # Acessa o singleton para forçar inicialização
        print("✅ IPTC classifier carregado com sucesso!")
    except Exception as e:
        print(f"⚠️  Aviso: Erro ao carregar IPTC classifier: {e}")
        print("   O servidor continuará, mas a classificação de tópicos pode falhar.")

    print("\n" + "="*60)
    print(f"✅ Servidor pronto!")
    print(f"📍 Host: {settings.API_HOST}:{settings.API_PORT}")
    print(f"📖 Docs: http://{settings.API_HOST}:{settings.API_PORT}/docs")
    print("="*60 + "\n")

    yield

    # Shutdown
    print("\n" + "="*60)
    print("🛑 Encerrando Analytics WhatsApp API")
    print("="*60 + "\n")


# Cria aplicação FastAPI
app = FastAPI(
    title="Analytics WhatsApp API",
    description="""
    API para processamento e armazenamento de análises de fact-checking do WhatsApp.

    ## Funcionalidades

    * **POST /analises**: Recebe análises do bot (formato antigo), transforma e salva no BigQuery
    * **GET /analises/{id}**: Busca análises para exibição no frontend
    * **Classificação automática**: Classifica tópicos das claims usando IPTC
    * **Cálculo de veredito**: Calcula veredito geral baseado nas claims individuais

    ## Fluxo de dados

    1. Bot envia análise via POST (PascalCase)
    2. API transforma para formato novo (snake_case)
    3. Classifica tópicos com IPTC + OpenAI
    4. Calcula veredito geral
    5. Salva no BigQuery
    6. Frontend busca via GET e exibe
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler para erros de validação (422).
    Loga detalhes completos do erro para debugging.
    """
    print("\n" + "="*80)
    print("❌ ERRO DE VALIDAÇÃO (422)")
    print("="*80)
    print(f"📍 URL: {request.method} {request.url}")
    print(f"📍 Client: {request.client.host if request.client else 'Unknown'}")

    # Tenta ler o body da requisição
    try:
        body = await request.body()
        body_str = body.decode('utf-8')
        print(f"\n📦 Request Body (raw):")
        print(body_str[:2000])  # Primeiros 2000 caracteres

        # Tenta parsear como JSON para mostrar formatado
        try:
            body_json = json.loads(body_str)
            print(f"\n📦 Request Body (parsed JSON):")
            print(json.dumps(body_json, indent=2, ensure_ascii=False)[:2000])
        except:
            pass
    except Exception as e:
        print(f"⚠️  Não foi possível ler o body: {e}")

    # Loga os erros de validação
    print(f"\n🔍 Validation Errors ({len(exc.errors())} error(s)):")
    print("-" * 80)
    for i, error in enumerate(exc.errors(), 1):
        print(f"\nErro #{i}:")
        print(f"  • Campo: {' -> '.join(str(loc) for loc in error['loc'])}")
        print(f"  • Tipo: {error['type']}")
        print(f"  • Mensagem: {error['msg']}")
        if 'ctx' in error:
            print(f"  • Contexto: {error['ctx']}")

    print("\n" + "="*80 + "\n")

    # Retorna resposta detalhada
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "message": "Validation error - check logs for details"
        }
    )


# Middleware para logar requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Middleware para logar todas as requisições.
    """
    # Log apenas para endpoints de análise
    if "/analises" in str(request.url.path) and request.method == "POST":
        print(f"\n{'='*60}")
        print(f"📨 Incoming Request: {request.method} {request.url.path}")
        print(f"{'='*60}")

    response = await call_next(request)

    # Log response status para análises
    if "/analises" in str(request.url.path) and request.method == "POST":
        status_emoji = "✅" if response.status_code < 400 else "❌"
        print(f"{status_emoji} Response Status: {response.status_code}")
        print(f"{'='*60}\n")

    return response


# Configura CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,  # Frontend em desenvolvimento
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",  # Porta alternativa do Vite
        "http://127.0.0.1:8081",
        "https://tacertoissoai.netlify.app", # Produção Netlify
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos os métodos (GET, POST, etc.)
    allow_headers=["*"],  # Permite todos os headers
)

# Inclui routers
app.include_router(health.router)
app.include_router(analises.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True  # Hot reload durante desenvolvimento
    )
