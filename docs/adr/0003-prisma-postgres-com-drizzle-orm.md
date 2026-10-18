# 0003 - Adoção do Prisma Postgres como Provedor de Banco com Drizzle ORM

## Status

Aceito

## Contexto e Decisão

Para persistência relacional do NextMsg em produção e deploy no Vercel, foi provisionada uma instância em nuvem do **Prisma Postgres** (`db.prisma.io:5432`) com terminação TLS/SSL obrigatória (`sslmode=require`).

Decidimos adotar o **Prisma Postgres estritamente como provedor de banco de dados gerenciado (DBaaS)**, mantendo integralmente o **Drizzle ORM** (`drizzle-orm/node-postgres` com `pg.Pool`) como camada de acesso a dados da aplicação.

## Justificativa

1. **Preservação da Base de Código e Testes**: O monorepo possui 546 testes automatizados já validados e com mais de 95% de cobertura, construídos sobre schemas Drizzle (`apps/api/src/db/schema`). Migrar para o Prisma ORM (`@prisma/client`) exigiria reescrever completamente a camada de modelos, transações, tipagens e asserções de teste sem benefício funcional.
2. **Compatibilidade Nativa PostgreSQL**: O Prisma Postgres expõe um endpoint PostgreSQL padrão na porta 5432, compatível de imediato com o driver `pg` (node-postgres) e com o Drizzle ORM, exigindo apenas configuração de SSL (`ssl: { rejectUnauthorized: false }`) e limites adequados de pooling em ambiente serverless.
3. **Resolução de Variáveis e Isolamento**: As variáveis de conexão (`DATABASE_URL`, `POSTGRES_URL`) são espelhadas nos arquivos de ambiente do backend e no painel da Vercel, permitindo bootstrapping seguro via `drizzle-kit push` sem dependência de proxies proprietários.

## Opções Consideradas

1. **Migração Integral para Prisma ORM (`@prisma/client`)**: Rejeitada devido ao alto custo de refatoração, risco de regressão nos 546 testes e acoplamento a geradores de cliente estáticos em ambiente monorepo.
2. **Postgres Local / Container Docker Exclusivo**: Mantido apenas para ambiente offline e CI, utilizando Prisma Postgres como target oficial de staging e produção.
3. **Prisma Postgres com Drizzle ORM (Escolhida)**: Entrega conectividade gerenciada em nuvem, compatibilidade serverless com Vercel e estabilidade de 100% nas interfaces de dados já implementadas.
