# 💻 Frontend

[⬅️ Voltar ao Índice](../README.md)

## Estrutura

Interface web construída com React e TypeScript para visualização de dados.



## Páginas Principais

### Página Inicial (`/`)

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

### Busca (`/busca`)

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

### Verificação (`/verificacao/:id`)

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

### Perfil (`/perfil/:id`)

**Componente:** `frontend/src/pages/Profile.tsx`

**Funcionalidades:**
- Visualização de perfil público de revisores
- Estatísticas de avaliações
- Links para redes sociais (LinkedIn)
- Histórico de interações

### Login/Cadastro (`/entrar`, `/cadastro`)

**Componentes:** `frontend/src/pages/Login.tsx`, `Register.tsx`

**Funcionalidades:**
- Integração com Firebase Auth
- Login social (Google, GitHub)
- Registro com email e senha
- Validação de formulários
- Redirecionamento após login

### Outras Páginas

- **Sobre (`/sobre`)**: Informações sobre o projeto e metodologia
- **Seja um Revisor (`/seja-um-revisor`)**: Página de convite para participar como revisor
- **Verificação Não Encontrada (`/verificacao-nao-encontrada/:id?`)**: Tratamento de erros 404



## Recursos de Acessibilidade

### VLibras

**Componente:** `frontend/src/components/VLibrasController.tsx`

**Funcionalidades:**
- Widget de tradução para Língua Brasileira de Sinais
- Toggle no header para ativar/desativar
- Integração com script oficial do VLibras
- Persistência de preferência em localStorage

### Outros Recursos

- **Componentes Shadcn UI**: Todos acessíveis por padrão (ARIA labels, keyboard navigation)
- **Contraste de cores**: Segue WCAG 2.1 AA
- **Títulos semânticos**: Hierarquia correta de H1-H6
- **Focus visível**: Indicadores de foco para navegação por teclado
- **Alt text**: Todas as imagens com descrição
- **Tooltips descritivos**: Em ícones e botões



## Integração com Firebase Auth

**Configuração:** `frontend/src/auth/`

### AuthProvider

**Arquivo:** `auth/index.tsx`

Context provider que gerencia estado de autenticação global da aplicação.

### Fluxo de Login

1. Usuário clica em "Entrar"
2. Preenche credenciais ou usa login social
3. Firebase valida e retorna token
4. Token armazenado automaticamente
5. `onAuthStateChanged` atualiza estado global
6. UI reflete usuário logado

### Proteção de Rotas

Ações sensíveis (likes, dislikes) verificam autenticação antes de executar. Usuários não autenticados são redirecionados para a página de login.

### Interações de Usuário

**Likes/Dislikes nas Verificações:**
- Requer autenticação
- Atualização otimista (UI atualiza antes da resposta)
- Sincronização com Firestore
- Exibição de revisores que avaliaram



## Funcionalidade de Busca

Sistema avançado de busca com filtros múltiplos e busca semântica.

### Busca Semântica

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

### Filtros Avançados

**Componente:** `frontend/src/components/FilterSection.tsx`

**Tipos de Filtros:**

1. **Modalidade:** Texto, Áudio, Vídeo, Imagem
2. **Tipo de Mensagem:** WhatsApp (grupos), Mensagem Direta
3. **Resultado:** Verdadeiro, Falso, Fontes insuficientes para verificar
4. **Percentuais (Sliders):**
   - % mínimo/máximo de verdadeiro
   - % mínimo/máximo de falso
   - % mínimo/máximo de não verificado

### Debouncing de Busca

Para evitar requests excessivos durante digitação, a busca aguarda 500ms de inatividade antes de executar a consulta.

### Paginação

- Offset-based pagination
- Limite configurável (padrão: 10)
- Botões Anterior/Próximo
- Indicador de "tem mais resultados"

### Exportação de Resultados

Os resultados filtrados podem ser exportados em formato CSV, mantendo todos os filtros aplicados.

**Campos Exportados:**
- ID, Data, Tipo, Título
- Veredito geral, Comentário final
- Texto da mensagem, transcrições
- Links raspados (detalhado)
- Quantidade de afirmações
- Percentuais (verdadeiro, falso, não verificado)
- Tópicos IPTC
- Afirmações detalhadas com fontes



## CI/CD

Deploy automático no **Netlify** com build otimizado.

### netlify.toml

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

### Variáveis de Ambiente

No Netlify Dashboard → Site Settings → Environment Variables:
- `VITE_API_URL`: URL do backend em Cloud Run
- `VITE_FIREBASE_API_KEY`: API Key do Firebase
- `VITE_FIREBASE_AUTH_DOMAIN`: Auth domain
- `VITE_FIREBASE_PROJECT_ID`: Project ID

### Pipeline de Deploy

1. Push para branch `main`
2. Webhook automático para Netlify
3. Instalação de dependências (`npm install`)
4. Build do Vite (`npm run build`)
5. Otimização de assets (minificação, tree-shaking)
6. Deploy para CDN global
7. Invalidação de cache
8. Preview deploy para PRs

### Build Optimizations

- Code splitting automático (lazy loading de rotas)
- Minificação de JS/CSS
- Compressão gzip/brotli
- Assets com hash para cache-busting
- Preload de componentes críticos



## Documentação Relacionada

- [🏗 Arquitetura](./arquitetura.md)
- [🔧 Backend](./backend.md)
- [🛠 Como Rodar Localmente](./setup.md)
- [✨ Funcionalidades](./funcionalidades.md)



[⬅️ Voltar ao Índice](../README.md)
