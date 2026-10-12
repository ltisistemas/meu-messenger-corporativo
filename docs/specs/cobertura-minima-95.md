# Especificação: Cobertura Mínima de 95% de Testes no Monorepo NextMsg

**Status:** ready-for-agent  
**Data:** 12 de Outubro de 2026  
**Domínio:** Qualidade de Software, Testes Automatizados e Resiliência  
**Conformidade:** ADR 0002 ([`docs/adr/0002-politica-cobertura-testes-95.md`](../adr/0002-politica-cobertura-testes-95.md)) & [`GLOSSARY.md`](../../GLOSSARY.md)

---

## Problem Statement

Atualmente, o monorepo NextMsg possui 367 testes automatizados passando com sucesso, cobrindo fluxos primários de autenticação, mensageria, billing, expiração de arquivos e landing page. No entanto, não há um **Limiar de Cobertura** configurado formalmente nos executores de teste. Isso expõe o projeto a riscos críticos:
1. **Regressões Silenciosas:** Novos commits ou refatorações podem deixar caminhos de erro, tratamentos de exceção e fluxos alternativos desprotegidos sem que o CI/pipeline alerte os desenvolvedores.
2. **Superfícies Cegas:** Áreas sensíveis como a conformidade com a LGPD (Art. 18), expiração de grupos temporários, cálculo de faturas anuais com desconto, streaming de arquivos em memória e interações complexas de UI na web podem conter lacunas não testadas.
3. **Falta de Métricas Confiáveis:** Não há visibilidade padronizada sobre a porcentagem exata de linhas, declarações, funções e ramos testados em cada workspace (`@corpchat/shared`, `@corpchat/api` e `@corpchat/web`).

---

## Solution

Implementar uma infraestrutura completa de medição e garantia de testes utilizando `@vitest/coverage-v8`, definindo um **Limiar de Cobertura** inegociável de **95% em linhas, declarações e funções**, e **90% em ramos**, aplicado de forma independente aos três pacotes do monorepo.

Para atingir e manter essa meta sem testes artificiais:
1. Configurar o motor de cobertura e exclusões técnicas (`coverage.exclude`) em cada pacote.
2. Expandir a suíte de testes do `@corpchat/shared` para 100% de cobertura de schemas, DTOs, validadores e utilitários de domínio.
3. Expandir a suíte de testes do `@corpchat/api` com testes de integração via `server.inject()` e mocks dos adaptadores de storage, cobrindo 100% dos fluxos de erro, status HTTP de borda, rate limits e jobs de ciclo de vida.
4. Expandir a suíte de testes do `@corpchat/web` utilizando React Testing Library, cobrindo todas as ações de usuário, alternâncias de abas, formulários de criação de grupos temporários, enquetes, canais de transmissão e tratamentos visuais de erro.
5. Integrar a checagem automática de limiares ao comando `pnpm test`, bloqueando commits e deploys caso qualquer pacote caia abaixo de 95%.

---

## User Stories

### Configuração e Infraestrutura de Cobertura
1. As a lead engineer, I want the Vitest coverage provider `@vitest/coverage-v8` installed and configured across all packages, so that coverage metrics are collected with native V8 speed and accuracy.
2. As a CI/CD pipeline, I want the test command to fail with exit code 1 whenever any workspace falls below 95% lines/statements/functions or 90% branches, so that pull requests with untested code are blocked immediately.
3. As a developer, I want technical exclusions (`coverage.exclude`) configured for build configs, database migrations and type declarations, so that only the active domain logic is evaluated.
4. As a developer, I want terminal coverage summary tables and detailed HTML/LCOV reports generated on test runs, so that I can inspect untested lines directly in my browser.
5. As a QA engineer, I want coverage thresholds enforced on a per-package basis, so that a failure in the web app cannot be masked by high coverage in the shared library.

### Cobertura do Pacote `@corpchat/shared` (Meta: ≥ 98%)
6. As a developer using `@corpchat/shared`, I want every Zod schema tested against valid payloads, so that correct data is guaranteed to pass validation.
7. As a developer using `@corpchat/shared`, I want every Zod schema tested against malformed payloads, so that invalid emails, weak passwords, negative quotas and invalid UUIDs fail predictably with readable error messages.
8. As a developer using `@corpchat/shared`, I want all plan limit definitions (Free, Pro, Enterprise) tested for member limits, storage limits and retention hours, so that business constraints cannot silently change.
9. As a developer using `@corpchat/shared`, I want all file attachment validation schemas tested against boundary sizes and forbidden MIME types, so that file upload rules are strictly preserved.
10. As a developer using `@corpchat/shared`, I want all constants, event names (`WS_EVENTS`) and enum helpers tested, so that client-server contract mismatches are prevented.

