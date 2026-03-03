# Fincla - Frontend

Uma aplicação frontend moderna para gestão financeira pessoal com assistente de IA.

## 🚀 Tecnologias

- **React 18** - Framework principal
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Estilização
- **Shadcn/ui** - Componentes UI
- **Chart.js** - Gráficos e visualizações
- **TanStack Query** - Gerenciamento de estado
- **Wouter** - Roteamento

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── charts/         # Componentes de gráficos
│   ├── ui/            # Componentes base (shadcn/ui)
│   └── ...            # Outros componentes
├── config/            # Configurações
│   ├── api.ts         # Configuração da API
│   └── demo.ts        # Configuração do modo demo
├── hooks/             # Custom hooks
├── lib/               # Utilitários e configurações
├── pages/             # Páginas da aplicação
├── services/          # Serviços de API
└── main.tsx          # Entry point
```

## 🛠️ Configuração

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
```

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# URL da API Backend
VITE_API_BASE_URL=http://localhost:5000

# URL base do frontend (para Open Graph / compartilhamento WhatsApp)
# Em produção, use a URL do seu domínio (ex: https://app.fincla.com)
VITE_APP_URL=http://localhost:3000

# Outras configurações
VITE_APP_NAME=Fincla
VITE_APP_VERSION=1.0.0
```

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Verificar tipos TypeScript
# Verificar tipos TypeScript
npm run check

# Rodar testes unitários
npm run test:unit
```

## 🧪 Testes

O projeto utiliza **Vitest** e **MSW** para testes unitários e de integração.

```bash
# Rodar todos os testes unitários
npm run test:unit

# Rodar testes com interface gráfica
npm run test:ui

# Rodar testes com cobertura
npm run test:coverage
```

## 🚀 Novas Funcionalidades

- **Relatórios (`/reports`)**: Visualizações detalhadas de fluxo de caixa e categorias.
- **Metas (`/goals`)**: Gerenciamento de metas financeiras com acompanhamento de progresso.
- **Perfil (`/profile`)**: Gestão de conta e organizações.


## 🔌 Integração com Backend

Este frontend é projetado para trabalhar com um backend separado. As APIs esperadas são:

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/logout` - Logout

### Transações
- `GET /api/transactions` - Listar transações
- `POST /api/transactions` - Criar transação
- `PUT /api/transactions/:id` - Atualizar transação
- `DELETE /api/transactions/:id` - Deletar transação
- `GET /api/transactions/summary` - Resumo financeiro

### Relatórios
- `GET /api/reports/monthly` - Dados mensais
- `GET /api/reports/categories` - Relatório por categorias

### IA
- `POST /api/ai/chat` - Chat com IA
- `POST /api/ai/process-transaction` - Processar transação via IA

## 🎨 Funcionalidades

### Dashboard Financeiro
- **Cards de Resumo**: Saldo, receitas, despesas e metas
- **Gráficos Interativos**: Pizza, linha e barras
- **Transações Recentes**: Lista das últimas transações
- **Chat IA**: Assistente inteligente para gestão financeira

### Modo Demo
- **Ativação**: Faça login com o email `demo@walletai.app` (qualquer senha).
- **Dados Demonstrativos**: Dados realistas para apresentações.
- **Interface Interativa**: Transações podem ser adicionadas/removidas (localmente).
- **Indicador Visual**: Badge "Modo Demo" no header.

### Chat IA
- **Interface de chat fixa** na parte inferior
- **Processamento de linguagem natural**
- **Registro automático de transações**
- **Insights financeiros personalizados**

## 🔧 Desenvolvimento

### Adicionando Novos Componentes

```bash
# Criar novo componente
mkdir src/components/MyComponent
touch src/components/MyComponent/index.tsx
```

### Adicionando Novas Páginas

```bash
# Criar nova página
touch src/pages/my-page.tsx
```

### Configurando Novas APIs

Edite `src/config/api.ts` para adicionar novos endpoints.

## 📦 Build e Deploy

### Build para Produção

```bash
npm run build
```

O build será gerado na pasta `dist/`.

### Deploy

O projeto pode ser deployado em qualquer serviço de hospedagem estática:

- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **GitHub Pages**: Configure no GitHub Actions
- **Firebase Hosting**: `firebase deploy`

## 📋 Roadmap

Para ver todas as melhorias planejadas e o roadmap de desenvolvimento, consulte o arquivo [ROADMAP.md](./ROADMAP.md).

O roadmap inclui:
- ✅ Melhorias de UX/UI
- 🤖 Funcionalidades de IA avançadas
- 📱 Recursos mobile-first
- 🔐 Segurança e privacidade
- 📊 Analytics e insights
- 🎮 Gamificação e engajamento
- 🔗 Integrações e conectividade

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Se você encontrar algum problema ou tiver dúvidas:

1. Verifique se o backend está rodando na URL configurada
2. Verifique as variáveis de ambiente
3. Abra uma issue no repositório

---

**Fincla** - Transformando a gestão financeira com IA 🚀 