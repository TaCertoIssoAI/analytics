# Analytics WhatsApp API - Backend

Backend da plataforma de analytics para fact-checking.

## Pré-requisitos

- Python 3.12+
- Credenciais do Google Cloud (arquivo `.json`)
- Arquivo `.env` configurado (baseado no `.env.example`)

## Configuração

1. **Crie o arquivo .env**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas configurações e caminho para as credenciais
   ```

## Como rodar (Localmente com venv)

1. **Crie e ative o ambiente virtual**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Instale as dependências**
   ```bash
   pip install -r requirements.txt
   ```

3. **Execute o servidor**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   O servidor estará rodando em: http://localhost:8000
   Documentação (Swagger): http://localhost:8000/docs

## Como rodar (Docker)

1. **Construa a imagem**
   ```bash
   docker build -t analytics-backend .
   ```

2. **Execute o container**
   ```bash
   docker run -d -p 8000:8000 --env-file .env -v $(pwd)/sitegrupysanca-e0d9835e206d.json:/app/sitegrupysanca-e0d9835e206d.json analytics-backend
   ```
   *Nota: Certifique-se de montar o volume correto para o arquivo de credenciais do Google Cloud se ele não estiver embutido na imagem.*

### Usando Docker Compose

```bash
docker-compose up -d --build
```