### Cobertura do Pacote `@corpchat/api` (Meta: ≥ 95%)
11. As a security engineer, I want authentication routes (`/api/auth`) tested for duplicate email registration, expired refresh tokens, invalid passwords and inactive account status, so that authentication is bulletproof.
12. As an administrator, I want account management routes (`/api/accounts`) tested for member invitations, role updates, member removals and organization renaming, so that multi-tenant isolation is maintained.
13. As a collaborator, I want direct conversation routes (`/api/conversations/direct`) tested for duplicate creation prevention, blocked members and non-existent users, so that 1:1 chat sessions initialize reliably.
14. As an organizer, I want group conversation routes (`/api/conversations/group`) tested for member limit validation by plan, temporary expiration timestamp calculation and read-only transitions, so that temporary groups expire reliably.
15. As a compliance officer, I want LGPD routes (`/api/lgpd`) tested for complete data export (Art. 18, V) and account/user anonymization and elimination (Art. 18, VI), so that legal compliance is verified end-to-end.
16. As a billing administrator, I want billing routes (`/api/billing`) tested for invoice listing, plan upgrade workflows, webhook authentication and payment confirmation, so that the billing engine cannot fail silently.
17. As an administrator, I want broadcast routes (`/api/broadcasts`) tested so that non-admins attempting to post in the "Comunicados" channel are rejected with HTTP 403.
18. As a collaborator, I want poll routes (`/api/polls`) tested for vote registration, duplicate vote prevention, closed poll rejection and option percentage aggregation.
19. As a compliance officer, I want signature routes (`/api/signatures`) tested for document creation, signer assignment, webhook event processing and SHA-256 certificate generation.
20. As a DevOps engineer, I want observability routes (`/health`, `/live`, `/ready`, `/metrics`) tested for database down states, latency threshold alerts and Prometheus format rendering.
21. As a storage engineer, I want file routes (`/api/files`) tested for Free plan in-memory relay restrictions when offline, presigned upload generation, and download confirmation.
22. As a systems engineer, I want the file expiration job (`FileExpirationService`) and group expiration job (`GroupExpirationService`) tested for sweeping expired items, batch deletions and retry handling.
23. As a realtime engineer, I want the WebSocket server (`socket.server.ts`) and presence service (`presence.service.ts`) tested for connection handshakes, heartbeat timeouts, multi-device socket management and disconnect cleanup.
24. As a security engineer, I want rate-limiting hooks and error responses tested across all sensitive routes, so that brute-force attempts receive HTTP 429 with `Retry-After`.

### Cobertura do Pacote `@corpchat/web` (Meta: ≥ 95%)
25. As a website visitor, I want all sections of the Landing Page (`LandingHero`, `LandingMetrics`, `LandingComparison`, `LandingFeatures`, `LandingPricing`, `LandingLgpdTrust`, `LandingFaq`, `LandingFooter`, `LandingNavbar`) tested for rendered elements, so that visual regressions are caught immediately.
26. As a visitor evaluating pricing, I want the monthly/annual toggle tested to verify price updates and annual total savings display.
27. As a visitor clicking Landing Page CTAs, I want navigation to `/register` with plan and trial query params tested, so that marketing conversions function without error.
28. As an authenticated user visiting `/`, I want automatic redirection to `/chat` tested, so that active sessions never see marketing pages.
29. As a user on the login page (`LoginPage`), I want form validation, invalid credential error banners and successful login redirection tested.
30. As a new user on the register page (`RegisterPage`), I want pre-selected plan parsing from URL query parameters, password confirmation mismatch validation and submission handling tested.
31. As a collaborator using the chat interface (`ChatPage`), I want conversation switching, search filtering in the sidebar and online badge indicators tested.
32. As a collaborator sending messages, I want the `MessageComposer` tested for empty message blocking, file selection, offline recipient blocking on Free plan and enter-key submission.
33. As a collaborator participating in polls, I want the poll voting card tested for selecting options, displaying live percentage bars and blocking votes after closing.
34. As an administrator managing the account (`AccountPage`), I want tab switching between Members, Plans and Invoices tested with loading states and empty state fallbacks.
35. As a collaborator signing documents, I want the signature modal and document viewer tested for signing actions, rejected status and audit hash display.
36. As a collaborator downloading files, I want file transfer cards tested for expired states, progress bars and download triggers.
37. As a store consumer, I want `auth.store`, `socket.store`, and `signature.store` tested for initial states, actions, persistence to localStorage and error resets.

