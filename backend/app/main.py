from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from starlette.exceptions import HTTPException as StarletteHTTPException
import json

from app.config import settings
from app.routers import health, analises, users, donations
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
    3. Classifica tópicos com IPTC + Gemini
    4. Calcula veredito geral
    5. Salva no BigQuery
    6. Frontend busca via GET e exibe
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Custom exception handler for JSON decode errors
@app.exception_handler(json.JSONDecodeError)
async def json_decode_exception_handler(request: Request, exc: json.JSONDecodeError):
    """
    Handler para erros de parsing de JSON.
    """
    print("\n" + "="*80)
    print("❌ ERRO DE PARSING JSON")
    print("="*80)
    print(f"📍 URL: {request.method} {request.url}")
    print(f"📍 Client: {request.client.host if request.client else 'Unknown'}")
    print(f"\n🔍 JSON Error Details:")
    print(f"  • Message: {exc.msg}")
    print(f"  • Line: {exc.lineno}, Column: {exc.colno}")
    print(f"  • Position: {exc.pos}")

    # Tenta ler o body
    try:
        body = await request.body()
        body_str = body.decode('utf-8')
        print(f"\n📦 Request Body (primeiros 3000 caracteres):")
        print(body_str[:3000])

        # Mostra a área problemática
        if exc.pos and exc.pos < len(body_str):
            start = max(0, exc.pos - 100)
            end = min(len(body_str), exc.pos + 100)
            print(f"\n⚠️  Área problemática (±100 chars ao redor da posição {exc.pos}):")
            print(f"...{body_str[start:end]}...")
    except Exception as e:
        print(f"⚠️  Não foi possível ler o body: {e}")

    print("\n" + "="*80 + "\n")

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "Invalid JSON",
            "message": f"JSON parsing error: {exc.msg} at line {exc.lineno}, column {exc.colno}",
            "position": exc.pos,
            "detail": "The request body contains invalid JSON. Check for unescaped newlines, quotes, or special characters in string values."
        }
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
        print(f"\n📦 Request Body Length: {len(body_str)} characters")
        print(f"\n📦 Request Body (primeiros 3000 caracteres):")
        print(body_str[:3000])

        # Tenta parsear como JSON para mostrar formatado
        try:
            body_json = json.loads(body_str)
            print(f"\n📦 Request Body Keys: {list(body_json.keys()) if isinstance(body_json, dict) else 'Not a dict'}")

            # Mostra valores truncados dos campos principais
            if isinstance(body_json, dict):
                for key in ['DocumentId', 'Date', 'message_type', 'PureText', 'FinalTranscribedText']:
                    if key in body_json:
                        value = str(body_json[key])
                        print(f"  • {key}: {value[:200] if len(value) > 200 else value}{'...' if len(value) > 200 else ''}")

                # Mostra estrutura detalhada do Claims
                if 'Claims' in body_json:
                    claims = body_json['Claims']
                    print(f"\n📋 Claims Structure:")
                    print(f"  • Type: {type(claims).__name__}")
                    print(f"  • Number of claims: {len(claims) if isinstance(claims, (dict, list)) else 'N/A'}")

                    if isinstance(claims, dict):
                        print(f"  • Claim IDs: {list(claims.keys())[:5]}{'...' if len(claims) > 5 else ''}")

                        # Mostra detalhes de cada claim
                        for claim_id, claim_data in list(claims.items())[:3]:  # Primeiras 3 claims
                            print(f"\n  Claim ID: {claim_id}")
                            print(f"    • Claim Type: {type(claim_data).__name__}")
                            if isinstance(claim_data, dict):
                                print(f"    • Claim Keys: {list(claim_data.keys())}")

                                # Foca especialmente nos links
                                if 'links' in claim_data:
                                    links = claim_data['links']
                                    print(f"    • Links Type: {type(links).__name__}")
                                    print(f"    • Links Length: {len(links) if isinstance(links, (list, dict)) else 'N/A'}")

                                    if isinstance(links, list):
                                        print(f"    • Links Content:")
                                        for i, link in enumerate(links[:5]):  # Primeiros 5 links
                                            print(f"      [{i}] Type: {type(link).__name__}, Value: {str(link)[:100]}")
                                    else:
                                        print(f"    • Links Value: {str(links)[:200]}")

                                if 'text' in claim_data:
                                    text = str(claim_data['text'])
                                    print(f"    • Text: {text[:100]}{'...' if len(text) > 100 else ''}")
        except json.JSONDecodeError as je:
            print(f"\n⚠️  JSON parsing error: {je.msg} at line {je.lineno}, column {je.colno}")
            print(f"  This might be the root cause - invalid JSON format")
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
        "https://test-tacertoisso-ai.netlify.app", # Amb de Teste Netlify
        "https://tacertoissoai.com.br"
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos os métodos (GET, POST, etc.)
    allow_headers=["*"],  # Permite todos os headers
)

# Inclui routers
app.include_router(health.router)
app.include_router(analises.router)
app.include_router(users.router)
app.include_router(donations.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True  # Hot reload durante desenvolvimento
    )
