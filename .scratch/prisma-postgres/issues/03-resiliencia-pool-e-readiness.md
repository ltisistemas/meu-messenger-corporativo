# 03: Resiliência de Pooling Serverless e Verificação de Prontidão

**What to build:**
Parametrização robusta do pool de conexões PostgreSQL para ambientes Serverless no Vercel (limite reduzido de sockets por lambda e negociação TLS/SSL transparente), validação ativa da integridade do banco no endpoint de prontidão `/ready` e execução de testes automatizados assegurando conformidade com o limiar de >95% de cobertura.

**Blocked by:** 02: Provisionamento Idempotente do Esquema no Prisma Postgres

**Status:** ready-for-agent

- [ ] Ajuste e reforço do pool em `apps/api/src/db/index.ts` com suporte automático a URLs do Prisma (`prisma.io`) e `sslmode=require`
- [ ] Endpoints `/health` e `/ready` testando conectividade de banco via query de baixo custo (`SELECT 1`) com tratamento gracioso de falha
- [ ] Testes de integração em `test/observability.routes.test.ts` e novos testes de unidade validando comportamento com banco conectado e desconectado
- [ ] Execução de `pnpm test` com todos os 546+ testes passando em verde e mantendo limiares de cobertura ≥95%
