# NextMsg - Diretrizes de Desenvolvimento e Arquitetura

## 1. Stack e Arquitetura Particionada

O projeto é particionado em duas aplicações totalmente autônomas e desacopladas, sem dependências externas fora das respectivas pastas:

- **Frontend (`frontend/`):** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS + Zustand + TanStack Query + Socket.IO Client. Schemas e regras de planos contidos em `frontend/src/shared/`.
- **Backend (`backend/`):** NestJS 10 + TypeScript + Drizzle ORM + PostgreSQL + Socket.IO Gateway + Redis + BullMQ. Schemas e regras de planos contidos em `backend/src/shared/`.
- **Infraestrutura Local:** Docker Compose na raiz (`docker-compose.yml` para PostgreSQL 16 na porta `5432` e Redis 7 na porta `6379`).

## 2. Comandos Principais

### Backend (`cd backend`)
```bash
# Instalação isolada de dependências
pnpm install

# Desenvolvimento (Nest CLI watch)
pnpm run dev

# Build de produção (Nest CLI)
pnpm run build

# Checagem de tipos (tsc --noEmit)
pnpm run lint

# Testes unitários com Vitest
pnpm run test

# Migrações do banco (Drizzle ORM)
pnpm run db:migrate
```

### Frontend (`cd frontend`)
```bash
# Instalação isolada de dependências
pnpm install

# Desenvolvimento (Next.js dev server na porta 3000)
pnpm run dev

# Build de produção otimizado (Next.js build)
pnpm run build

# Checagem de tipos (tsc --noEmit)
pnpm run lint

# Testes unitários com Vitest
pnpm run test
```

### Raiz (Scripts de conveniência)
```bash
pnpm run dev:backend
pnpm run dev:frontend
pnpm run build:backend
pnpm run build:frontend
pnpm run test:backend
pnpm run test:frontend
```

## 3. Regras de Negócio e Planos

- **Free:** até 12 usuários, arquivos de até 5 MB apenas online (streaming WebSocket em memória sem persistência em disco/bucket).
- **Pro:** até 80 usuários, arquivos de até 25 MB (teto 125 MB por envio), store-and-forward temporário em Cloudflare R2 (exclusão após download de todos ou em 5 dias), transmissão, enquetes, 14 dias de Trial sem cartão. Integração Asaas para cobrança e checkout Pix/Boleto/Cartão.
- **Enterprise:** usuários ilimitados, teto total de 100 MB por envio (arquivos > 25 MB via link), assinatura eletrônica Clicksign com auditoria SHA-256.
- **Status da Conta:** `active`, `over_quota` (modo somente leitura ao exceder limite no downgrade), `suspended`.
- **Grupos Temporários:** Tornam-se Read-Only e são arquivados após expiração.

## 4. Padrões de Código

- Sempre validar limites e permissões de planos no servidor usando `can(plan, feature)` e schemas Zod de `@/shared`.
- Mantenha módulos desacoplados no NestJS com Controllers, Services e Gateways organizados por domínio.
- Páginas e componentes do frontend organizados no App Router (`frontend/src/app/`) com componentes reusáveis em `frontend/src/components/`.
- Execute `pnpm run test` e `pnpm run lint` antes de concluir qualquer alteração.
