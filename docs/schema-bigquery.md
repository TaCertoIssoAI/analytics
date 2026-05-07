# Schema BigQuery - Tabela de Analises

Este documento descreve em detalhes o esquema da tabela principal do BigQuery utilizada para armazenar as analises de fact-checking realizadas pelo bot.

## Visao Geral dos Campos

| Campo | Tipo | Modo | Descricao |
|-------|------|------|-----------|
| `claims` | RECORD | REPEATED | Lista de alegacoes (claims) identificadas na mensagem do usuario, cada uma com seu veredito, fontes e raciocinio |
| `final_comment` | STRING | NULLABLE | Comentario final gerado pela IA ao termino da analise completa |
| `analysis_metrics` | RECORD | NULLABLE | Metricas agregadas da analise, com contagens e scores por categoria de veredito |
| `overall_verdict` | STRING | NULLABLE | Veredito geral da analise (ex: VERDADEIRO, FALSO, FORA_DE_CONTEXTO, INVERIFICAVEL) |
| `scraped_links` | RECORD | REPEATED | Lista de links externos que foram raspados (scraped) durante a verificacao |
| `processed_at` | TIMESTAMP | NULLABLE | Data e hora em que a analise foi processada e salva |
| `source_type` | STRING | NULLABLE | Tipo da fonte da mensagem (ex: whatsapp, web) |
| `user_message_text` | STRING | NULLABLE | Texto original da mensagem enviada pelo usuario ao bot |
| `media_info` | RECORD | NULLABLE | Informacoes sobre midias (imagem, video, audio) anexadas a mensagem do usuario |
| `analysis_title` | STRING | NULLABLE | Titulo gerado automaticamente para a analise |
| `full_combined_text` | STRING | NULLABLE | Texto combinado completo usado para gerar o embedding (inclui titulo, claims, vereditos, etc.) |
| `document_id` | STRING | NULLABLE | Identificador unico do documento/analise |
| `embedding` | FLOAT | REPEATED | Vetor de embedding semantico com **768 dimensoes**, gerado pelo modelo `gemini-embedding-001` do Google Vertex AI. Utilizado para busca semantica por similaridade |

---

## Campos RECORD em Detalhe

### `claims` (RECORD, REPEATED)

Cada elemento da lista representa uma alegacao individual identificada na mensagem do usuario.

| Sub-campo | Tipo | Modo | Descricao |
|-----------|------|------|-----------|
| `claim_id` | STRING | NULLABLE | Identificador unico da claim |
| `text` | STRING | NULLABLE | Texto da alegacao extraida da mensagem do usuario |
| `verdict` | STRING | NULLABLE | Veredito atribuido a esta claim (ex: VERDADEIRO, FALSO, FORA_DE_CONTEXTO, INVERIFICAVEL) |
| `reasoning` | STRING | NULLABLE | Raciocinio e justificativa da IA para o veredito dado |
| `final_comment` | STRING | NULLABLE | Comentario final especifico desta claim |
| `topics` | STRING | REPEATED | Lista de topicos/categorias associados a esta claim (classificacao IPTC) |
| `sources` | RECORD | REPEATED | Fontes utilizadas para verificar esta claim |

#### `claims.sources` (RECORD, REPEATED)

Fontes de referencia usadas na verificacao de cada claim.

| Sub-campo | Tipo | Modo | Descricao |
|-----------|------|------|-----------|
| `title` | STRING | NULLABLE | Titulo da fonte |
| `citation_text` | STRING | NULLABLE | Trecho citado da fonte utilizado na verificacao |
| `publisher` | STRING | NULLABLE | Nome do publicador/veiculo da fonte |
| `url` | STRING | NULLABLE | URL da fonte |

---

### `analysis_metrics` (RECORD, NULLABLE)

Metricas agregadas calculadas a partir dos vereditos de todas as claims da analise.

| Sub-campo | Tipo | Modo | Descricao |
|-----------|------|------|-----------|
| `total_claims` | INTEGER | NULLABLE | Numero total de claims identificadas na analise |
| `true_count` | INTEGER | NULLABLE | Quantidade de claims classificadas como VERDADEIRO |
| `fake_count` | INTEGER | NULLABLE | Quantidade de claims classificadas como FALSO |
| `unverified_count` | INTEGER | NULLABLE | Quantidade de claims classificadas como INVERIFICAVEL |
| `out_of_context_count` | INTEGER | NULLABLE | Quantidade de claims classificadas como FORA_DE_CONTEXTO |
| `truth_score` | INTEGER | NULLABLE | Pontuacao/percentual de claims verdadeiras |
| `fake_score` | INTEGER | NULLABLE | Pontuacao/percentual de claims falsas |
| `unverified_score` | INTEGER | NULLABLE | Pontuacao/percentual de claims inverificaveis |
| `out_of_context_score` | INTEGER | NULLABLE | Pontuacao/percentual de claims fora de contexto |

---

### `scraped_links` (RECORD, REPEATED)

Links externos que foram acessados e raspados durante o processo de verificacao.

| Sub-campo | Tipo | Modo | Descricao |
|-----------|------|------|-----------|
| `url` | STRING | NULLABLE | URL do link raspado |
| `title` | STRING | NULLABLE | Titulo da pagina raspada |
| `scraped_text` | STRING | NULLABLE | Conteudo textual extraido da pagina |

---

### `media_info` (RECORD, NULLABLE)

Informacoes sobre midias que acompanham a mensagem do usuario.

| Sub-campo | Tipo | Modo | Descricao |
|-----------|------|------|-----------|
| `has_image` | BOOLEAN | NULLABLE | Indica se a mensagem contem uma imagem |
| `image_uri` | STRING | NULLABLE | URI de armazenamento da imagem |
| `image_text` | STRING | NULLABLE | Texto extraido da imagem via OCR ou descricao |
| `has_video` | BOOLEAN | NULLABLE | Indica se a mensagem contem um video |
| `video_uri` | STRING | NULLABLE | URI de armazenamento do video |
| `video_text` | STRING | NULLABLE | Texto extraido ou legenda do video |
| `has_audio` | BOOLEAN | NULLABLE | Indica se a mensagem contem um audio |
| `audio_uri` | STRING | NULLABLE | URI de armazenamento do audio |
| `audio_text` | STRING | NULLABLE | Texto transcrito do audio |

---

## Observacoes sobre o Embedding

- **Modelo:** `gemini-embedding-001` (Google Vertex AI)
- **Dimensoes:** 768
- **Tipo de tarefa:** `RETRIEVAL_QUERY` para consultas de busca, `RETRIEVAL_DOCUMENT` para indexacao de documentos
- **Armazenamento:** Vetor de 768 floats armazenado como campo REPEATED no BigQuery
- **Uso:** Busca semantica por similaridade de cosseno entre a query do usuario e os documentos indexados
