import requests
import json
import time
import uuid

API_URL = "http://localhost:8000"

def test_title_generation():
    # 1. Cria payload
    payload = {
        "DocumentId": str(uuid.uuid4()),
        "Date": "2023-10-27T10:00:00Z",
        "message_type": "FromWhatsappGroup",
        "PureText": "O governo anunciou um novo aumento no salário mínimo para 2024. O valor será de R$ 1.412,00.",
        "FinalTranscribedText": "O governo anunciou um novo aumento no salário mínimo para 2024. O valor será de R$ 1.412,00.",
        "FinalResponseText": "A informação é verdadeira.",
        "ScrapedLinks": [],
        "Claims": {
            "claim-1": {
                "claimId": "claim-1",
                "text": "O salário mínimo será R$ 1.412,00 em 2024.",
                "verdict": "True",
                "reasoning": "Confirmado por fontes oficiais.",
                "topics": ["Economia"],
                "sources": []
            }
        },
        "ResponseByDataSource": []
    }

    print(f"📤 Enviando análise {payload['DocumentId']}...")
    response = requests.post(f"{API_URL}/analises", json=payload)
    
    if response.status_code != 201:
        print(f"❌ Erro ao criar análise: {response.status_code}")
        print(response.text)
        return

    print("✅ Análise criada com sucesso!")
    doc_id = payload["DocumentId"]

    # 2. Aguarda um pouco para garantir consistência (se necessário)
    time.sleep(2)

    # 3. Busca a análise para verificar o título
    print(f"🔍 Buscando análise {doc_id}...")
    response = requests.get(f"{API_URL}/analises/{doc_id}")
    
    if response.status_code != 200:
        print(f"❌ Erro ao buscar análise: {response.status_code}")
        return

    data = response.json()
    if not data["success"]:
        print("❌ API retornou erro na busca.")
        return

    analysis = data["data"]
    title = analysis.get("analysis_title")
    
    print(f"📋 Título gerado: '{title}'")
    
    if title:
        print("✅ Título gerado com sucesso!")
    else:
        print("⚠️ Título não encontrado ou vazio.")

if __name__ == "__main__":
    test_title_generation()
