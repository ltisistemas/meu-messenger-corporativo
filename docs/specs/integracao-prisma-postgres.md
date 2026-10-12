# Especificação: Integração do Prisma Postgres com Vercel e Drizzle ORM

**Status:** ready-for-agent  
**Data:** 12 de Outubro de 2026  
**Domínio:** Infraestrutura de Dados, Conectividade Cloud e Persistência  
**Conformidade:** ADR 0003 ([`docs/adr/0003-prisma-postgres-com-drizzle-orm.md`](../adr/0003-prisma-postgres-com-drizzle-orm.md)) & [`GLOSSARY.md`](../../GLOSSARY.md)

---

## Problem Statement

O desenvolvedor provisionou uma instância remota gerenciada no **Prisma Postgres** (`db.prisma.io:5432`) e configurou as credenciais de acesso no ambiente local e no painel do Vercel. No entanto:
1. **Banco Remoto Não Inicializado:** A instância de banco em nuvem está vazia (0 tabelas públicas), impossibilitando a persistência de organizações, colaboradores, conversas, mensagens e registros de auditoria.
2. **Desalinhamento de Ambiente Monorepo:** As variáveis de conexão (`DATABASE_URL`, `POSTGRES_URL`) foram adicionadas na raiz do monorepo, mas a camada de execução da API e as ferramentas CLI de migração de banco rodam a partir do pacote do backend, exigindo sincronização consistente dos arquivos de ambiente.
3. **Resiliência Serverless no Vercel:** Quando o backend executa em ambiente serverless no Vercel, o ciclo de vida efêmero das funções e a terminação SSL obrigatória (`sslmode=require`) exigem pooling controlado e detecção de conectividade para evitar estouro de conexões ativas na instância do banco.

---

## Solution

Conectar o backend NextMsg e a infraestrutura do Vercel à instância remota do **Prisma Postgres**, mantendo o **Drizzle ORM** como motor de mapeamento relacional e persistência:
1. Sincronizar as variáveis de ambiente com o pacote do backend e garantir que o carregador de configuração localize credenciais tanto da raiz do monorepo quanto do pacote da API.
2. Provisionar todas as tabelas, tipos enumerados e índices do esquema relacional diretamente no banco Prisma Postgres utilizando a ferramenta de push/migração do ORM.
3. Assegurar parâmetros de pooling seguros para ambiente serverless com limite reduzido de conexões por função lambda e tratamento resiliente de erros transitórios de conexão.
4. Validar a prontidão da aplicação através de endpoints de integridade (`/health` e `/ready`), garantindo que o pool de banco responda com sucesso a verificações de conectividade antes de rotear tráfego de produção.

---

## User Stories

### Configuração e Resolução de Ambiente
1. As a developer running local commands, I want the backend service to locate connection strings from the environment file, so that CLI tools execute against the intended database without manual exports.
2. As a DevOps engineer deploying to Vercel, I want the API to read connection parameters seamlessly from Vercel environment variables, so that production builds connect directly to the cloud database.
3. As a developer, I want documentation and template environment files updated with Prisma Postgres connection patterns, so that team members can onboard with consistent configuration.
4. As a systems operator, I want SSL mode requirements automatically detected and negotiated with the database driver, so that secure connections succeed without certificate rejection errors.

### Provisionamento e Integridade de Esquema
5. As an organization administrator, I want organization and collaborator tables created on the remote database, so that newly registered corporate tenants are persisted with full data isolation.
6. As a collaborator, I want conversation, message, reaction and attachment tables created, so that real-time messages are stored reliably.
7. As an administrator, I want broadcast communication channels and polls tables created, so that official announcements and team votes are persisted correctly.
8. As a compliance officer, I want audit log, electronic signature and LGPD request tables created, so that regulatory records are securely maintained in the cloud database.
9. As a developer, I want schema synchronization to be idempotent, so that running schema push operations multiple times does not destroy existing data or duplicate constraints.

