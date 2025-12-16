# Sistema de Recomendações de Verificações Similares

## Visão Geral
Sistema que recomenda verificações similares baseado nas categorias IPTC das afirmações verificadas. As recomendações aparecem no final da página de verificação (`/verificacao/{id}`) e são carregadas em background após o carregamento principal.

## Arquitetura

### Backend

#### 1. Método `get_similar_analyses()` - `bigquery_service.py`
Algoritmo inteligente que busca verificações similares baseado nos tópicos IPTC:

**Funcionamento:**
1. **Extração de Tópicos**: Extrai todos os tópicos IPTC de todas as claims da verificação atual
2. **Organização Hierárquica**: Organiza os tópicos por nível de especificidade
   - Tópicos IPTC seguem formato hierárquico: `"categoria > subcategoria > tópico específico"`
   - Exemplo: `"política > eleições > campanha eleitoral"` (nível 3)
   - Níveis mais altos = mais específicos
3. **Pontuação por Relevância**: Atribui peso aos tópicos baseado no nível
   - Tópicos de nível 3 (específicos) = peso 3
   - Tópicos de nível 2 (intermediários) = peso 2
   - Tópicos de nível 1 (gerais) = peso 1
4. **Query SQL Otimizada**: 
   - Usa CTEs (Common Table Expressions) para performance
   - Calcula `total_score` (soma de todos os matches) e `max_level_match` (maior nível encontrado)
5. **Ordenação Inteligente**:
   - Primeiro: `max_level_match DESC` (prioriza matches nos níveis mais específicos)
   - Segundo: `total_score DESC` (prioriza verificações com mais tópicos em comum)
   - Terceiro: `processed_at DESC` (mais recentes primeiro, em caso de empate)

**Por que esse algoritmo funciona bem:**
- Prioriza similaridade temática precisa (tópicos específicos compartilhados)
- Permite descobrir verificações relacionadas mesmo se não compartilham tópicos exatos (sobe na hierarquia)
- Evita recomendações muito genéricas (peso menor para categorias amplas)
- Balanceia especificidade com quantidade de matches

#### 2. Endpoint `/analises/{document_id}/recommendations` - `analises.py`
- **Método**: GET
- **Parâmetros**: 
  - `document_id`: ID da verificação
  - `limit`: Número de recomendações (default: 8, max: 20)
- **Retorno**: Lista de análises com título, veredito, métricas e tópicos matched
- **Performance**: Otimizado com cache de embeddings e índices BigQuery

### Frontend

#### 3. Componente `RecommendationsSection.tsx`
Componente React que exibe as recomendações:

**Características:**
- **Carregamento Assíncrono**: Carrega em background com delay de 500ms para não competir com conteúdo principal
- **Loading State**: Mostra spinner enquanto carrega
- **Graceful Degradation**: Não mostra nada se houver erro ou sem resultados
- **Design Responsivo**: Grid adaptativo (1 coluna mobile, 2 tablet, 4 desktop)
- **Cards Compactos**: Título, badge de veredito, data, métricas e até 2 tópicos
- **Hover Effects**: Escala e sombra ao passar mouse
- **Link Direto**: Click no card leva para a verificação

#### 4. Integração em `Verification.tsx`
- Adicionado no final da página, após todas as seções principais
- Recebe apenas o `documentId` como prop
- Renderiza condicionalmente (só se `analysis` estiver carregada)

## Fluxo de Uso

```
1. Usuário acessa /verificacao/{id}
   ↓
2. Página carrega verificação principal
   ↓
3. 500ms depois: RecommendationsSection inicia fetch
   ↓
4. Backend extrai tópicos IPTC e busca similares no BigQuery
   ↓
5. Frontend recebe 8 verificações ordenadas por relevância
   ↓
6. Cards são exibidos em grid responsivo
   ↓
7. Usuário clica em card → navega para outra verificação
```

## Exemplos de Ranqueamento

### Caso 1: Verificação sobre "Política > Eleições > Fraude Eleitoral"

**Ranking esperado:**
1. Verificações com "fraude eleitoral" (nível 3 match)
2. Verificações com "eleições" (nível 2 match)
3. Verificações com "política" (nível 1 match)

### Caso 2: Verificação sobre "Saúde > COVID-19 > Vacinas"

**Ranking esperado:**
1. Outras verificações sobre vacinas COVID-19 (nível 3)
2. Verificações sobre COVID-19 em geral (nível 2)
3. Verificações sobre saúde pública (nível 1)

## Performance

- **Cache**: Embeddings cacheados para evitar recálculo
- **Índices**: BigQuery usa índices em `document_id` e `claims.topics`
- **Limite**: Máximo de 20 recomendações por query (default 8)
- **Background Loading**: Não bloqueia renderização da página principal
- **Timeout**: Carregamento assíncrono com tratamento de erro silencioso

## Melhorias Futuras

1. **Cache de Recomendações**: Cachear resultados no Redis para queries repetidas
2. **Personalização**: Considerar histórico do usuário
3. **A/B Testing**: Testar diferentes pesos e ordenações
4. **Analytics**: Trackear click-through rate das recomendações
5. **Feedback Loop**: Usar interações (likes/dislikes) para ajustar ranqueamento
