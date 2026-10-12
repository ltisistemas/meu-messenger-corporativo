# Projeto: Micro-SaaS de Mensagens Corporativas (estilo WhatsApp)

> Documento base para **Claude Design** (interface) e **Claude Code** (implementação). Nome do produto: `[DEFINIR]`.

## 1. Visão

Mensageiro web/mobile para equipes, com foco em simplicidade e privacidade: **não armazenamos arquivos**, somos apenas a ponte. Sem chamadas e sem áudio nesta versão.

**Público:** pequenas e médias equipes (10 a 80 pessoas) e empresas maiores (plano Enterprise).

## 2. Planos

|  | Free | Pro | Enterprise |
| --- | --- | --- | --- |
| Preço/mês | R$ 0 | R$ 79,90 | R$ 259,90 |
| Usuários por conta | até 12 | até 80 | ilimitado |
| Tamanho por arquivo | 5 MB | 25 MB | 25 MB |
| Arquivos por envio | 1 | 5 | 20 |
| Teto total por envio | 5 MB | 125 MB | 100 MB * |
| Envio para usuário offline | ❌ | ✅ | ✅ |
| Grupos fixos e temporários | ✅ | ✅ | ✅ |
| Lista de transmissão (todos da conta) | ❌ | ✅ | ✅ |
| Enquetes | ❌ | ✅ | ✅ |
| Assinatura eletrônica | ❌ | ❌ | ✅ |

\* Pendente de confirmação: teto total por envio no Enterprise (sugestão: 100 MB). Acima de 25 MB por arquivo, o app orienta compartilhar link do Google Drive/OneDrive/Dropbox.

**Fora do escopo (todas as versões atuais):** chamadas de áudio/vídeo, mensagens de áudio.

## 3. Requisitos funcionais

### 3.1 Conta e usuários

- Cadastro de conta (organização) e convite de membros por e-mail/link.
- Papéis: `owner`, `admin`, `member`.
- Bloqueio de novos convites ao atingir o limite do plano; CTA de upgrade.

### 3.2 Conversas

- Conversa individual (1:1) e em grupo.
- **Grupo fixo:** permanece até ser excluído.
- **Grupo temporário:** define data/hora de expiração na criação; ao expirar, é arquivado e as mensagens ficam somente leitura (ou são apagadas, configurável pelo admin).
- Mensagens de texto, status de enviado/entregue/lido, indicador de digitação, presença (online/offline).
- Reconhecimento de links (Drive, OneDrive, Dropbox) com cartão de pré-visualização.

### 3.3 Envio de arquivos

**Free (somente online, sem retenção):**

- Destinatário precisa estar online (app aberto + heartbeat).
- Arquivo trafega pelo servidor via WebSocket em memória, **nada é gravado em disco**.
- Se o destinatário estiver offline, o botão de anexo é desabilitado com aviso e CTA de upgrade.
- Em grupo: entrega apenas a quem está online; a mensagem mostra "entregue a X de Y".
- Falha de conexão = envio falha; exibir progresso e botão "reenviar".

**Pro e Enterprise (store-and-forward temporário):**

1. App solicita URL pré-assinada ao backend e envia o arquivo direto ao S3 (ou Cloudflare R2).
2. Mensagem é entregue com a referência do arquivo.
3. Ao concluir o download, o app confirma e o backend apaga o objeto.
4. Se não for baixado, o arquivo é apagado em **5 dias** (job próprio + lifecycle do bucket como backup).
5. Em grupos/listas: manter contador de entregas pendentes; apagar quando todos baixarem ou aos 5 dias.
6. Apagar só após confirmação de download completo.
7. Bucket com criptografia (SSE), URLs de download com validade de 5 a 15 min.

### 3.4 Lista de transmissão (Pro e Enterprise)

- Admin envia uma mensagem (com ou sem anexo) para todos os usuários da conta.
- Destinatários recebem em uma conversa própria "Comunicados", sem possibilidade de resposta pública.
- Relatório de entrega/leitura para o admin.

### 3.5 Enquetes (Pro e Enterprise)

- Criar enquete com pergunta e 2 a 10 opções; voto único ou múltiplo; prazo opcional; anônima ou identificada.
- Resultado em tempo real dentro da conversa.

### 3.6 Assinatura eletrônica (Enterprise)

