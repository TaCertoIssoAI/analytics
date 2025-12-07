# Tá Certo Isso AI - Analytics

Plataforma de analytics e verificação de fatos para o bot "Tá Certo Isso AI".

## Tecnologias

- **Frontend**: React, Vite, Tailwind CSS, Shadcn UI, Recharts.
- **Backend**: Python, FastAPI, Google BigQuery, Firestore.

## Como Rodar

### Backend
```bash
cd backend
pip install -r requirements.txt
export GOOGLE_API_KEY=seu_api_key
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🛠 Funcionalidades
- Dashboard de estatísticas de fake news.
- Busca e filtro de mensagens verificadas.
- Visualização da árvore de decisão de checagem.
- Página de metodologia com diagrama interativo.
