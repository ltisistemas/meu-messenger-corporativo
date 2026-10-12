# 02: Provisionamento Idempotente do Esquema no Prisma Postgres

**What to build:**
Execução do provisionamento estrutural das tabelas relacionais do NextMsg na instância em nuvem do Prisma Postgres (`db.prisma.io:5432`), criando todas as 14+ tabelas (organizações, colaboradores/usuários, conversas, mensagens, anexos, comunicados, enquetes, assinaturas, registros de auditoria), restrições de integridade, enums e índices a partir das definições do Drizzle ORM.

**Blocked by:** 01: Sincronização de Ambiente e Resolução de Variáveis

**Status:** ready-for-agent

- [ ] Execução bem-sucedida de `pnpm --filter @corpchat/api db:push` contra a instância remota do Prisma Postgres
- [ ] Criação de todas as tabelas públicas do schema relacional verificadas no banco de dados
- [ ] Criação dos tipos enumerados do PostgreSQL (`user_role`, `conversation_type`, `file_storage_type`, `signature_status`, etc.)
- [ ] Índices de performance e chaves estrangeiras validados de forma idempotente
- [ ] Nenhuma alteração destrutiva em esquemas existentes
