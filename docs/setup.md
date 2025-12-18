# 🛠 Como Rodar Localmente

[⬅️ Voltar ao Índice](../README.md)

## Pré-requisitos

- Python 3.10+
- Node.js 18+
- Conta Google Cloud (BigQuery e Firestore)
- API Key do Google Gemini
- Firebase Project



## Backend

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/ta-certo-isso-ai-analytics.git
cd ta-certo-isso-ai-analytics/backend
```

### 2. Crie um ambiente virtual

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

### 3. Instale dependências

```bash
pip install -r requirements.txt
```

### 4. Configure variáveis de ambiente

```bash
export GOOGLE_API_KEY=sua_api_key_gemini
export GOOGLE_CLOUD_PROJECT=seu-projeto-id
export BIGQUERY_DATASET=fact_checking_analytics
export BIGQUERY_TABLE=analises
```

### 5. Configure credenciais do Google Cloud

Existem duas formas de autenticar com o Google Cloud:

#### Opção A: Usando gcloud CLI (Recomendado para desenvolvimento local)

```bash
gcloud auth application-default login
```

Este comando abre o navegador para você fazer login com sua conta Google.

#### Opção B: Usando Service Account JSON (Recomendado para produção)

**Passo a passo para obter o arquivo JSON:**

1. **Acesse o Google Cloud Console**:
   - Vá para [console.cloud.google.com](https://console.cloud.google.com)
   - Selecione seu projeto

2. **Crie uma Service Account**:
   - No menu lateral, vá em **IAM & Admin** → **Service Accounts**
   - Clique em **+ CREATE SERVICE ACCOUNT**
   - Dê um nome (ex: `analytics-backend`)
   - Descrição (ex: `Service account para o backend do analytics`)
   - Clique em **CREATE AND CONTINUE**

3. **Conceda permissões** (na etapa 2 do formulário):
   - **BigQuery Admin** - Para ler/escrever no BigQuery
   - **Cloud Datastore User** - Para acessar o Firestore
   - **Vertex AI User** - Para usar o Google Gemini
   - Clique em **CONTINUE** e depois **DONE**

4. **Baixe o arquivo JSON**:
   - Na lista de service accounts, encontre a que você criou
   - Clique nos **3 pontos** (⋮) à direita → **Manage keys**
   - Clique em **ADD KEY** → **Create new key**
   - Selecione **JSON**
   - Clique em **CREATE** - o arquivo será baixado automaticamente

5. **Configure a variável de ambiente**:
   ```bash
   # Mova o arquivo para um local seguro
   mkdir -p ~/.gcp
   mv ~/Downloads/seu-projeto-xxxxx.json ~/.gcp/analytics-credentials.json
   
   # Configure a variável de ambiente
   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.gcp/analytics-credentials.json"
   
   # Para tornar permanente, adicione ao seu ~/.bashrc ou ~/.zshrc:
   echo 'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.gcp/analytics-credentials.json"' >> ~/.bashrc
   ```

> **⚠️ Segurança**: Nunca compartilhe ou commite este arquivo JSON no Git. Ele contém credenciais sensíveis!

### 6. Execute o servidor

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Acesse: `http://localhost:8000/docs` (Swagger UI)



## Frontend

### 1. Navegue para o diretório

```bash
cd ../frontend
```

### 2. Instale dependências

```bash
npm install
```

### 3. Configure variáveis de ambiente

Crie `.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=sua_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 4. Execute o dev server

```bash
npm run dev
```

Acesse: `http://localhost:5173`



## Documentação Relacionada

- [🚀 Tecnologias](./tecnologias.md)
- [🏗 Arquitetura](./arquitetura.md)
- [🔧 Backend](./backend.md)
- [💻 Frontend](./frontend.md)



[⬅️ Voltar ao Índice](../README.md)
