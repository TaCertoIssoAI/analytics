# 🔧 Backend

[⬅️ Voltar ao Índice](../README.md)

## Estrutura

O backend é construído com **FastAPI** e organizado em camadas para separação de responsabilidades.



## Endpoints de Ingestão (POST)

Responsáveis por receber dados do bot de WhatsApp, processar e armazenar nas bases de dados.

### POST /analises

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



## Serviços de Dados

Camada de abstração para comunicação com as bases de dados.

### BigQueryService

**Arquivo:** `app/services/bigquery_service.py`

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

### FirestoreService

**Arquivo:** `app/services/firestore_service.py`

**Funcionalidades:**

- **Armazenamento rápido**: Backup e recuperação instantânea
- **Interações de usuários**: Likes, dislikes, revisores
- **Listagem com filtros**: Similar ao BigQuery mas sem busca semântica
- **Perfis de usuários**: Gerenciamento de dados de revisores

**Collections:**
- `analises`: Análises de verificação
- `users`: Perfis de usuários revisores



## Endpoints de Consulta (GET)

Servem dados para o cliente web com filtros e paginação.

### GET /analises

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

### GET /analises/{document_id}

Busca uma análise específica por ID.

### GET /analises/dashboard

Retorna métricas agregadas para visualização em dashboard.

### GET /analises/stats

Estatísticas gerais do sistema.

### GET /analises/sources

Lista fontes citadas com contagem de citações.

### GET /analises/export/{dashboard|messages|sources}

Exporta dados em formato CSV.



## CI/CD

O backend é implantado no **Google Cloud Run** com build automático.

### Dockerfile

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Configuração de Variáveis

No Google Cloud Console → Cloud Run → Service → Variables:
- `GOOGLE_API_KEY`: API key do Gemini
- `GOOGLE_CLOUD_PROJECT`: ID do projeto
- `BIGQUERY_DATASET`: Dataset do BigQuery
- `BIGQUERY_TABLE`: Tabela de análises

### Pipeline de Deploy

1. Push para branch `main`
2. Trigger automático no Cloud Build
3. Build da imagem Docker
4. Push para Container Registry
5. Deploy no Cloud Run (sem downtime)
6. Health check automático



## Documentação Relacionada

- [🏗 Arquitetura](./arquitetura.md)
- [💻 Frontend](./frontend.md)
- [🛠 Como Rodar Localmente](./setup.md)
- [✨ Funcionalidades](./funcionalidades.md)



[⬅️ Voltar ao Índice](../README.md)
