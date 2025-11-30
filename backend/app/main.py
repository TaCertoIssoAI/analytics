from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

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