### Resiliência e Concorrência Serverless
10. As a cloud architect, I want the database connection pool in serverless mode to limit simultaneous sockets per lambda instance, so that sudden spikes in serverless invocations do not exhaust database connection capacity.
11. As a systems administrator, I want database pool connection timeouts strictly configured, so that hanging network calls to the cloud database fail fast rather than stalling HTTP responses.
12. As an observability engineer, I want database connection errors logged with non-fatal warnings rather than unhandled process crashes, so that transient network interruptions do not crash active workers.

### Verificação Operacional e Monitoramento
13. As an automated monitoring agent, I want the readiness endpoint (`/ready`) to run a lightweight connectivity query against the database, so that traffic is only routed when the database is reachable.
14. As an automated monitoring agent, I want the health endpoint (`/health`) to return HTTP 200 and healthy status when the database responds normally, so that Vercel health checks pass consistently.
15. As a QA engineer, I want automated test suites to continue passing with 100% mocked pool isolation in unit tests while verifying live connection capabilities in integration benchmarks, so that regression thresholds (95% coverage) remain fulfilled.

---

## Implementation Decisions

- **Arquitetura de Acesso a Dados**: O Prisma Postgres é utilizado exclusivamente como infraestrutura de banco de dados PostgreSQL na nuvem (DBaaS). O código da aplicação mantém integralmente o Drizzle ORM e o driver `node-postgres`, evitando refatorações invasivas de modelos e regras de negócio.
- **Estratégia de Sincronização de Esquema**: O esquema relacional é aplicado à instância do Prisma Postgres por meio da ferramenta de sincronização do Drizzle (`drizzle-kit push`), criando todas as tabelas (organizações, usuários, conversas, mensagens, arquivos, assinaturas, auditoria, etc.) e seus índices em conformidade estrita com as definições TypeScript do domínio.
- **Resolução de Arquivos de Configuração**: O utilitário de carregamento de variáveis de ambiente deve inspecionar prioritariamente as variáveis de processo injetadas pelo runtime (como as do Vercel), recorrendo ao arquivo local do pacote ou ao arquivo de ambiente na raiz do monorepo quando executado localmente.
- **Parâmetros de Conexão e Pooling**: O pool de conexões é parametrizado com suporte automático a conexões com SSL exigido (`sslmode=require` com desativação de checagem de autoridade para certificados de hosts gerenciados em nuvem) e dimensionamento de pool reduzido quando executando em contêineres/lambdas serverless.
- **Isolamento de Contratos de Domínio**: Nenhum tipo específico do cliente Prisma é introduzido nos contratos da aplicação. O domínio continua interagindo com os tipos e esquemas Zod unificados do monorepo.

---

## Testing Decisions

- **O que constitui um bom teste**: Testes devem avaliar o comportamento externo dos pontos de contato e contratos HTTP, sem acoplamento a implementações internas de socket. O teste de integridade do banco deve verificar que o serviço responde com sucesso e status "ok" quando a base responde, e com status degradado/erro quando a base está indisponível.
- **Módulos Testados**:
  - Endpoint de integridade e prontidão da API (`/health` e `/ready`), verificando o handshake com o pool de banco.
  - Configuração do pool de conexões e detecção de flags SSL / Serverless.
  - Execução de testes de rotas da API via injeção Fastify (`server.inject()`).
- **Arte Anterior e Referências**:
  - Testes de observabilidade em `apps/api` (`test/observability.routes.test.ts`) utilizando injeções de servidor e mocks de pool.
  - Políticas de limiar estabelecidas no ADR 0002 com garantia inegociável de ≥95% de cobertura.

---

## Out of Scope

- Substituição do Drizzle ORM pelo `@prisma/client` ou criação de arquivos `schema.prisma`.
- Configuração de proxies pagos adicionais como Prisma Accelerate ou Prisma Pulse neste momento.
- Alteração da lógica de autenticação, streaming de arquivos ou permissões de colaboradores.
- Modificação na estrutura de componentes ou telas do aplicativo web frontend (`@corpchat/web`).

---

## Further Notes

- A instância do Prisma Postgres já teve sua conectividade verificada com sucesso via handshake TLS/SSL em porta 5432.
- A aplicação do esquema com `drizzle-kit push` é um processo não destrutivo para bancos vazios e provisionará de forma limpa todas as estruturas relacionais.
