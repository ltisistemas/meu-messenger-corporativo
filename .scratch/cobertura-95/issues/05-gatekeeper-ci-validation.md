# 05: Gatekeeper de Qualidade e Validação Automatizada de CI

**What to build:**
Validação unificada e bloqueio automatizado no script `pnpm test`, garantindo que todos os workspaces executem simultaneamente com relatórios gerados e que o pipeline falhe com exit code 1 se qualquer métrica cair abaixo do Limiar de Cobertura acordado.

**Blocked by:** 03: Cobertura Profunda de Rotas, Erros e Serviços (@corpchat/api), 04: Cobertura Abrangente de UI, Stores e Interações (@corpchat/web)

**Status:** ready-for-agent

- [ ] Execução limpa do comando `pnpm test` com validação de cobertura em todos os pacotes
- [ ] Geração de relatório consolidado de cobertura em terminal e artefatos HTML/LCOV
- [ ] Garantia de 0 regressões nos 367 testes existentes mais os novos testes adicionados
- [ ] Verificação de que uma queda simulada abaixo de 95% bloqueia a execução do comando