---

## Implementation Decisions

### 1. Ferramenta de Cobertura e Provedor V8
- Adotar `@vitest/coverage-v8` em todos os workspaces (`packages/shared`, `apps/api`, `apps/web`).
- O provedor V8 utiliza profiling nativo do motor JavaScript do Node.js, gerando relatórios de cobertura sem necessidade de instrumentação lenta de código como Babel ou Istanbul.
- Relatórios habilitados: `text` (tabela resumida no console), `text-summary`, `html` (armazenado em `coverage/index.html` para inspeção visual) e `lcov` (para integração com SonarQube/Codecov no CI).

### 2. Configuração dos Limiares de Cobertura (*Thresholds*)
- Configurar explicitamente em cada `vitest.config.ts` (ou `vite.config.ts`):
  - `lines: 95`
  - `statements: 95`
  - `functions: 95`
  - `branches: 90`
- O Vitest abortará automaticamente com status de erro caso qualquer uma dessas métricas fique abaixo do valor estabelecido.

### 3. Exclusões Técnicas Padronizadas (`coverage.exclude`)
- Excluir estritamente arquivos sem lógica de domínio:
  - `node_modules/**`
  - `dist/**`
  - `**/*.d.ts`
  - `**/*.config.{ts,js}`
  - `apps/api/src/db/migrations/**`
  - `**/test/**`
  - `**/*.test.{ts,tsx}`
  - `apps/api/src/index.ts` (entrypoint de bootstrap de processo)
  - `apps/web/src/main.tsx` (entrypoint DOM do React)

### 4. Estrutura Modular de Novos Testes
- **`packages/shared`**: Criar testes focados em cobrir todos os DTOs e validações não cobertos (`src/__tests__/schemas.test.ts`, `src/__tests__/plan-limits.test.ts`, `src/__tests__/enums.test.ts`).
- **`apps/api`**: Expandir testes para cobrir caminhos de erro e serviços auxiliares (`auth.service.ts`, `account.service.ts`, `storage.service.ts`, `asaas.service.ts`, `clicksign.service.ts`, `rate-limit`, `error-handling`).
- **`apps/web`**: Expandir testes de componentes e stores (`src/__tests__/stores.test.ts`, `src/__tests__/auth-pages.test.ts`, `src/__tests__/modals.test.ts`).

---

## Testing Decisions

### O Que Constitui um Teste de Alta Qualidade
- **Foco em Comportamento Externo:** Os testes devem validar entradas e saídas públicas (requisições HTTP, payloads WebSocket, cliques e renderização de DOM), e **nunca** variáveis ou métodos privados de implementação.
- **Isolamento e Determinismo:** Cada teste deve rodar de forma isolada, limpando mocks e estados antes de cada execução (`beforeEach`).
- **Zero Flakiness:** Nenhum teste deve depender de conexões com a internet externa; serviços de terceiros (Clicksign, Asaas, AWS S3) devem ser mockados deterministicamente na borda da chamada.

### Módulos Testados e Arte Anterior
- `@corpchat/shared`: 59 testes já existentes servindo de base.
- `@corpchat/api`: 226 testes já existentes utilizando `buildServer()` e `server.inject()`.
- `@corpchat/web`: 82 testes já existentes utilizando React Testing Library e `MemoryRouter`.

---

## Out of Scope

- Testes end-to-end com navegadores reais (Playwright/Cypress) em ambiente de staging — o foco desta especificação é a cobertura automatizada unitária e de integração em nível de monorepo com Vitest.
- Testes de carga destrutivos com dezenas de milhares de usuários simultâneos (já cobertos conceitualmente no spike T-38).
- Cobertura de ferramentas de infraestrutura externa (scripts de Docker Compose ou GitHub Actions).

---

## Further Notes

- A aprovação desta especificação orientará a geração dos tickets de implementação (`/to-tickets`) e o desenvolvimento dos testes necessários para atender e consolidar os 95% de cobertura mínima.