- Enviar PDF para assinatura a um ou mais usuários, em ordem opcional.
- Registro de evidências: nome, e-mail, IP, data/hora, hash (SHA-256) do documento, autenticação do signatário.
- Nível inicial: assinatura **simples/avançada** (Lei 14.063/2020). Integrar com provedor pronto (ex.: Clicksign ou D4Sign) em vez de construir.
- Documento final assinado + certificado de evidências disponível para download. Segue a política de retenção de arquivos (não fica armazenado no nosso servidor além do prazo).

### 3.7 Cobrança

- Assinatura mensal via gateway (ex.: Stripe, Asaas ou Pagar.me), com Pix, cartão e boleto.
- Upgrade/downgrade, período de teste opcional do Pro, bloqueio gracioso na inadimplência.

## 4. Requisitos não funcionais

- **Tempo real:** WebSocket com reconexão automática e fila de mensagens pendentes.
- **Segurança:** TLS, criptografia em repouso (banco e bucket), isolamento por conta (multi-tenant), rate limit, validação de tipo/tamanho no servidor.
- **LGPD:** política de privacidade informando retenção temporária de até 5 dias; exclusão de dados sob solicitação; logs sem conteúdo de mensagens em texto aberto.
- **Disponibilidade-alvo:** 99,5% no MVP.
- **Idioma:** pt-BR (i18n preparado).
- **Plataformas:** web responsivo (PWA) primeiro; app nativo depois.

## 5. Arquitetura validada

| Camada | Definição |
| --- | --- |
| Monorepo | pnpm Workspaces + Turborepo (`@corpchat/*`) |
| Shared | TypeScript + Zod (validação compartilhada front/back) |
| Frontend | React + TypeScript + Tailwind CSS + Zustand + TanStack Query + Vite (PWA) |
| Backend | Node.js (Fastify) + TypeScript |
| ORM / Banco | Drizzle ORM + PostgreSQL |
| Tempo real | Socket.IO com Redis Adapter (pub/sub e presença) |
| Relay Free | Streaming binário em chunks com backpressure (zero persistência em disco/heap) |
| Arquivos (Pro/Ent) | Cloudflare R2 (S3 API) com URLs pré-assinadas e lifecycle policy |
| Jobs | BullMQ + Redis (expiração de arquivos, grupos temporários, notificações) |
| Auth | JWT + refresh token com rotação; convite por e-mail |
| Pagamentos | Asaas (Pix recorrente, boleto, cartão de crédito e webhooks) |
| Assinatura | Clicksign (API REST de assinatura eletrônica simples/avançada) |
| Notificações | Web Push Notifications (VAPID / Service Worker no PWA) |
| Infra | Docker Compose (local), deploy em Fly.io/Railway/AWS, CI com GitHub Actions |

**Regras de negócio sempre validadas no servidor:** limites de plano (tamanho, quantidade, usuários) e recursos liberados por plano (feature flags por `plan`).

## 6. Modelo de dados (resumo)

- `accounts` (id, nome, plano, status: active/over_quota/suspended, trial_until, limites)
- `users` (id, account_id, nome, e-mail, papel, status: active/inactive, último_acesso)
- `conversations` (id, account_id, tipo: direta/grupo/transmissão, nome, temporário, expira_em, status: active/archived_readonly)
- `conversation_members` (conversation_id, user_id, papel)
- `messages` (id, conversation_id, sender_id, tipo: texto/arquivo/enquete/link/assinatura, conteúdo, criado_em)
- `message_receipts` (message_id, user_id, entregue_em, lido_em)
- `file_transfers` (id, message_id, nome, tamanho, mime, storage_key, expira_em, pendentes, status)
- `polls`, `poll_options`, `poll_votes`
- `signature_requests`, `signature_signers`, `signature_evidence`
- `subscriptions`, `invoices`

## 7. Briefing para o Claude Design

**Tom visual:** limpo, profissional, leve; sensação de produto confiável para empresas. Tema claro e escuro. Mobile-first, com layout de duas colunas no desktop (lista de conversas + chat).

**Telas a desenhar:**

