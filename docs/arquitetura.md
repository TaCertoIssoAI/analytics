# 🏗 Arquitetura do Sistema

[⬅️ Voltar ao Índice](../README.md)

## Visão Geral

```
┌─────────────────────────────────┐
│ Backend do Bot de fact-checking │
└────────┬────────────────────────┘
         │ POST
         ↓
┌─────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Endpoints de Ingestão (POST)             │   │
│  │  - /analises (criar nova análise)                │   │
│  │  - Transformação de dados                        │   │
│  │  - Classificação IPTC                            │   │
│  │  - Normalização de vereditos                     │   │
│  │  - Cálculo de métricas                           │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                   │
│                     ↓                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Serviços de Dados                      │   │
│  │  ┌────────────────────┐  ┌──────────────────┐    │   │
│  │  │  BigQuery Service  │  │ Firestore Service│    │   │
│  │  │  - VECTOR_SEARCH   │  │ - get_analise()  │    │   │
│  │  │  - insert_analise()│  │ - save_analise() │    │   │
│  │  │  - list_analises() │  │ - list_analises()│    │   │
│  │  │  - get_stats()     │  │ - interactions   │    │   │
│  │  └────────────────────┘  └──────────────────┘    │   │
│  └──────────────────┬───────────────────────────────┘   │ 
│                     │                                   │
│                     ↓                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Endpoints de Consulta (GET)              │   │
│  │  - /analises (listar com filtros)                │   │
│  │  - /analises/{id} (buscar por ID)                │   │
│  │  - /analises/dashboard (métricas agregadas)      │   │
│  │  - /analises/stats (estatísticas gerais)         │   │
│  │  - /analises/sources (fontes citadas)            │   │
│  │  - /analises/export/* (exportação CSV)           │   │
│  └──────────────────-┬──────────────────────────────┘   │
│                      |                                  │
└──────────────────────┼──────────────────────────────────┘
                       │ HTTP/REST
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React)                       │
├─────────────────────────────────────────────────────────┤
│  - Página Inicial (verificações recentes)               │
│  - Busca (filtros avançados + busca semântica)          │
│  - Verificação (visualização detalhada)                 │
│  - Perfil de usuário                                    │
│  - Login/Cadastro (Firebase Auth)                       │
│  - Acessibilidade (VLibras)                             │
└─────────────────────────────────────────────────────────┘
```



## Fluxo de Dados

### Ingestão

1. Bot de WhatsApp envia dados via `POST /analises`
2. Backend processa e transforma os dados
3. Classificação IPTC automática com LLM
4. Armazenamento duplo (BigQuery + Firestore)
5. Retorna URL de verificação

### Consulta

1. Frontend faz requisições GET com filtros
2. Backend escolhe fonte (Firestore para velocidade, BigQuery para busca semântica)
3. Dados são formatados e retornados
4. Frontend renderiza visualizações



## Documentação Relacionada

- [🔧 Backend Detalhado](./backend.md)
- [💻 Frontend Detalhado](./frontend.md)
- [🛠 Como Rodar Localmente](./setup.md)
- [🚀 Tecnologias](./tecnologias.md)



[⬅️ Voltar ao Índice](../README.md)
