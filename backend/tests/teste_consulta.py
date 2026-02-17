import os
import json
from datetime import datetime, date
from google.cloud import bigquery
from dotenv import load_dotenv

# 1. Carrega suas credenciais do .env
load_dotenv()

# Configurações
PROJECT_ID = "sitegrupysanca"
DATASET_ID = "analytics_whatsapp_br"
TABLE_ID = os.getenv("BIGQUERY_TABLE")

def json_serial(obj):
    """Função auxiliar para permitir que o JSON imprima datas (datetime)"""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def consultar_ultima_analise():
    print("🔍 Conectando ao BigQuery...")
    
    client = bigquery.Client()
    
    # 2. A Query SQL
    # Pegamos a última inserida (ORDER BY processed_at DESC LIMIT 1)
    query = f"""
        SELECT *
        FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
        ORDER BY processed_at DESC
        LIMIT 1
    """
    
    print("⚡ Executando consulta...")
    query_job = client.query(query)  # Faz a requisição API

    # 3. Processar os resultados
    resultados = list(query_job)
    
    if not resultados:
        print("📭 A tabela está vazia ou não encontrei resultados.")
        return

    print(f"✅ Encontrado! Mostrando a análise mais recente:\n")

    for row in resultados:
        # Converte a linha do BigQuery (Row) para um Dicionário Python normal
        dados = dict(row)
        
        # Imprime formatado (Bonito)
        print(json.dumps(dados, indent=4, default=json_serial, ensure_ascii=False))

if __name__ == "__main__":
    consultar_ultima_analise()