1. Login / cadastro / convite aceito
2. Lista de conversas (busca, não lidas, presença)
3. Chat (mensagens, anexos, status, enquete, cartão de link, indicador de entrega "X de Y")
4. Composer de mensagem com anexo (estados: habilitado, desabilitado por usuário offline, limite excedido)
5. Criar grupo (fixo ou temporário, com data de expiração)
6. Detalhes do grupo (membros, expiração, configurações)
7. Nova enquete e resultado
8. Lista de transmissão: criar, enviar e relatório
9. Assinatura eletrônica: enviar documento, acompanhar signatários, baixar certificado
10. Painel da conta: membros, convites, uso do limite de usuários, alerta de quota excedida
11. Planos e cobrança: comparativo, upgrade, faturas e gestão de assinatura Asaas
12. Estados vazios, erros (arquivo grande demais com sugestão de Drive, usuário offline, falha de envio com "reenviar")

**Mensagens-chave de UX:**

- Arquivo acima do limite: "Esse arquivo passa de 25 MB. Compartilhe pelo Google Drive e cole o link aqui."
- Free e destinatário offline: "Fulano está offline. No plano Free, arquivos só são enviados para quem está online."
- Grupo no Free: "Entregue a 4 de 7."
- Conta over-quota: "Sua conta atingiu o limite de usuários do plano Free. Desative os membros excedentes para voltar a enviar mensagens."

**Acessibilidade:** contraste WCAG AA, áreas de toque de 44 px, navegação por teclado.

## 8. Roadmap de implementação (para Claude Code)

**Fase 1: Base** Autenticação, contas, convites, conversas 1:1 e grupos (fixos), mensagens de texto em tempo real, presença.

**Fase 2: Arquivos** Relay em streaming no Free (somente online); store-and-forward com Cloudflare R2 no Pro/Enterprise; exclusão pós-download e job de 5 dias; limites por plano.

**Fase 3: Recursos de grupo** Grupos temporários com expiração e modo somente leitura, lista de transmissão, enquetes.

**Fase 4: Monetização** Gateway Asaas, upgrade/downgrade, status over-quota, feature flags por plano, bloqueio de limites e Trial de 14 dias.

**Fase 5: Enterprise** Assinatura eletrônica via Clicksign, certificado de evidências, relatórios.

**Fase 6: Endurecimento** LGPD (política, exportação e exclusão de dados), testes de carga, observabilidade, backups.

## 9. Critérios de aceite do MVP (Fases 1 a 4)

- Usuário Free não consegue enviar arquivo a destinatário offline nem passar de 5 MB.
- Nenhum arquivo do Free é gravado em disco ou bucket; streaming em chunks com backpressure.
- Arquivos do Pro/Enterprise são apagados após o download completo de todos os destinatários ou em até 5 dias.
- A conta não ultrapassa o limite de usuários do plano; se em downgrade excedente, entra em `over_quota` até regularização.
- Recursos exclusivos (transmissão, enquetes) ficam bloqueados no Free, no servidor e na interface.
- Mensagens chegam em menos de 1 s em condições normais de rede.
- Trial de 14 dias do Pro sem cartão de crédito funcional para novas contas.

## 10. Decisões Consolidadas (Grill-Me)

1. **Nome do Produto:** Nome de trabalho provisório `NextMsg` (`@corpchat/*` no monorepo), configurável via branding/env vars.
2. **Teto Total Enterprise:** 100 MB total por envio (máx. 20 arquivos de até 25 MB). Arquivos > 25 MB orientam compartilhamento via link.
3. **Grupo Temporário Expirado:** Torna-se Somente Leitura (Read-Only) e é arquivado. Histórico permanece consultável e o Admin pode excluir manualmente.
4. **Gateway de Pagamento:** **Asaas** (suporte líder no Brasil a Pix recorrente, boleto bancário, cartão de crédito e webhooks).
5. **Trial:** 14 dias de Trial gratuito do plano Pro (sem cartão no cadastro), regredindo ao Free automaticamente se não houver assinatura.
6. **Assinatura Eletrônica:** **Clicksign** (API moderna compatível com Lei 14.063/2020 e evidências SHA-256).
7. **Relay Free em Memória:** Streaming binário em chunks com backpressure via Socket.IO (sem reter arquivos completos na memória do Node.js).
8. **Stack Backend & ORM:** **Fastify** + **Drizzle ORM** + **PostgreSQL** + **Redis** + **BullMQ**.
9. **Stack Frontend:** **React** + **Vite** + **Tailwind CSS** + **Zustand** + **TanStack Query** + **React Router** (PWA com Web Push).
10. **Monorepo & Schemas:** **pnpm Workspaces** + **Turborepo** com validação unificada via **Zod** em `packages/shared`.
11. **Comportamento de Downgrade Excedente:** A conta entra em status `over_quota` (somente leitura para novos envios) até que o Admin desative os membros excedentes.

