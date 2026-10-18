# 05: Gatekeeper de Qualidade e Validação Automatizada de CI

**What to build:**
Validação unificada e bloqueio automatizado no script `pnpm test`, garantindo que todos os workspaces executem simultaneamente com relatórios gerados e que o pipeline falhe com exit code 1 se qualquer métrica cair abaixo do Limiar de Cobertura acordado.

**Blocked by:** 03: Cobertura Profunda de Rotas, Erros e Serviços (@corpchat/api), 04: Cobertura Abrangente de UI, Stores e Interações (@corpchat/web)

**Status:** closed

- [x] Execução limpa do comando `pnpm test` com validação de cobertura em todos os pacotes
- [x] Geração de relatório consolidado de cobertura em terminal e artefatos HTML/LCOV
- [x] Garantia de 0 regressões nos 367 testes existentes mais os novos testes adicionados (546 testes no total)
- [x] Verificação de que uma queda simulada abaixo de 95% bloqueia a execução do comando com exit code 1
