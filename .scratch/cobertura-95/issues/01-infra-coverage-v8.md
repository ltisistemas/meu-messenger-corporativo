# 01: Infraestrutura de Cobertura V8 e Limiares por Workspace

**What to build:**
Instalação e configuração do motor `@vitest/coverage-v8` em todo o monorepo com relatórios no console e em HTML, estabelecendo os limiares inegociáveis de cobertura (95% em linhas, declarações e funções; 90% em ramos) e a superfície testável (exclusões de arquivos de configuração, tipos e migrações geradas) em `packages/shared`, `apps/api` e `apps/web`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Instalação da dependência `@vitest/coverage-v8` compatível com o Vitest 3 do monorepo
- [ ] Configuração do provider `v8` com relatórios `text`, `text-summary`, `html` e `lcov`
- [ ] Configuração dos limiares de bloqueio (lines: 95, statements: 95, functions: 95, branches: 90) em cada workspace
- [ ] Configuração das regras de exclusão técnica (`coverage.exclude`) evitando arquivos estáticos e gerados
- [ ] Script de execução com cobertura integrado ao fluxo padrão de testes do monorepo
