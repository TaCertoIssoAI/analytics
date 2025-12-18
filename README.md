# Tá Certo Isso AI - Analytics

Plataforma de analytics e verificação de fatos para o bot de WhatsApp "Tá Certo Isso AI". Sistema completo para pesquisadores e jornalistas acessarem dados de verificações de fact-checking realizadas por inteligência artificial.

## 📚 Documentação

### 🚀 Início Rápido
- [🛠 Como Rodar Localmente](./docs/setup.md) - Instruções passo a passo para configurar o projeto
- [🏗 Arquitetura do Sistema](./docs/arquitetura.md) - Visão geral da arquitetura e fluxo de dados

### 📖 Guias Técnicos
- [🚀 Tecnologias](./docs/tecnologias.md) - Stack tecnológico completo
- [🔧 Backend](./docs/backend.md) - API, endpoints, serviços e deploy
- [💻 Frontend](./docs/frontend.md) - Páginas, componentes e integração
- [✨ Funcionalidades](./docs/funcionalidades.md) - Lista completa de features



## 🎯 Visão Geral do Projeto

Sistema de analytics que permite visualizar, buscar e analisar verificações de fact-checking realizadas automaticamente por IA. Integrado com o bot de WhatsApp "Tá Certo Isso AI", oferece:

- 🔍 **Busca semântica** usando embeddings do Google Gemini
- 📊 **Dashboard com métricas** de verdadeiro/falso/não verificado
- 🎨 **Interface responsiva** com acessibilidade VLibras
- 🔐 **Sistema de avaliação** com autenticação Firebase
- 📥 **Exportação CSV** de dados filtrados
- 🏷️ **Classificação IPTC** automática de tópicos



## 🚀 Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

📖 **Guia completo:** [Como Rodar Localmente](./docs/setup.md)



## 🛠 Tecnologias Principais

**Backend:** FastAPI • BigQuery • Firestore • Google Gemini  
**Frontend:** React • TypeScript • Tailwind CSS • Shadcn UI • Firebase Auth

📖 **Detalhes completos:** [Tecnologias](./docs/tecnologias.md)



## 📧 Contato

Para dúvidas ou sugestões, entre em contato através do repositório GitHub.



**Desenvolvido com ❤️ para combater a desinformação no Brasil**