## 11. Tickets de implementação

### Como usar (para evitar alucinação)

- Rode **um ticket por vez**, em uma conversa nova do Claude Code, passando só: a seção 5 (arquitetura), a seção 6 (modelo de dados) e o ticket em questão.
- Instrução fixa a cada ticket: *"Implemente apenas este ticket. Não altere nada fora do escopo. Se algo não estiver especificado, pergunte antes de assumir."*
- Ao terminar: rodar testes, revisar o diff e dar commit. Só então abrir o próximo.
- Respeite as dependências. Cada ticket deve caber em uma sessão curta (meta: até \~10 arquivos alterados).
- Mantenha um `CLAUDE.md` na raiz com as decisões já tomadas (stack, convenções, regras de plano).

Formato: **ID** · título · *depende de* · escopo · **aceite**.

### Fase 0: Fundação

- **T-01** · Setup do monorepo · *nenhuma* · Estrutura `apps/web`, `apps/api`, `packages/shared`, Docker Compose (Postgres + Redis), lint, formatação, CI básico. **Aceite:** `docker compose up` sobe tudo; CI roda lint e testes vazios.
- **T-02** · Migrations iniciais · *T-01* · Tabelas `accounts`, `users`, `conversations`, `conversation_members`, `messages`, `message_receipts`. **Aceite:** migration sobe e desce sem erro.
- **T-03** · Configuração de planos · *T-01* · Arquivo único com limites e recursos por plano (Free/Pro/Enterprise) e função `can(plan, feature)`. **Aceite:** testes unitários cobrindo todos os limites da tabela da seção 2.

### Fase 1: Base

- **T-04** · Cadastro de conta e login · *T-02* · Criar conta + owner, login, JWT e refresh token. **Aceite:** testes de cadastro, login, token expirado.
- **T-05** · Convite de membros · *T-04, T-03* · Convite por e-mail/link, papéis, bloqueio ao atingir limite de usuários. **Aceite:** Free bloqueia o 13º usuário; Pro, o 81º.
- **T-06** · Servidor WebSocket e autenticação · *T-04* · Conexão autenticada, reconexão, heartbeat. **Aceite:** conexão sem token é recusada; queda e retorno restabelecem a sessão.
- **T-07** · Presença online/offline · *T-06* · Redis para presença, eventos para os contatos. **Aceite:** status muda em até 30 s após queda.
- **T-08** · Conversas 1:1 e grupos fixos (API) · *T-05* · Criar, listar, adicionar/remover membros. **Aceite:** isolamento por conta testado (usuário não acessa conta alheia).
- **T-09** · Mensagens de texto em tempo real · *T-06, T-08* · Envio, persistência, entrega, fila para offline. **Aceite:** mensagem enviada a usuário offline chega ao reconectar.
- **T-10** · Recibos de entrega e leitura · *T-09* · Enviado/entregue/lido e indicador de digitação. **Aceite:** estados atualizam em tempo real nos dois lados.

### Fase 2: Interface base (Claude Design + front)

- **T-11** · Design system e layout base · *T-01* · Tokens (cores, tipografia), componentes básicos, tema claro/escuro, layout de duas colunas. **Aceite:** página de exemplo renderiza em mobile e desktop.
- **T-12** · Telas de login, cadastro e convite · *T-04, T-11* · **Aceite:** fluxo completo funcionando contra a API.
- **T-13** · Lista de conversas · *T-08, T-11* · Busca, não lidas, presença. **Aceite:** atualiza em tempo real.
- **T-14** · Tela de chat e composer de texto · *T-09, T-10, T-13* · **Aceite:** conversa 1:1 e em grupo funcionam ponta a ponta.

### Fase 3: Arquivos

