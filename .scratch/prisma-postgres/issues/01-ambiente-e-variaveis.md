# 01: Sincronização de Ambiente e Resolução de Variáveis

**What to build:**
Resolução transparente e robusta das variáveis de ambiente de conexão do Prisma Postgres (`DATABASE_URL`, `POSTGRES_URL`) tanto na execução do monorepo quanto no pacote `apps/api`, garantindo que comandos CLI de migração e a inicialização do Fastify localmente ou no Vercel acessem as credenciais corretas com documentação em `.env.example`.

**Blocked by:** None (can start immediately)

**Status:** closed (resolved)

- [x] Arquivo `apps/api/.env` sincronizado com as variáveis de conexão do Prisma Postgres
- [x] `drizzle.config.ts` ajustado para carregar `.env` da pasta local ou da raiz do monorepo de forma tolerante
- [x] Entrypoint e utilitários da API carregando variáveis de ambiente sem conflitos em desenvolvimento e produção
- [x] Arquivo `apps/api/.env.example` e `.env.example` raiz atualizados com o padrão de URL do Prisma Postgres (`sslmode=require`)
- [x] Suíte de testes existente executando sem regressões
