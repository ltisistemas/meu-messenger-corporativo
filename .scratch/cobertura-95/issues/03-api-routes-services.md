# 03: Cobertura Profunda de Rotas, Erros e Serviços (@corpchat/api)

**What to build:**
Expansão dos testes de integração HTTP via `server.inject()` e mocks deterministicos de adapters no backend para cobrir caminhos de erro, status HTTP 4xx/5xx, validação de permissões por papel (`owner`, `admin`, `member`), rate limit, WebSocket e jobs de ciclo de vida, alcançando no mínimo 95% de cobertura no `@corpchat/api`.

**Blocked by:** 01: Infraestrutura de Cobertura V8 e Limiares por Workspace, 02: Cobertura Integral de Schemas e Contratos (@corpchat/shared)

**Status:** ready-for-agent

- [ ] Testes de rotas de autenticação e contas cobrindo caminhos de erro de banco, tokens expirados e senhas inválidas
- [ ] Testes de conversas, grupos temporários e canais de transmissão cobrindo restrições de permissão e limites de plano
- [ ] Testes de conformidade LGPD (Art. 18) cobrindo exportação integral e eliminação/anonimização de dados
- [ ] Testes de serviços de billing, cobrança e assinaturas digitais com tratamento de webhooks e erros de API externa
- [ ] Testes dos jobs de expiração de arquivos e grupos temporários cobrindo transições de estado e falhas
- [ ] O pacote `@corpchat/api` atinge ≥ 95% em linhas, declarações e funções e ≥ 90% em ramos
