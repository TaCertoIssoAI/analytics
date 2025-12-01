import os
import json
import time
import traceback
from google.cloud import pubsub_v1
from google.cloud import bigquery
from dotenv import load_dotenv

# 1. Carrega as variáveis do arquivo .env
load_dotenv()

# Importa sua classe de classificação
from iptc_classifier import IptcEmbeddingTree

PROJECT_ID = "sitegrupysanca"
SUBSCRIPTION_ID = "novas-analises-sub"
DATASET_ID = "analytics_whatsapp_br"
TABLE_ID = "analises_complexas_br"

# --- INICIALIZAÇÃO GLOBAL ---
print("⏳ Carregando Taxonomia IPTC e Embeddings (isso pode levar alguns segundos)...")
try:
    iptc_tree = IptcEmbeddingTree(
        json_path="cptall-pt-BR.json",
        embeddings_path="iptc_embeddings.npz"
    )
    print("✅ Classificador IPTC carregado com sucesso!")
except Exception as e:
    print(f"❌ Erro fatal ao carregar IPTC: {e}")
    exit(1)

# Clientes Google
subscriber = pubsub_v1.SubscriberClient()
bq_client = bigquery.Client()
subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_ID)
table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"


def classificar_texto(texto_claim):
    """
    Usa a classe IPTC para descobrir os tópicos.
    """
    if not texto_claim or len(texto_claim) < 5:
        return []
    
    try:
        resultado = iptc_tree.classify_claim(
            text=texto_claim,
            max_depth=4,
            top_k_concepts=5,
            rerank_with_llm=True,
            llm_model="gpt-4o-mini"
        )
        
        topicos = [resultado['main_category']] + resultado['subcategories']
        return list(dict.fromkeys([t for t in topicos if t]))
    
    except Exception as e:
        print(f"⚠️ Erro ao classificar claim: {e}")
        return []

def calcular_veredito_automatico(claims):
    """
    Gera a TAG para o frontend (FAKE, TRUE, MISLEADING, CHECK).
    Baseado na mistura de vereditos das claims.
    """
    if not claims:
        return "UNVERIFIED"

    # Normaliza para maiúsculo
    vereditos = [c['verdict'].upper() for c in claims]
    
    # Palavras-chave para identificar mentira ou verdade
    tem_fake = any(v in ["FAKE", "FALSO", "FALSE"] for v in vereditos)
    tem_true = any(v in ["TRUE", "VERDADEIRO", "VERDADE"] for v in vereditos)
    
    if tem_fake and not tem_true:
        return "FAKE"         # 🔴 Vermelho
    
    if tem_true and not tem_fake:
        return "TRUE"         # 🟢 Verde
    
    if tem_fake and tem_true:
        return "MISLEADING"   # 🟡 Amarelo (Misturado)
        
    return "CHECK"            # 🔵 Azul (Outros/Sátira/Neutro)


def tratar_e_enriquecer_dados(dados):
    """
    Recebe o JSON do Bot, Classifica as Claims e formata para o BigQuery.
    """
    try:
        # --- 1. Processamento das Claims ---
        lista_claims_bq = []
        raw_claims = dados.get("Claims", {})
        raw_responses = dados.get("ResponseByClaim", {})

        print(f"   > Processando {len(raw_claims)} claims...")

        for key, claim_data in raw_claims.items():
            response_data = raw_responses.get(key, {})
            texto_da_claim = claim_data.get("text", "")
            
            # Classificação IPTC automática
            topicos_finais = claim_data.get("topics", [])
            if not topicos_finais and texto_da_claim:
                print(f"     - Classificando: '{texto_da_claim[:20]}...'")
                topicos_finais = classificar_texto(texto_da_claim)

            # Objeto da Claim
            claim_obj = {
                "claim_id": key,
                "text": texto_da_claim,
                "verdict": response_data.get("Result", "Unverified"),
                "reasoning": response_data.get("reasoningText", ""),
                "topics": topicos_finais,
                "sources": response_data.get("reasoningSources", [])
            }
            lista_claims_bq.append(claim_obj)

        # --- 2. Cálculo do Veredito (TAG vs TEXTO) ---
        # A Tag curta (FAKE, TRUE...)
        veredito_tag = calcular_veredito_automatico(lista_claims_bq)
        
        # O Texto longo explicativo (Prioriza o comentário geral, senão usa o texto final)
        comentario_longo = dados.get("CommentAboutCompleteContext")
        if not comentario_longo:
            comentario_longo = dados.get("FinalResponseText", "Análise realizada.")

        # --- 3. Processamento dos Links Raspados ---
        raw_links = dados.get("ScrapedLinks", [])
        lista_links_bq = []
        for link in raw_links:
            lista_links_bq.append({
                "url": link.get("url"),
                "title": link.get("title"),
                "scraped_text": link.get("text")
            })

        # --- 4. Montagem Final da Linha SQL ---
        linha_sql = {
            "document_id": dados.get("DocumentId"),
            "processed_at": dados.get("Date"),
            "source_type": dados.get("MessageType"),
            
            "user_message_text": dados.get("PureText"),
            "full_combined_text": dados.get("FinalTranscribedText"),
            "scraped_links": lista_links_bq,

            # AQUI ESTÃO OS CAMPOS INTELIGENTES:
            "overall_verdict": veredito_tag,    # Salva "FAKE"
            "final_comment": comentario_longo,  # Salva o texto explicativo
            
            "media_info": {
                "has_audio": dados.get("HadAudio", False),
                "audio_uri": dados.get("AudioUrl"),
                "audio_text": dados.get("AudioText"),
                
                "has_image": dados.get("HadImage", False),
                "image_uri": dados.get("ImageUrl"),
                "image_text": dados.get("ImageText"),
                
                "has_video": dados.get("HadVideo", False),
                "video_uri": dados.get("VideoUrl"),
                "video_text": dados.get("VideoText")
            },
            
            "claims": lista_claims_bq
        }
        return linha_sql

    except Exception as e:
        print(f"❌ Erro no tratamento de dados: {e}")
        traceback.print_exc()
        return None


def callback(message):
    print(f"\n📩 [MSG ID: {message.message_id}] Recebida...")
    dados_str = message.data.decode("utf-8")
    
    try:
        dados_raw = json.loads(dados_str)
        
        linha_para_bq = tratar_e_enriquecer_dados(dados_raw)
        
        if linha_para_bq:
            errors = bq_client.insert_rows_json(table_ref, [linha_para_bq])
            
            if errors == []:
                print(f"✅ SUCESSO! Inserido no BigQuery (Doc: {linha_para_bq['document_id']})")
                message.ack()
            else:
                print(f"⚠️ Erro no BigQuery: {errors}")
                message.ack() 
        else:
            print("Dados inválidos ou erro no tratamento.")
            message.ack()
            
    except Exception as e:
        print(f"Erro fatal: {e}")
        message.nack()

def main():
    print(f"🚀 Worker Pipeline iniciado!")
    print(f"   Projeto: {PROJECT_ID}")
    print(f"   Tabela: {TABLE_ID}")
    print(f"   Escutando fila...")
    
    with subscriber:
        try:
            future = subscriber.subscribe(subscription_path, callback=callback)
            future.result()
        except KeyboardInterrupt:
            future.cancel()
            print("\nEncerrando worker.")

if __name__ == "__main__":
    main()