# 02: Cobertura Integral de Schemas e Contratos (@corpchat/shared)

**What to build:**
Expansão da suíte de testes de `@corpchat/shared` para alcançar no mínimo 98% de cobertura de código, cobrindo todos os Zod schemas, limites dos planos (Free, Pro, Enterprise), DTOs de mensagens e arquivos, enums e constantes com casos positivos e negativos.

**Blocked by:** 01: Infraestrutura de Cobertura V8 e Limiares por Workspace

**Status:** ready-for-agent

- [ ] Testes exaustivos para todos os schemas de validação Zod de autenticação, contas, convites e usuários
- [ ] Testes de limites de plano garantindo rejeição e aceitação de cotas de membros, armazenamento e retenção
- [ ] Testes para schemas de mensagens, conversas, grupos temporários e canais de transmissão
- [ ] Testes para schemas de arquivos, validações de MIME type e tamanhos limite por plano
- [ ] O pacote `@corpchat/shared` atinge ≥ 95% em linhas, declarações e funções e ≥ 90% em ramos
