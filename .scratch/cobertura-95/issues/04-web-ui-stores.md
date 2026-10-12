# 04: Cobertura Abrangente de UI, Stores e Interações (@corpchat/web)

**What to build:**
Expansão dos testes do aplicativo web com React Testing Library para cobrir interações de usuário na Landing Page, páginas autenticadas (`ChatPage`, `AccountPage`), fluxo de autenticação (`LoginPage`, `RegisterPage`), modais de negócio, composers e stores Zustand (`auth.store`, `socket.store`, `signature.store`), alcançando no mínimo 95% de cobertura no `@corpchat/web`.

**Blocked by:** 01: Infraestrutura de Cobertura V8 e Limiares por Workspace, 02: Cobertura Integral de Schemas e Contratos (@corpchat/shared)

**Status:** ready-for-agent

- [ ] Testes de interações da Landing Page (toggle de faturamento mensal/anual, links âncora, botões de CTA e accordion FAQ)
- [ ] Testes dos fluxos de Login e Registro com mensagens de erro em tela, validação de campos e redirecionamentos
- [ ] Testes do ChatPage, filtros de pesquisa, seleção de conversas e estados de vazio
- [ ] Testes do MessageComposer (envio com Enter, bloqueio de anexos offline no Plano Free e barra de progresso)
- [ ] Testes de stores Zustand cobrindo todas as ações, tratamento de erros e sincronização de estado
- [ ] O pacote `@corpchat/web` atinge ≥ 95% em linhas, declarações e funções e ≥ 90% em ramos
