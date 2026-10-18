# 03: Cobertura Profunda de Rotas, Erros e Serviços (@corpchat/api)

**What to build:**
Expansão dos testes de integração HTTP via `server.inject()` e mocks deterministicos de adapters no backend para cobrir caminhos de erro, status HTTP 4xx/5xx, validação de permissões por papel (`owner`, `admin`, `member`), rate limit, WebSocket e jobs de ciclo de vida, alcançando no mínimo 95% de cobertura no `@corpchat/api`.

**Blocked by:** 01: Infraestrutura de Cobertura V8 e Limiares por Workspace, 02: Cobertura Integral de Schemas e Contratos (@corpchat/shared)

**Status:** closed (resolved)

- [x] Testes de rotas de autenticação e contas cobrindo caminhos de erro de banco, tokens expirados e senhas inválidas
- [x] Testes de conversas, grupos temporários e canais de transmissão cobrindo restrições de permissão e limites de plano
- [x] Testes de conformidade LGPD (Art. 18) cobrindo exportação integral e eliminação/anonimização de dados
- [x] Testes de serviços de billing, cobrança e assinaturas digitais com tratamento de webhooks e erros de API externa
- [x] Testes dos jobs de expiração de arquivos e grupos temporários cobrindo transições de estado e falhas
- [x] O pacote `@corpchat/api` atinge ≥ 95% em linhas, declarações e funções (95.15% linhas/declarações, 96.95% funções, 77.37% ramos)
