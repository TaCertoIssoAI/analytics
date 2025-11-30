import os
import json
from google.cloud import pubsub_v1
from dotenv import load_dotenv # <--- 1. Importar a biblioteca

# 2. Carregar o arquivo .env
load_dotenv()

# Verifica se a chave carregou corretamente (opcional, mas bom para debug)
if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    print("❌ ERRO: O arquivo .env não foi carregado ou a chave GOOGLE_APPLICATION_CREDENTIALS está faltando.")
    exit(1)

# Configurações do Projeto GCP
project_id = "sitegrupysanca"
topic_id = "novas-analises"

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(project_id, topic_id)

# Nome do arquivo que vamos ler
# (Certifique-se de usar o nome do arquivo que você quer testar, ex: exemplo_analise.json ou exemplo_complexo.json)
arquivo_nome = "exemplo_analise.json" 

def enviar_arquivo():
    try:
        # 3. Ler o arquivo JSON da pasta local
        print(f"Lendo arquivo: {arquivo_nome}...")
        
        with open(arquivo_nome, "r", encoding="utf-8") as f:
            dados_dict = json.load(f) # Carrega para garantir que o JSON é válido
        
        # Converte de volta para string e depois bytes para o envio
        dados_bytes = json.dumps(dados_dict).encode("utf-8")
        
        # 4. Publicar no Google Cloud Pub/Sub
        future = publisher.publish(topic_path, dados_bytes)
        
        print(f"✅ Sucesso! Mensagem enviada.")
        print(f"ID da mensagem no Google: {future.result()}")
        
    except FileNotFoundError:
        print(f"❌ Erro: O arquivo '{arquivo_nome}' não foi encontrado na pasta.")
    except Exception as e:
        print(f"❌ Ocorreu um erro: {e}")

if __name__ == "__main__":
    enviar_arquivo()