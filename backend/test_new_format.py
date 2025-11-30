import requests
import json
import uuid
from datetime import datetime

# URL da API (local)
API_URL = "http://localhost:8000/analises"

# Payload de exemplo (baseado no request do usuário)
payload = {
    "DocumentId": str(uuid.uuid4()),
    "Date": datetime.now().isoformat(),
    "message_type": "FromDirectMessage",
    "PureText": "Confira essa notícia importante: https://www.cnnbrasil.com.br/nacional/em-belem-cupula-dos-povos-cobra-participacao-popular-nas-acoes-climaticas/ sobre o Neymar no Santos.",
    "FinalTranscribedText": "Confira essa notícia importante...",
    "FinalResponseText": "Resultado da verificação:\n\nAlegação 1: A Cúpula dos Povos foi realizada em Belém do Pará entre 12 e 16 de novembro de 2025.\nVeredito: Verdadeiro...",
    "CommentAboutCompleteContext": "A primeira fonte de dados apresenta uma URL da CNN Brasil...",
    "ScrapedLinks": [
        {
            "url": "https://www.cnnbrasil.com.br/nacional/em-belem-cupula-dos-povos-cobra-participacao-popular-nas-acoes-climaticas/",
            "success": True,
            "text": "Em Belém, Cúpula dos Povos cobra participação popular nas ações climáticas..."
        }
    ],
    "HadAudio": False,
    "Claims": {
        "55b2d390-ddd1-43db-bfc4-f13119612b7a": {
            "text": "A Cúpula dos Povos foi realizada em Belém do Pará entre 12 e 16 de novembro de 2025.",
            "links": []
        }
    },
    "ResponseByDataSource": [
        {
            "data_source_id": "link-78efc568",
            "data_source_type": "link_context",
            "claim_verdicts": [
                {
                    "claim_id": "55b2d390-ddd1-43db-bfc4-f13119612b7a",
                    "claim_text": "A Cúpula dos Povos foi realizada em Belém do Pará entre 12 e 16 de novembro de 2025.",
                    "Result": "Verdadeiro",
                    "reasoningText": "A alegação é confirmada pelo texto da fonte...",
                    "reasoningSources": [
                        {
                            "url": "https://www.cnnbrasil.com.br/nacional/em-belem-cupula-dos-povos-cobra-participacao-popular-nas-acoes-climaticas/",
                            "title": "Em Belém, Cúpula dos Povos cobra participação popular nas ações climáticas",
                            "publisher": "CNN Brasil",
                            "citation_text": "Realizada em Belém do Pará..."
                        }
                    ]
                }
            ]
        }
    ]
}

print(f"📤 Enviando análise {payload['DocumentId']}...")
try:
    response = requests.post(API_URL, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 201:
        print("✅ Sucesso!")
    else:
        print("❌ Falha!")
        
except Exception as e:
    print(f"❌ Erro de conexão: {e}")
