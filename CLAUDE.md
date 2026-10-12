# NextMsg - Diretrizes de Desenvolvimento e Arquitetura

## 1. Stack e Ferramentas
- **Monorepo:** pnpm workspaces (`9.15.9`) + Turborepo (`^2.4.4`)
- **Backend (`apps/api`):** Fastify + TypeScript + Drizzle ORM + PostgreSQL + Socket.IO + Redis + BullMQ
- **Frontend (`apps/web`):** React 19 + Vite + TypeScript + Tailwind CSS + Zustand + TanStack Query
- **Pacote Compartilhado (`packages/shared`):** TypeScript + Zod (validações, tipos de DTO, regras de planos)
- **Infraestrutura Local:** Docker Compose (PostgreSQL 16 na porta `5432` e Redis 7 na porta `6379`)

## 2. Comandos Principais
```bash
# Instalação de dependências
pnpm install

# Desenvolvimento (sobe todos os apps com Turbo)
pnpm dev

# Build de todos os pacotes
pnpm build

# Checagem de tipos / Linting
pnpm lint

# Testes unitários com Vitest
pnpm test

# Formatação de código
pnpm format
```

## 3. Regras de Negócio e Planos
- **Free:** até 12 usuários, arquivos de até 5 MB apenas online (streaming WebSocket em memória sem persistência em disco/bucket).
- **Pro:** até 80 usuários, arquivos de até 25 MB (teto 125 MB por envio), store-and-forward temporário em Cloudflare R2 (exclusão após download de todos ou em 5 dias), transmissão, enquetes, 14 dias de Trial sem cartão.
- **Enterprise:** usuários ilimitados, teto total de 100 MB por envio (arquivos > 25 MB via link), assinatura eletrônica Clicksign.
- **Status da Conta:** `active`, `over_quota` (modo somente leitura ao exceder limite no downgrade), `suspended`.
- **Grupos Temporários:** Tornam-se Read-Only e são arquivados após expiração.

## 4. Padrões de Código
- Sempre validar limites e permissões de planos no servidor usando `can(plan, feature)` e schemas Zod do `@corpchat/shared`.
- Mantenha funções focadas e módulos com interfaces limpas.
- Execute `pnpm test` e `pnpm lint` antes de concluir qualquer ticket.
