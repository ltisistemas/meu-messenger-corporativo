# OpenSpec: Cobertura Mínima de 95% de Testes Automatizados

## Overview

Estabelece a política de qualidade inegociável de no mínimo 95% de cobertura de código (linhas, declarações e funções) e 90% em ramos para todos os pacotes do monorepo NextMsg (`@corpchat/shared`, `@corpchat/api` e `@corpchat/web`), com bloqueio automatizado no executor de testes.

## Requirements

### R-COV-01: Provedor e Configuração do Vitest Coverage

- O pacote `@vitest/coverage-v8` deve estar instalado e configurado como provedor de cobertura em todos os pacotes.
- Relatórios habilitados: `text`, `text-summary`, `html` e `lcov`.
- Relatórios detalhados gerados na pasta `coverage/` de cada pacote.

### R-COV-02: Limiares Obrigatórios (_Thresholds_)

- O executor de testes deve abortar com erro se qualquer workspace apresentar índices inferiores a:
  - `lines`: 95%
  - `statements`: 95%
  - `functions`: 95%
  - `branches`: 90%

### R-COV-03: Exclusões Técnicas da Superfície Testável

- Devem ser excluídos da contagem de cobertura apenas:
  - Configurações de build e ferramentas (`*.config.ts`, `*.config.js`)
  - Tipos e declarações puras (`*.d.ts`)
  - Migrações de banco geradas (`apps/api/src/db/migrations/**`)
  - Entrypoints de bootstrap (`apps/api/src/index.ts`, `apps/web/src/main.tsx`)
  - Arquivos de teste e mocks (`**/*.test.{ts,tsx}`, `**/test/**`)

### R-COV-04: Cobertura Completa de Domínio e Contratos

- `@corpchat/shared`: 100% dos schemas Zod, DTOs, enums e limites de plano testados com casos positivos e negativos.
- `@corpchat/api`: Todos os endpoints, fluxos de autenticação, permissões, rate limits, webhooks, observabilidade e jobs testados com `server.inject()`.
- `@corpchat/web`: Todas as páginas, componentes principais (chat, landing page, account, modais) e stores testados via React Testing Library.

### R-COV-05: Integração com o Pipeline de Build

- O comando `pnpm test` deve executar a validação de cobertura por padrão.
- Falhas de cobertura impedem commits ou merges para a branch `main`.
