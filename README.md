# NextMsg - Micro-SaaS Corporate Messenger

[![Turborepo](https://img.shields.io/badge/monorepo-turborepo-blue)](https://turbo.build/)
[![TypeScript](https://img.shields.io/badge/language-typescript-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-300%20passing-brightgreen)](https://vitest.dev/)
[![LGPD](https://img.shields.io/badge/compliance-LGPD%20%2F%20Art.%2018-emerald)](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)

Plataforma completa de mensageria corporativa multi-tenant em tempo real com arquitetura de alta performance, zero retenção desnecessária de arquivos no plano Free, Store-and-Forward temporário com expiração em 5 dias nos planos Pro/Enterprise, assinaturas eletrônicas integradas, enquetes, canais de transmissão, cobrança recorrente via Asaas e conformidade total com a LGPD.

---

## 🏛️ Arquitetura do Monorepo

```
messenger-corporativo/
├── apps/
│   ├── api/          # Backend Fastify + Socket.IO + Drizzle ORM + Redis + BullMQ (226 testes)
│   └── web/          # Frontend React 19 + Vite + Tailwind CSS + Zustand (74 testes)
├── packages/
│   ├── shared/       # Schemas Zod, validações de plano e DTOs compartilhados
│   └── tsconfig/     # Configurações TypeScript base
├── docs/             # Especificações técnicas, ADRs e relatório de teste de carga (T-38)
└── docker-compose.yml # PostgreSQL 16 e Redis 7 locais
```

---

## 🚀 Funcionalidades Principais por Fase

### 1. Fundação & Comunicação em Tempo Real (Fases 0, 1 e 2)

- **Multi-Tenant:** Isolamento rigoroso por conta (`accounts` / `users`).
- **Autenticação:** JWT com rotação de Refresh Tokens e controle de acesso baseado em papéis (`owner`, `admin`, `member`).
- **WebSockets & Presença:** Socket.IO autenticado com salas dedicadas e rastreamento de status online/offline com TTL no Redis.
- **Mensagens & Recibos:** Chat 1:1 e em grupo com persistência, entrega garantida e recibos de leitura (`sent`, `delivered`, `read`) com indicador de digitação.

### 2. Gestão Inteligente de Arquivos (Fase 3)

- **Plano Free (Zero Retenção):** Streaming direto em memória via WebSocket apenas para destinatários online — sem gravação em disco ou bucket S3.
- **Planos Pro / Enterprise (Store-and-Forward):** Upload via URL pré-assinada com criptografia SSE, contador de downloads em grupo e exclusão automática do bucket após download de todos os membros ou pelo job BullMQ de 5 dias.
- **Cartões de Link:** Pré-visualização automática e conversão de links do Google Drive, OneDrive e Dropbox.

### 3. Recursos Avançados de Grupo (Fase 4)

- **Grupos Temporários:** Configuração de prazo de validade com arquivamento e transição automática para somente leitura.
- **Lista de Transmissão:** Canal oficial corporativo "Comunicados" com relatório analítico de entrega e taxa de abertura em tempo real.
- **Enquetes Corporativas:** Votação única ou múltipla, anônima ou identificada, prazo de encerramento e apuração instantânea via WebSocket.

### 4. Monetização & Assinaturas (Fase 5)

- **Gateway Asaas:** Checkout de planos Pro e Enterprise (mensal/anual), webhooks de pagamento (`PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`) e emissão de faturas.
- **Controle de Cotas:** Gestão de limites de membros (12 no Free, 80 no Pro, ilimitado no Enterprise) com tratamento de `over_quota` no downgrade.

### 5. Assinatura Eletrônica Enterprise (Fase 6)

- **Provedor Clicksign:** Fluxo de assinatura de ponta a ponta com múltiplos signatários, ordem de assinatura e webhooks de status.
- **Certificado de Evidências:** Manifesto com trilha de auditoria completa, IP, data/hora e verificação de integridade via hash SHA-256.

### 6. Endurecimento, LGPD & Observabilidade (Fase 7)

- **Segurança & Rate Limit:** Headers de proteção (Helmet, CSP restritivo), sanitização contra XSS e limitação de taxa por rota.
- **LGPD:** Política de privacidade com dados do DPO (`GET /api/lgpd/privacy-policy`), exportação integral de dados pessoais em JSON (Art. 18, V) e exclusão/anonimização com direito ao esquecimento (Art. 18, VI).
- **Observabilidade:** Logs estruturados Pino com redação de dados sensíveis e **zero conteúdo de mensagem nos logs**, métricas em formato JSON e Prometheus (`/metrics`), probes de saúde (`/health`, `/live`, `/ready`).
- **Disaster Recovery:** Backup lógico do PostgreSQL em formato JSON com validação de integridade criptográfica SHA-256 e restauração transacional.
- **Teste de Carga (T-38):** Simulação validada de 80 usuários concorrentes transferindo mensagens e arquivos com 0% de erro e 85.5% a 97% de economia de banda documentada em [`docs/relatorio-teste-de-carga.md`](./docs/relatorio-teste-de-carga.md).

---

## 🛠️ Como Executar o Projeto

### Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- Docker e Docker Compose

### 1. Iniciar Infraestrutura Local

```bash
docker compose up -d
```

### 2. Instalar Dependências

```bash
pnpm install
```

### 3. Rodar em Modo de Desenvolvimento

```bash
pnpm dev
```

- **Web App:** `http://localhost:5173`
- **API Server:** `http://localhost:3000`
- **Métricas:** `http://localhost:3000/metrics`
- **Health Check:** `http://localhost:3000/health`

### 4. Executar Testes Automatizados

```bash
# Executar todos os testes do monorepo (300 testes)
pnpm test

# Executar verificação de tipos e lint
pnpm lint
```

---

## 📜 Licença

Projeto desenvolvido sob licença proprietária para uso corporativo.