- **T-15** · Validação de limites de arquivo · *T-03* · Módulo que valida tamanho, quantidade e teto total por plano. **Aceite:** testes de todos os casos de borda.
- **T-16** · Relay em memória no Free · *T-09, T-15* · Envio por WebSocket sem gravar em disco, só para online. **Aceite:** nenhum arquivo em disco ou bucket; offline é recusado com erro claro.
- **T-17** · Entrega parcial em grupo (Free) · *T-16* · "Entregue a X de Y". **Aceite:** só quem estava online recebe; contador correto.
- **T-18** · UI de anexo no Free · *T-14, T-16* · Estados: desabilitado (offline), progresso, falha com reenviar, limite excedido. **Aceite:** todos os estados visíveis e testados.
- **T-19** · Upload via URL pré-assinada (Pro/Enterprise) · *T-15* · Endpoint que gera URL, bucket R2/S3 com SSE. **Aceite:** upload direto funciona; Free não consegue gerar URL.
- **T-20** · Download com confirmação e exclusão · *T-19* · URL de curta duração, confirmação do app, exclusão do objeto. **Aceite:** download interrompido não apaga; completo apaga.
- **T-21** · Contador de pendentes em grupos · *T-20* · Apagar quando todos baixarem. **Aceite:** arquivo some só após o último destinatário.
- **T-22** · Job de expiração em 5 dias · *T-20* · BullMQ + regra de lifecycle de backup. **Aceite:** arquivo não baixado é apagado aos 5 dias (testar com prazo reduzido).
- **T-23** · Cartão de link (Drive/OneDrive/Dropbox) · *T-14* · Detecção de URL e pré-visualização; sugestão ao exceder 25 MB. **Aceite:** links reconhecidos viram cartão.

### Fase 4: Recursos de grupo

- **T-24** · Grupos temporários · *T-08, T-22* · Data de expiração, arquivamento, job de expiração. **Aceite:** ao expirar, grupo vira somente leitura.
- **T-25** · Lista de transmissão · *T-09, T-03* · Envio a toda a conta, conversa "Comunicados", relatório de entrega. **Aceite:** Free bloqueado; Pro/Enterprise enviam; relatório correto.
- **T-26** · Enquetes (API) · *T-09, T-03* · Criar, votar (único/múltiplo), prazo, anônima/identificada. **Aceite:** voto duplicado bloqueado; resultado em tempo real.
- **T-27** · Telas de grupo, transmissão e enquete · *T-24, T-25, T-26* · **Aceite:** fluxos funcionando no front.

### Fase 5: Monetização

- **T-28** · Integração com gateway de pagamento · *T-03, T-04* · Assinatura, webhooks, status da conta. **Aceite:** pagamento aprovado muda o plano; cancelamento rebaixa ao fim do ciclo.
- **T-29** · Upgrade, downgrade e inadimplência · *T-28* · Regras de limite ao rebaixar (ex.: conta com 50 usuários voltando ao Free). **Aceite:** comportamento definido e testado.
- **T-30** · Telas de planos, faturas e painel da conta · *T-28, T-11* · **Aceite:** comparativo, upgrade e uso do limite visíveis.

### Fase 6: Enterprise

- **T-31** · Provedor de assinatura (spike) · *T-03* · Escolher entre Clicksign/D4Sign, testar API em sandbox. **Aceite:** documento assinado de ponta a ponta no sandbox.
- **T-32** · Fluxo de assinatura na API · *T-31* · Solicitação, signatários, ordem, webhooks de status. **Aceite:** só Enterprise acessa; status atualiza.
- **T-33** · Certificado de evidências e download · *T-32* · IP, data/hora, hash SHA-256. **Aceite:** hash confere com o documento original.
- **T-34** · Telas de assinatura · *T-32, T-11* · **Aceite:** enviar, acompanhar e baixar.

### Fase 7: Endurecimento

- **T-35** · Rate limit e validações de segurança · *T-09* · **Aceite:** abuso de envio é limitado.
- **T-36** · LGPD · *T-04* · Política de privacidade, exportação e exclusão de dados do usuário. **Aceite:** exclusão remove dados pessoais.
- **T-37** · Observabilidade e backups · *T-01* · Logs estruturados (sem conteúdo de mensagem), métricas, backup do Postgres. **Aceite:** restauração testada.
- **T-38** · Teste de carga · *T-16, T-22* · Simular 80 usuários simultâneos com arquivos. **Aceite:** relatório de gargalos e custo de banda.