# Tá Certo Isso AI - Analytics

Plataforma de analytics e verificação de fatos para o bot de WhatsApp "Tá Certo Isso AI". Sistema completo para pesquisadores e jornalistas acessarem dados de verificações de fact-checking realizadas por inteligência artificial.

## 📋 Índice

- [Como Rodar Localmente](#como-rodar-localmente)
- [Tecnologias](#tecnologias)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Backend](#backend)
- [Frontend](#frontend)
- [Funcionalidades](#funcionalidades)
- [Contato](#contato)

<a id="como-rodar-localmente"></a>
## 🛠 Como Rodar Localmente

### Pré-requisitos

- Python 3.10+
- Node.js 18+
- Conta Google Cloud (BigQuery e Firestore)
- API Key do Google Gemini
- Firebase Project

### Backend

1. **Clone o repositório:**
```bash
git clone https://github.com/seu-usuario/ta-certo-isso-ai-analytics.git
cd ta-certo-isso-ai-analytics/backend
```

2. **Crie um ambiente virtual:**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

3. **Instale dependências:**
```bash
pip install -r requirements.txt
```

4. **Configure variáveis de ambiente:**
```bash
export GOOGLE_API_KEY=sua_api_key_gemini
export GOOGLE_CLOUD_PROJECT=seu-projeto-id
export BIGQUERY_DATASET=fact_checking_analytics
export BIGQUERY_TABLE=analises
```

5. **Configure credenciais do Google Cloud:**
```bash
gcloud auth application-default login
# ou
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

6. **Execute o servidor:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Acesse: `http://localhost:8000/docs` (Swagger UI)

### Frontend

1. **Navegue para o diretório:**
```bash
cd ../frontend
```

2. **Instale dependências:**
```bash
npm install
```

3. **Configure variáveis de ambiente:**

Crie `.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=sua_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

4. **Execute o dev server:**
```bash
npm run dev
```

Acesse: `http://localhost:5173`

---

<a id="tecnologias"></a>
## 🚀 Tecnologias

### Backend
- **Python 3.10+** - Linguagem principal
- **FastAPI** - Framework web de alta performance
- **Google BigQuery** - Data warehouse para análise em larga escala
- **Google Firestore** - Banco NoSQL para recuperação rápida
- **Google Gemini** - Embeddings para busca semântica
- **Pydantic** - Validação de dados e serialização
- **IPTC Media Topics** - Classificação automática de tópicos

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utilitário
- **Shadcn UI** - Componentes acessíveis
- **Recharts** - Visualização de dados
- **React Router** - Navegação
- **Firebase Auth** - Autenticação de usuários
- **VLibras** - Acessibilidade para Libras

<a id="arquitetura-do-sistema"></a>
## 🏗 Arquitetura do Sistema

```
┌─────────────────┐
│   WhatsApp Bot  │
│  (Mensagens)    │
└────────┬────────┘
         │ POST
         ↓
┌─────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Endpoints de Ingestão (POST)             │  │
│  │  - /analises (criar nova análise)                │  │
│  │  - Transformação de dados                        │  │
│  │  - Classificação IPTC                            │  │
│  │  - Normalização de vereditos                     │  │
│  │  - Cálculo de métricas                           │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                   │
│                     ↓                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Serviços de Dados                      │  │
│  │  ┌────────────────────┐  ┌──────────────────┐   │  │
│  │  │  BigQuery Service  │  │ Firestore Service│   │  │
│  │  │  - VECTOR_SEARCH   │  │ - get_analise()  │   │  │
│  │  │  - insert_analise()│  │ - save_analise() │   │  │
│  │  │  - list_analises() │  │ - list_analises()│   │  │
│  │  │  - get_stats()     │  │ - interactions   │   │  │
│  │  └────────────────────┘  └──────────────────┘   │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                   │
│                     ↓                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Endpoints de Consulta (GET)              │  │
│  │  - /analises (listar com filtros)                │  │
│  │  - /analises/{id} (buscar por ID)                │  │
│  │  - /analises/dashboard (métricas agregadas)      │  │
│  │  - /analises/stats (estatísticas gerais)         │  │
│  │  - /analises/sources (fontes citadas)            │  │
│  │  - /analises/export/* (exportação CSV)           │  │
│  └──────────────────┬───────────────────────────────┘  │
│                                                          │
└──────────────────────┼──────────────────────────────────┘
                       │ HTTP/REST
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React)                        │
├─────────────────────────────────────────────────────────┤
│  - Página Inicial (verificações recentes)               │
│  - Busca (filtros avançados + busca semântica)          │
│  - Verificação (visualização detalhada)                 │
│  - Perfil de usuário                                     │
│  - Login/Cadastro (Firebase Auth)                       │
│  - Acessibilidade (VLibras)                             │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend

O backend é construído com **FastAPI** e organizado em camadas para separação de responsabilidades.

### 1.1. Endpoints de Ingestão (POST)

Responsáveis por receber dados do bot de WhatsApp, processar e armazenar nas bases de dados.

#### **POST /analises**

Cria uma nova análise de verificação.

**Fluxo de Processamento:**

1. **Recebe dados** no formato `AnaliseInputFormat` do bot
2. **Transforma dados** via `AnaliseTransformer`:
   - Converte claims e fontes para formato unificado
   - Agrega vereditos de múltiplas fontes de dados
   - Normaliza vereditos (`VERDADEIRO`, `FALSO`, `FORA_DE_CONTEXTO`, `CHECK`)
   - Classifica tópicos usando **IPTC Media Topics** com LLM reranking
   - Calcula métricas agregadas (total de claims, scores percentuais)
   - Gera título da análise com LLM
3. **Salva em duas bases**:
   - **BigQuery**: Para análises e buscas complexas
   - **Firestore**: Para recuperação rápida por ID
4. **Retorna URL** de verificação

**Exemplo de Request:**
```json
{
  "DocumentId": "abc123",
  "Date": "2025-12-13T10:00:00Z",
  "message_type": "FromWhatsappGroup",
  "PureText": "Texto da mensagem",
  "Claims": {
    "1": { "text": "Afirmação a ser verificada" }
  },
  "ResponseByDataSource": [
    {
      "data_source_id": "source_1",
      "claim_verdicts": [
        {
          "claim_id": "1",
          "Result": "Verdadeiro",
          "reasoningText": "Justificativa",
          "reasoningSources": []
        }
      ]
    }
  ]
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Análise criada com sucesso",
  "document_id": "abc123",
  "verification_url": "https://analytics.example.com/verificacao/abc123"
}
```

---

### 1.2. Serviços de Dados

Camada de abstração para comunicação com as bases de dados.

#### **BigQueryService** (`app/services/bigquery_service.py`)

Gerencia todas as operações com Google BigQuery.

**Funcionalidades:**

- **Busca Semântica (VECTOR_SEARCH)**:
  - Usa embeddings Gemini (`gemini-embedding-001`)
  - Busca por similaridade de cosseno
  - Aplicada automaticamente quando há termo de busca

- **Inserção de Análises**:
  - Validação de duplicatas
  - Inserção de claims com vereditos e fontes
  - Armazenamento de métricas agregadas

- **Consultas Analíticas**:
  - Estatísticas gerais (total de verificações, afirmações)
  - Dashboard (distribuição de resultados, modalidades)
  - Listagem com filtros avançados
  - Agregação de fontes citadas

**Configuração:**
```python
# Variáveis de ambiente necessárias
GOOGLE_CLOUD_PROJECT=seu-projeto
BIGQUERY_DATASET=fact_checking_analytics
BIGQUERY_TABLE=analises
```

**Exemplo de Query (VECTOR_SEARCH):**
```sql
SELECT base.*
FROM VECTOR_SEARCH(
  (SELECT * FROM `projeto.dataset.analises`),
  'embedding',
  (SELECT @query_emb AS prompt_embedding),
  top_k => 10,
  distance_type => 'COSINE'
)
ORDER BY processed_at DESC
```

#### **FirestoreService** (`app/services/firestore_service.py`)

Gerencia operações com Google Firestore.

**Funcionalidades:**

- **Armazenamento rápido**: Backup e recuperação instantânea
- **Interações de usuários**: Likes, dislikes, revisores
- **Listagem com filtros**: Similar ao BigQuery mas sem busca semântica
- **Perfis de usuários**: Gerenciamento de dados de revisores

**Configuração:**
```python
# Inicialização automática via Application Default Credentials
# Ou via service account JSON
```

**Collections:**
- `analises`: Análises de verificação
- `users`: Perfis de usuários revisores

---

### 1.3. Endpoints de Consulta (GET)

Servem dados para o cliente web com filtros e paginação.

#### **GET /analises**

Lista análises com filtros avançados e paginação.

**Parâmetros:**
- `limit` (int): Número de resultados (1-100, padrão: 10)
- `offset` (int): Pular N resultados (paginação)
- `search` (str): Termo de busca (ativa VECTOR_SEARCH)
- `message_type_whatsapp` (bool): Filtrar WhatsApp
- `message_type_direct` (bool): Filtrar mensagens diretas
- `modality_text/audio/video/image` (bool): Filtrar por modalidade
- `result_true/fake/unknown` (bool): Filtrar por resultado
- `min/max_truth_score` (int): Filtrar por % verdadeiro
- `min/max_fake_score` (int): Filtrar por % falso
- `min/max_unverified_score` (int): Filtrar por % não verificado

**Comportamento:**
- **Sem busca**: Consulta Firestore (rápido, ordenado por data)
- **Com busca**: Consulta BigQuery com VECTOR_SEARCH (semântico)

#### **GET /analises/{document_id}**

Busca uma análise específica por ID.

#### **GET /analises/dashboard**

Retorna métricas agregadas para visualização em dashboard.


#### **GET /analises/stats**

Estatísticas gerais do sistema.

#### **GET /analises/sources**

Lista fontes citadas com contagem de citações.

#### **GET /analises/export/{dashboard|messages|sources}**

Exporta dados em formato CSV.

---

### 1.4. CI/CD - Backend

O backend é implantado no **Google Cloud Run** com build automático.

#### **Dockerfile**

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```


#### **Configuração de Variáveis**

No Google Cloud Console → Cloud Run → Service → Variables:
- `GOOGLE_API_KEY`: API key do Gemini
- `GOOGLE_CLOUD_PROJECT`: ID do projeto
- `BIGQUERY_DATASET`: Dataset do BigQuery
- `BIGQUERY_TABLE`: Tabela de análises

#### **Pipeline de Deploy**

1. Push para branch `main`
2. Trigger automático no Cloud Build
3. Build da imagem Docker
4. Push para Container Registry
5. Deploy no Cloud Run (sem downtime)
6. Health check automático

---

## 💻 Frontend

Interface web construída com React e TypeScript para visualização de dados.

### 2.1. Páginas Principais

#### **Página Inicial (`/`)**

**Componente:** `frontend/src/pages/Index.tsx`

**Funcionalidades:**
- Hero section com estatísticas em tempo real
- Top revisores da semana (likes/dislikes)
- Grid de verificações recentes (3x3)
- Paginação com "Carregar Mais"
- Links para WhatsApp e exploração de dados

**Dados Exibidos:**
- Total de verificações
- Total de afirmações analisadas
- Percentual de fake news
- Ranking de usuários mais ativos

#### **Busca (`/busca`)**

**Componente:** `frontend/src/pages/Busca.tsx`

**Funcionalidades:**
- Três abas: Visão Geral, Mensagens, Fontes
- Filtros avançados (modalidade, percentuais, tipos)
- Busca semântica por texto
- Exportação CSV de cada aba
- Gráficos de distribuição (Recharts)
- Tabela paginada de resultados

**Visualizações:**
- Gráfico de barras: Modalidades
- Métricas: Total de mensagens, afirmações, verdadeiras, falsas
- Tabela: Data, tipo, título, afirmações, resultado, tópicos

#### **Verificação (`/verificacao/:id`)**

**Componente:** `frontend/src/pages/Verification.tsx`

**Funcionalidades:**
- Visualização detalhada de uma análise
- Barra de "Nível de Veracidade" segmentada (verde/vermelho/amarelo/cinza)
- Contadores de métricas (verdadeiras, falsas, fora de contexto, não verificadas)
- Indicadores coloridos (bolinhas) por tipo de claim
- Acordeões expansíveis para cada claim
- Visualização de árvore de decisão IPTC
- Links para fontes consultadas
- Sistema de likes/dislikes (requer login)
- Visualização de revisores que avaliaram
- Botão de compartilhamento
- Badges de modalidade (texto, áudio, vídeo, imagem)

#### **Perfil (`/perfil/:id`)**

**Componente:** `frontend/src/pages/Profile.tsx`

**Funcionalidades:**
- Visualização de perfil público de revisores
- Estatísticas de avaliações
- Links para redes sociais (LinkedIn)
- Histórico de interações

#### **Login/Cadastro (`/entrar`, `/cadastro`)**

**Componentes:** `frontend/src/pages/Login.tsx`, `Register.tsx`

**Funcionalidades:**
- Integração com Firebase Auth
- Login social (Google, GitHub)
- Registro com email e senha
- Validação de formulários
- Redirecionamento após login

#### **Sobre (`/sobre`)**

Informações sobre o projeto e metodologia.

#### **Seja um Revisor (`/seja-um-revisor`)**

Página de convite para participar como revisor.

#### **Verificação Não Encontrada (`/verificacao-nao-encontrada/:id?`)**

**Componente:** `frontend/src/pages/NotFoundVerification.tsx`

**Funcionalidades:**
- Exibida quando análise não é encontrada
- Mensagens explicativas (processando, ID incorreto, removida)
- Botão "Tentar Novamente" (refaz requisição)
- Botão "Voltar para Início"

---

### 2.2. Recursos de Acessibilidade

#### **VLibras**

**Componente:** `frontend/src/components/VLibrasController.tsx`

**Funcionalidades:**
- Widget de tradução para Língua Brasileira de Sinais
- Toggle no header para ativar/desativar
- Integração com script oficial do VLibras
- Persistência de preferência em localStorage

#### **Outros Recursos de Acessibilidade:**

- **Componentes Shadcn UI**: Todos acessíveis por padrão (ARIA labels, keyboard navigation)
- **Contraste de cores**: Segue WCAG 2.1 AA
- **Títulos semânticos**: Hierarquia correta de H1-H6
- **Focus visível**: Indicadores de foco para navegação por teclado
- **Alt text**: Todas as imagens com descrição
- **Tooltips descritivos**: Em ícones e botões

---

### 2.3. Integração com Firebase Auth

**Configuração:** `frontend/src/auth/`

#### **AuthProvider** (`auth/index.tsx`)

Context provider que gerencia estado de autenticação global da aplicação.

#### **Fluxo de Login**

1. Usuário clica em "Entrar"
2. Preenche credenciais ou usa login social
3. Firebase valida e retorna token
4. Token armazenado automaticamente
5. `onAuthStateChanged` atualiza estado global
6. UI reflete usuário logado

#### **Proteção de Rotas**

Ações sensíveis (likes, dislikes) verificam autenticação antes de executar. Usuários não autenticados são redirecionados para a página de login.

#### **Interações de Usuário**

**Likes/Dislikes nas Verificações:**
- Requer autenticação
- Atualização otimista (UI atualiza antes da resposta)
- Sincronização com Firestore
- Exibição de revisores que avaliaram

---

### 2.4. CI/CD - Frontend

Deploy automático no **Netlify** com build otimizado.

#### **netlify.toml**

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
  VITE_API_URL = "https://analytics-backend.run.app"
```

#### **Variáveis de Ambiente**

No Netlify Dashboard → Site Settings → Environment Variables:
- `VITE_API_URL`: URL do backend em Cloud Run
- `VITE_FIREBASE_API_KEY`: API Key do Firebase
- `VITE_FIREBASE_AUTH_DOMAIN`: Auth domain
- `VITE_FIREBASE_PROJECT_ID`: Project ID
- (outras configs do Firebase)

#### **Pipeline de Deploy**

1. Push para branch `main`
2. Webhook automático para Netlify
3. Instalação de dependências (`npm install`)
4. Build do Vite (`npm run build`)
5. Otimização de assets (minificação, tree-shaking)
6. Deploy para CDN global
7. Invalidação de cache
8. Preview deploy para PRs

#### **Build Optimizations**

- Code splitting automático (lazy loading de rotas)
- Minificação de JS/CSS
- Compressão gzip/brotli
- Assets com hash para cache-busting
- Preload de componentes críticos

---

### 2.5. Funcionalidade de Busca

Sistema avançado de busca com filtros múltiplos e busca semântica.

#### **Busca Semântica**

**Como Funciona:**
1. Usuário digita termo de busca (ex: "vacina covid")
2. Frontend envia para backend: `GET /analises?search=vacina+covid`
3. Backend usa **VECTOR_SEARCH** do BigQuery:
   - Gera embedding do termo usando Gemini
   - Busca por similaridade de cosseno
   - Retorna top 10 resultados mais relevantes
4. Frontend exibe resultados ordenados por relevância

**Vantagens:**
- Encontra conteúdo semanticamente similar (não apenas palavras-chave)
- "vacina covid" encontra "imunização contra coronavirus"
- Busca multilíngue (embeddings entendem contexto)

#### **Filtros Avançados**

**Componente:** `frontend/src/components/FilterSection.tsx`

**Tipos de Filtros:**

1. **Modalidade:**
   - Texto
   - Áudio
   - Vídeo
   - Imagem

2. **Tipo de Mensagem:**
   - WhatsApp (grupos)
   - Mensagem Direta

3. **Resultado:**
   - Verdadeiro
   - Falso
   - Fontes insuficientes para verificar

4. **Percentuais (Sliders):**
   - % mínimo/máximo de verdadeiro
   - % mínimo/máximo de falso
   - % mínimo/máximo de não verificado

Os filtros são convertidos em query parameters e enviados ao backend via GET request.

#### **Debouncing de Busca**

Para evitar requests excessivos durante digitação, a busca aguarda 500ms de inatividade antes de executar a consulta.

#### **Paginação**

- Offset-based pagination
- Limite configurável (padrão: 10)
- Botões Anterior/Próximo
- Indicador de "tem mais resultados"

#### **Exportação de Resultados**

Os resultados filtrados podem ser exportados em formato CSV, mantendo todos os filtros aplicados. O download é iniciado automaticamente após a geração do arquivo.

**Campos Exportados:**
- ID, Data, Tipo, Título
- Veredito geral, Comentário final
- Texto da mensagem, transcrições
- Links raspados (detalhado)
- Quantidade de afirmações
- Percentuais (verdadeiro, falso, não verificado)
- Tópicos IPTC
- Afirmações detalhadas com fontes

---

<a id="funcionalidades"></a>
## ✨ Funcionalidades

### Para Usuários

- ✅ **Visualização de verificações recentes** - Grid de cards na página inicial
- ✅ **Busca semântica** - Encontre verificações por contexto, não apenas palavras
- ✅ **Filtros avançados** - Por modalidade, tipo, percentuais de veracidade
- ✅ **Visualização detalhada** - Claims, fontes, raciocínios, tópicos IPTC
- ✅ **Árvore de decisão IPTC** - Visualização interativa de classificação
- ✅ **Sistema de avaliação** - Like/dislike de verificações (requer login)
- ✅ **Exportação CSV** - Dashboard, mensagens e fontes
- ✅ **Acessibilidade VLibras** - Tradução para Libras
- ✅ **Responsivo** - Funciona em mobile, tablet e desktop

### Para Pesquisadores

- ✅ **API RESTful** - Acesso programático aos dados
- ✅ **BigQuery direto** - Consultas SQL customizadas
- ✅ **Métricas agregadas** - Estatísticas de fake news
- ✅ **Exportação em massa** - CSV com dados completos
- ✅ **Classificação IPTC** - Tópicos padronizados internacionalmente
- ✅ **Embeddings semânticos** - Análise de similaridade

<a id="contato"></a>
## 📧 Contato

Para dúvidas ou sugestões, entre em contato através do repositório GitHub.

---

**Desenvolvido com ❤️ para combater a desinformação no Brasil**
