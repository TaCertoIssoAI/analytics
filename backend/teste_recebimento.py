import os
import json
from google.cloud import pubsub_v1
from dotenv import load_dotenv # <--- 1. Importar

# 2. Carregar variáveis do .env
load_dotenv()

# Configurações
project_id = "sitegrupysanca"
subscription_id = "novas-analises-sub" 

subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(project_id, subscription_id)

def callback(message):
    print("\n--- MENSAGEM RECEBIDA ---")
    
    # Decodifica os bytes para string e depois para JSON para ficar legível
    dados_str = message.data.decode("utf-8")
    try:
        dados_json = json.loads(dados_str)
        print(json.dumps(dados_json, indent=4, ensure_ascii=False))
    except:
        print(dados_str)
        
    print("-------------------------\n")
    
    # Importante: Confirma para o Google que recebeu (ACK). 
    message.ack()

print(f"📡 Escutando por mensagens em: {subscription_id}...")
print("Pressione Ctrl+C para parar.")

streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)

# Mantém o script rodando esperando mensagens
with subscriber:
    try:
        streaming_pull_future.result()
    except KeyboardInterrupt:
        streaming_pull_future.cancel()
        print("\nEncerrando recebimento.")