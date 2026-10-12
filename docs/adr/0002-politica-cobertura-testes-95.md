# 0002 - Política de Cobertura de Testes Automatizados (Mínimo de 95%)

## Status
Aceito

## Contexto e Decisão
Para garantir robustez de nível empresarial, estabilidade em produção sem regressões e conformidade legal com a LGPD e privacidade corporativa, decidimos instituir uma política rigorosa de **Limiar de Cobertura** em todo o monorepo (`@corpchat/shared`, `@corpchat/api` e `@corpchat/web`).

A métrica exigida é de **no mínimo 95% em linhas (`lines`), declarações (`statements`) e funções (`functions`)**, com **90% em ramos condicionais (`branches`)**, avaliada de forma agregada por pacote através do provedor nativo `@vitest/coverage-v8`. O descumprimento desses limiares resulta em falha imediata da suíte de testes (`exit code 1`).

## Superfície Testável e Exclusões Técnicas
A cobertura incide estritamente sobre a lógica executável de negócio, serviços, rotas, stores, hooks, componentes e schemas. São excluídos da medição:
- Arquivos de configuração de build e ferramentas (`vite.config.ts`, `vitest.config.ts`, `tsup.config.ts`, `drizzle.config.ts`, `postcss.config.js`, `tailwind.config.js`).
- Declarações de tipos puramente estáticas (`*.d.ts`, arquivos de interfaces sem runtime).
- Migrações geradas pelo ORM (`apps/api/src/db/migrations/**`).
- Mocks, fixtures e setups de teste (`**/test/**`, `**/*.mock.ts`).
- Entrypoint standalone de inicialização de processo (`apps/api/src/index.ts`, `apps/web/src/main.tsx`).

## Opções Consideradas
1. **Limiar flexível sem bloqueio (Apenas relatórios):** Rejeitado porque metas não verificadas automaticamente pelo pipeline tendem a degradar com o tempo à medida que novas features são adicionadas.
2. **Exigência de 95% estrito em Branches:** Rejeitado para evitar incentivos perversos de criação de testes frágeis voltados unicamente a cobrir ramos defensivos de bibliotecas terceiras (ex: fallbacks de mensagens de erro). O limiar de 90% em branches assegura que a lógica real de fluxo seja plenamente coberta sem comprometer a clareza dos testes.
3. **Threshold por arquivo individual (`100% per-file`):** Rejeitado por penalizar módulos utilitários concisos com switch-cases de tratamento de erros raros. O threshold por pacote consolida a responsabilidade global de qualidade de cada domínio.
4. **Adopção do `@vitest/coverage-v8` integrado ao `pnpm test` (Escolhida):** Utiliza instrumentação nativa do Node/V8 com alta performance, gera relatórios em texto no terminal e relatórios detalhados em HTML/LCOV para inspeção e auditoria.
