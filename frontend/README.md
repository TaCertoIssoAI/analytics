# Analytics WhatsApp Frontend

Frontend da plataforma de analytics, construído com React, Vite, TypeScript e Shadcn UI.

## Pré-requisitos

- Node.js 18+
- npm (ou bun/yarn)

## Configuração

1. **Crie o arquivo .env**
   Crie um arquivo `.env` na raiz do projeto com a URL da API:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

## Como rodar (Localmente)

1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Execute o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```
   O frontend estará disponível em: http://localhost:8080 (ou outra porta indicada no terminal)

## Como construir para produção

1. **Gere o build**
   ```bash
   npm run build
   ```
   Os arquivos estáticos serão gerados na pasta `dist/`.

2. **Visualize o build (opcional)**
   ```bash
   npm run preview
   ```