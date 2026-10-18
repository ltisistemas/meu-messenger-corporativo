# DOCUMENTAÇÃO TÉCNICA COMPLETA DA INTEGRAÇÃO COM ASAAS (V3)

## Engenharia Reversa, Arquitetura, Contratos, Webhooks, Persistência e Regras de Negócio

---

## SUMÁRIO EXECUTIVO E ÍNDICE

1. [Visão Geral da Integração](#1-visão-geral-da-integração)
   - 1.1. Finalidade e Escopo no Negócio
   - 1.2. Funcionalidades Implementadas e Modalidades
   - 1.3. Arquitetura Geral da Solução
   - 1.4. Componentes e Responsabilidades
   - 1.5. Dependências Internas e Externas (Versões)
   - 1.6. Ambientes Suportados (Sandbox vs. Produção vs. Dev Offline)
   - 1.7. Recursos do Asaas Utilizados vs. Recursos Não Implementados
   - 1.8. Coexistência com Gateway Legado (Abacate Pay)
2. [Variáveis de Ambiente e Configurações](#2-variáveis-de-ambiente-e-configurações)
   - 2.1. Inventário Detalhado das Variáveis de Ambiente
   - 2.2. Resolução Dinâmica de Credenciais e Ambientes
   - 2.3. Comportamento Diante de Ausência ou Invalidez
   - 2.4. Arquivo de Exemplo Sanitizado (`.env.example`)
3. [Comunicação com a API do Asaas](#3-comunicação-com-a-api-do-asaas)
   - 3.1. Cliente HTTP e Instanciação Centralizada
   - 3.2. Autenticação e Headers Padrão
   - 3.3. Endpoints Utilizados e Mapeamento
   - 3.4. Contratos Técnicos de Comunicação com a API Asaas
     - 3.4.1. Consulta e Criação de Clientes (`GET /customers`, `POST /customers`, `PUT /customers/{id}`)
     - 3.4.2. Criação de Assinatura Recorrente (`POST /subscriptions`)
     - 3.4.3. Listagem de Cobranças da Assinatura (`GET /subscriptions/{id}/payments`)
     - 3.4.4. Obtenção do QR Code PIX (`GET /payments/{id}/pixQrCode`)
     - 3.4.5. Consulta de Status de Cobrança (`GET /payments/{id}`)
   - 3.5. Tratamento de Erros, Retentativas e Backoff
   - 3.6. Modo de Desenvolvimento e Simulação Offline (`devStore`)
4. [Gestão de Clientes e Pagadores](#4-gestão-de-clientes-e-pagadores)
   - 4.1. Estratégia de Identificação e Resolução de Clientes
   - 4.2. Algoritmo de Validação e Fallback de CPF/CNPJ
   - 4.3. Associação com Usuário do Banco Local
   - 4.4. Atualização de Dados Cadastrais Faltantes
5. [Cobranças, Assinaturas e Ciclo Financeiro](#5-cobranças-assinaturas-e-ciclo-financeiro)
   - 5.1. Modalidade Implementada: Assinatura Recorrente via PIX
   - 5.2. Ciclos de Cobrança Suportados (Mensal vs. Anual) e Valores
   - 5.3. Máquina de Estados de Pagamentos
   - 5.4. Mapeamento de Status: Asaas vs. Banco de Dados Local
   - 5.5. Política de Vencimento, Renovação e Tolerância (Grace Period de 3 Dias)
   - 5.6. Política de Cancelamento Agendado e Downgrade Automático
6. [Webhooks e Observabilidade Operacional](#6-webhooks-e-observabilidade-operacional)
   - 6.1. Rota, Métodos e Autenticação do Webhook
   - 6.2. Arquitetura de Idempotência e Deduplicação
   - 6.3. Algoritmo Multi-Chave de Resolução do Usuário
   - 6.4. Matriz Completa de Eventos Tratados e Ações Executadas
   - 6.5. Proteção de Usuários Administradores contra Downgrade
   - 6.6. Registro de Auditoria e Tabela de Observabilidade (`webhook_eventos`)
   - 6.7. Pseudocódigo Fiel do Processamento do Webhook
   - 6.8. Exemplos Sanitizados de Payloads Reais do Asaas
7. [Banco de Dados e Persistência](#7-banco-de-dados-e-persistência)
   - 7.1. Modelo Lógico e Textual de Relacionamentos
   - 7.2. Script DDL Completo das Tabelas Relacionadas
   - 7.3. Dicionário de Dados de Cada Campo Relevante
   - 7.4. Mecanismo de Inicialização Sob Demanda (`Schema-on-Demand`)
8. [Fluxos Completos de Ponta a Ponta (com Diagramas Mermaid)](#8-fluxos-completos-de-ponta-a-ponta)
   - 8.1. Fluxo 1: Assinatura e Pagamento via PIX Transparente
   - 8.2. Fluxo 2: Processamento de Webhook de Ativação / Renovação
   - 8.3. Fluxo 3: Processamento de Webhook de Inadimplência / Cancelamento / Estorno
   - 8.4. Fluxo 4: Verificação Passiva de Assinatura no Carregamento do Usuário (`/api/auth/me`)
   - 8.5. Fluxo 5: Agendamento e Reativação de Cancelamento pelo Usuário
9. [Rotas Internas da Aplicação e Contratos Locais](#9-rotas-internas-da-aplicação-e-contratos-locais)
   - 9.1. `POST /api/checkout`
   - 9.2. `GET /api/checkout/status`
   - 9.3. `POST /api/checkout/status` (Simulação Sandbox)
   - 9.4. `POST /api/webhooks/asaas`
   - 9.5. `POST /api/auth/downgrade`
   - 9.6. `GET /api/auth/me`
   - 9.7. Rotas Administrativas (`/api/admin/webhooks`, `/api/admin/users/...`)
10. [Segurança e Resiliência](#10-segurança-e-resiliência)
    - 10.1. Proteção de Credenciais e Isolamento de Chaves
    - 10.2. Validação de Tokens de Webhook
    - 10.3. Rate Limiting de Operações Financeiras
    - 10.4. Tratamento de Inconsistências de Chaves Estrangeiras
11. [Matriz de Erros e Recuperação](#11-matriz-de-erros-e-recuperação)
12. [Testes, Simulações e Validação](#12-testes-simulações-e-validação)
    - 12.1. Estrutura de Testes Automatizados (Vitest)
    - 12.2. Scripts Utilitários de Diagnóstico e Homologação
    - 12.3. Guia Passo a Passo de Homologação em Sandbox
13. [Dependências Operacionais e Configuração no Painel Asaas](#13-dependências-operacionais-e-configuração-no-painel-asaas)
14. [Dependências do Domínio Original vs. Núcleo Reutilizável](#14-dependências-do-domínio-original-vs-núcleo-reutilizável)
15. [Índice Remissivo de Arquivos e Código-Fonte](#15-índice-remissivo-de-arquivos-e-código-fonte)
16. [Auditoria Final de Completude e Lacunas](#16-auditoria-final-de-completude-e-lacunas)

---

## 1. VISÃO GERAL DA INTEGRAÇÃO

### 1.1. Finalidade e Escopo no Negócio

A integração com o gateway de pagamentos **Asaas** tem como finalidade primordial gerenciar o ciclo de vida financeiro dos usuários da plataforma SaaS **ViraPropo AI!**.
A plataforma opera sob um modelo freemium de monetização:

- **Plano Free**: Limite rígido de criação de até 3 propostas comerciais por mês civil, layout monocromático padrão, sem suporte a logo corporativa personalizada e sem coleta de assinatura eletrônica.
- **Plano Pro**: Geração ilimitada de propostas assistidas por inteligência artificial (Google Gemini), templates executivos coloridos com design responsivo, upload e renderização de logotipo em Base64 no cabeçalho dos documentos, links públicos de alta conversão para WhatsApp e sistema completo de coleta de aceite e assinatura eletrônica com carimbo de tempo, IP e hash probatório SHA-256.

A integração com o Asaas é responsável por:

1. Criar e gerenciar a identidade financeira do cliente no gateway.
2. Emitir contratos de assinatura recorrente pré-pagos.
3. Gerar a cobrança correspondente em formato **PIX Transparente** (Copia e Cola e imagem do QR Code em Base64).
4. Monitorar a liquidação do pagamento (via polling no frontend e via Webhooks assíncronos oficiais).
5. Ativar e renovar o acesso aos recursos do Plano Pro no banco de dados local.
6. Gerenciar cancelamentos agendados, períodos de tolerância por inadimplência (Grace Period) e rebaixamento automático para o plano Free (Downgrade).
7. Fornecer observabilidade e auditoria financeira completa em painel administrativo executivo.

### 1.2. Funcionalidades Implementadas e Modalidades

| Funcionalidade                                | Implementado?                                          | Detalhes no Código                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Criação / Busca de Cliente Asaas**          | Sim                                                    | Busca por `existingCustomerId`, por `cpfCnpj`, por `email`, ou cria novo via `POST /v3/customers`.                                                                 |
| **Fallback de Documento (CPF)**               | Sim                                                    | Algoritmo determinístico com cálculo dos 2 dígitos verificadores (módulo 11) para evitar bloqueios no Asaas Sandbox caso o usuário não informe CNPJ/CPF no perfil. |
| **Assinatura Recorrente**                     | Sim                                                    | Implementada via `POST /v3/subscriptions`. Suporta ciclos Mensal (`MONTHLY`) e Anual (`YEARLY`).                                                                   |
| **Cobrança Avulsa**                           | Parcial (Scripts)                                      | Demonstrada em scripts de diagnóstico (`scripts/test-one-real.js`), mas o fluxo principal de checkout do SaaS utiliza o modelo de assinaturas recorrentes.         |
| **PIX Transparente (Copia e Cola + QR Code)** | Sim                                                    | Resgate imediato da primeira cobrança gerada para a assinatura e consulta via `GET /v3/payments/{id}/pixQrCode`. Renderização direta na modal de checkout.         |
| **Fatura Externa Asaas (`invoiceUrl`)**       | Sim                                                    | Link de fatura direta disponibilizado na modal e armazenado na tabela local de pagamentos.                                                                         |
| **Boleto Bancário**                           | Campos Mapeados / Não Habilitado no Checkout Principal | Tipagens e campos `bankSlipUrl` existem no cliente HTTP, mas a interface pública força `billingType: "PIX"`.                                                       |
| **Cartão de Crédito**                         | Tipado / Não Implementado no Checkout                  | Interfaces tipadas aceitam `CREDIT_CARD`, mas o fluxo web implementado não expõe formulário de captura de cartão nem tokenização de cartão transparente.           |
| **Links de Pagamento Avulsos Asaas**          | Não Implementado                                       | A plataforma utiliza checkout transparente direto com PIX e não redireciona para páginas de link de pagamento genéricas do Asaas.                                  |
| **Cancelamento Agendado pelo Usuário**        | Sim                                                    | Endpoint local `/api/auth/downgrade` permite manter o acesso Pro até o fim do ciclo vigente (`data_proxima_cobranca`).                                             |
| **Período de Tolerância (Grace Period)**      | Sim                                                    | 3 dias corridos de tolerância para faturas em atraso antes do downgrade irreversível para o plano Free.                                                            |
| **Downgrade Automático via Webhook**          | Sim                                                    | Tratamento de eventos de atraso, cancelamento, deleção e estorno no webhook com rebaixamento para Free.                                                            |
| **Proteção de Administradores**               | Sim                                                    | Usuários com `role = 'admin'` são imunizados contra downgrades, mesmo recebendo webhooks de cancelamento do Asaas.                                                 |
| **Deduplicação e Idempotência**               | Sim                                                    | Tabela dedicada `webhook_eventos` com chave primária no ID do evento do Asaas.                                                                                     |
| **Auditoria e Observabilidade Admin**         | Sim                                                    | Histórico de latência, status, ação executada e payload JSON completo exposto em rotas e telas de administração.                                                   |

### 1.3. Arquitetura Geral da Solução

A aplicação adota a arquitetura de **Next.js (App Router)** com arquitetura serverless / edge-ready hospedada na Vercel, integrada com banco de dados **PostgreSQL** hospedado na infraestrutura Supabase/AWS.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   NAVEGADOR DO CLIENTE                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ UpgradeModal.tsx: Seleção de Ciclo (Mensal R$ 45,90 / Anual R$ 397,00)           │  │
│  │ Exibição do QR Code Base64 + Botão Copiar PIX + Polling GET /api/checkout/status │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────▲──────────────────────┘
                                  │ POST /api/checkout            │ Polling (3 em 3 seg)
                                  ▼                               │
┌─────────────────────────────────────────────────────────────────┴──────────────────────┐
│                                NEXT.JS BACKEND (API ROUTES)                            │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────┐  │
│  │ /api/checkout/route.ts │  │ /api/checkout/status   │  │ /api/webhooks/asaas      │  │
│  │  - Rate Limiter        │  │  - Consulta DB Local   │  │  - Header asaas-access-  │  │
│  │  - Cria Cliente Asaas  │  │  - Consulta API Asaas  │  │    token                  │  │
│  │  - Cria Assinatura     │  │  - Atualiza Plano Local│  │  - Idempotência DB       │  │
│  │  - Obtém QR Code PIX   │  │  - Simulação Sandbox   │  │  - Resolução Multi-Chave │  │
│  └───────────┬────────────┘  └───────────┬────────────┘  └────────────┬─────────────┘  │
│              │                           │                            │                │
│              │        ┌──────────────────┴──────────────────┐         │                │
│              └───────►│ lib/asaas/client.ts (Axios Engine)  │◄────────┘                │
│                       └──────────────────┬──────────────────┘                          │
└──────────────────────────────────────────┼─────────────────────────────────────────────┘
                                           │ Chamadas HTTP REST (HTTPS)
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              GATEWAY ASAAS (API v3)                                    │
│  - Sandbox: https://api-sandbox.asaas.com/v3                                           │
│  - Produção: https://api.asaas.com/v3                                                  │
│                                                                                        │
│  Endpoints:                                                                            │
│    • /customers (GET, POST, PUT)                                                       │
│    • /subscriptions (POST)                                                             │
│    • /subscriptions/{id}/payments (GET)                                                │
│    • /payments/{id}/pixQrCode (GET)                                                    │
│    • /payments/{id} (GET)                                                              │
│                                                                                        │
│  Disparo de Webhooks HTTP:                                                             │
│    • POST https://seu-dominio.com/api/webhooks/asaas                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.4. Componentes e Responsabilidades

- **`lib/asaas/client.ts`**: Cliente oficial de integração. Responsável por ler variáveis de ambiente, definir a URL base conforme o prefixo da chave, injetar os cabeçalhos de autenticação (`access_token`), formatar payloads de clientes e assinaturas, calcular fallback de CPFs, extrair mensagens de erro da API e gerenciar simulações sandbox em memória (`devStore`).
- **`app/api/checkout/route.ts`**: Controller de checkout autenticado (JWT). Aplica rate limiting (10 req/min por usuário), sincroniza/cria o cliente no Asaas, armazena `asaas_customer_id` no banco local, gera a assinatura no Asaas, faz retentativas com backoff progressivo para capturar a primeira cobrança da assinatura, gera o QR Code PIX e persiste o registro pendente na tabela `pagamentos`.
- **`app/api/checkout/status/route.ts`**: Controller de consulta de status de liquidação. Verifica primeiro se a cobrança já foi confirmada localmente no banco por webhook; caso contrário, consulta o endpoint do Asaas (`GET /v3/payments/{id}`). Se confirmada (`RECEIVED`, `CONFIRMED`, `RECEIVED_IN_CASH`), promove o usuário imediatamente para Pro e estende a cobrança por 30 dias. Também fornece rota `POST` para simulação direta em ambiente de homologação.
- **`app/api/webhooks/asaas/route.ts`**: Endpoint receptor de notificações do Asaas. Valida o token de segurança (`asaas-access-token`), garante idempotência contra a tabela `webhook_eventos`, resolve o usuário alvo utilizando 3 chaves independentes (`externalReference`, `subscriptionId`, `customerId`), executa promoções ou downgrades, protege contas de administrador e registra auditoria com métricas de duração.
- **`lib/db/users.ts`**: Camada de modelo e persistência de usuários. Contém o motor de validação passiva de assinatura (`validarAssinaturaUsuario`), o controle de contadores de propostas, e as funções de agendamento de cancelamento e concessão manual de planos.
- **`lib/db/webhooks.ts`**: Camada de persistência e auditoria de webhooks. Garante a tabela `webhook_eventos`, gerencia a verificação de unicidade de eventos e fornece consultas paginadas e métricas agregadas para o painel administrativo.
- **`lib/db/admin-dashboard.ts`**: Agregador de inteligência financeira. Calcula MRR estimado, faturamento diário/mensal e converte dados de pagamentos para o painel executivo.
- **`components/Billing/UpgradeModal.tsx`**: Interface do usuário para conversão. Exibe seletor de ciclo mensal/anual, botão de pagamento, QR Code PIX renderizado e mecanismo de polling síncrono.
- **`app/(dashboard)/config/page.tsx`**: Painel de configurações do usuário. Exibe o status da assinatura, próxima renovação, alerta de tolerância e botão de cancelamento/reativação.

### 1.5. Dependências Internas e Externas (Versões)

Extraídas fielmente de `package.json`:

- **`next`**: `16.3.4` (React Server Components, App Router, Route Handlers).
- **`react`** / **`react-dom`**: `19.2.8`.
- **`axios`**: `^1.20.0` (utilizado para disparar as chamadas HTTP à API do Asaas).
- **`pg`**: `^8.23.0` (driver PostgreSQL nativo com pooling de conexões).
- **`jsonwebtoken`**: `^9.0.3` (autenticação JWT de usuários nas rotas de checkout).
- **`zod`**: `^4.6.0` (validação de schemas de requisições).
- **`bcryptjs`**: `^3.0.3` (criptografia de senhas de usuários).
- **`vitest`**: `^5.0.0` (framework de testes automatizados).
- **`lucide-react`**: `^1.43.0` (ícones de interface).

### 1.6. Ambientes Suportados

1. **Produção**:
   - Detectado quando a chave de API inicia com `$aact_prod_` ou `NODE_ENV === "production"`.
   - URL Base: `https://api.asaas.com/v3`.
   - Exige obrigatoriamente validação do header `asaas-access-token` correspondente ao secret cadastrado.
2. **Sandbox / Homologação**:
   - Detectado quando a chave de API inicia com `$aact_hmlg_` ou `ASAAS_BASE_URL` contém "sandbox".
   - URL Base: `https://api-sandbox.asaas.com/v3`.
   - Faturas públicas utilizam o domínio `https://sandbox.asaas.com/i/{id}`.
   - Gera CPFs válidos automaticamente quando ausentes no perfil para viabilizar testes.
3. **Desenvolvimento / Offline Mock**:
   - Ativado caso as chaves contenham `mock_` ou estejam vazias em `NODE_ENV === "development"`.
   - Utiliza um store em memória (`devStore`) em `lib/asaas/client.ts`.
   - Permite forçar a liquidação de pagamentos via `POST /api/checkout/status` com o parâmetro `{ simulatePaid: true }`.

### 1.7. Recursos do Asaas Utilizados vs. Não Implementados

```
+-------------------------------------------------------+---------------------------------------------------------+
|                  RECURSOS UTILIZADOS                  |                RECURSOS NÃO IMPLEMENTADOS               |
+-------------------------------------------------------+---------------------------------------------------------+
| • Gestão de Clientes (/v3/customers)                  | • Split de Pagamentos entre múltiplas contas            |
| • Assinaturas Recorrentes (/v3/subscriptions)         | • Antecipação de Recebíveis                             |
| • Cobranças vinculadas (/subscriptions/{id}/payments) | • Emissão de Nota Fiscal de Serviço (NFSe Asaas)       |
| • PIX QR Code Dinâmico (/payments/{id}/pixQrCode)     | • Gateway de Cartão com Tokenização / 3D Secure         |
| • Consulta de Cobrança (/v3/payments/{id})            | • Régua de Comunicação por SMS/WhatsApp nativa Asaas    |
| • Webhooks de Cobranças e Assinaturas (v3)            | • Pagamento em Lote / Transferências TED via Asaas      |
| • URL Pública de Fatura Asaas (/i/{paymentId})        | • Cobrança com Juros / Multa por atraso                 |
+-------------------------------------------------------+---------------------------------------------------------+
```

### 1.8. Coexistência com Gateway Legado (Abacate Pay)

O repositório revela que o sistema utilizava originalmente o gateway **Abacate Pay** (`lib/abacate/client.ts`, `/api/webhooks/abacate`). A integração com o Asaas foi implementada para substituí-lo como gateway principal.
Para garantir retrocompatibilidade:

- A tabela `users` preserva as colunas `abacate_customer_id` e `abacate_subscription_id` em coexistência com `asaas_customer_id` e `asaas_subscription_id`.
- A tabela `pagamentos` armazena `asaas_payment_id` e `asaas_subscription_id`, mantendo `abacate_transaction_id` como coluna de legado.
- O endpoint `/api/webhooks/abacate/route.ts` continua ativo recebendo notificações de eventuais assinaturas legadas, enquanto `/api/webhooks/asaas/route.ts` processa toda a esteira moderna do Asaas.

---

## 2. VARIÁVEIS DE AMBIENTE E CONFIGURAÇÕES

### 2.1. Inventário Detalhado das Variáveis de Ambiente

Todas as variáveis foram auditadas nos arquivos `.env.production.example`, `.env.local`, `lib/asaas/client.ts`, `app/api/checkout/route.ts` e scripts de teste:

| Variável                   | Finalidade                                           | Obrigatória?      | Formato / Padrão                                  | Onde é Consumida          |
| -------------------------- | ---------------------------------------------------- | ----------------- | ------------------------------------------------- | ------------------------- |
| `ASAAS_API_KEY`            | Chave de acesso principal à API v3 do Asaas          | Sim               | String (ex: `$aact_prod_...` ou `$aact_hmlg_...`) | `lib/asaas/client.ts:12`  |
| `ASAAS_API_KEY_PRODUCAO`   | Chave prioritária para ambiente de produção          | Opcional          | String iniciando com `$aact_prod_`                | `lib/asaas/client.ts:11`  |
| `ASAAS_API_KEY_SANDBOX`    | Chave de homologação de fallback                     | Opcional          | String iniciando com `$aact_hmlg_`                | `lib/asaas/client.ts:13`  |
| `ASAAS_SECRET_KEY`         | Alias de chave Asaas                                 | Opcional          | String                                            | `lib/asaas/client.ts:14`  |
| `ASAAS_BASE_URL`           | URL base explícita da API v3 do Asaas                | Opcional          | URL (ex: `https://api.asaas.com/v3`)              | `lib/asaas/client.ts:30`  |
| `ASAAS_BASE_URL_PRODUCAO`  | URL base prioritária de produção                     | Opcional          | `https://api.asaas.com/v3`                        | `lib/asaas/client.ts:29`  |
| `ASAAS_BASE_URL_SANDBOX`   | URL base prioritária de homologação                  | Opcional          | `https://api-sandbox.asaas.com/v3`                | `lib/asaas/client.ts:38`  |
| `ASAAS_WEBHOOK_SECRET`     | Token de validação de autenticidade dos webhooks     | Sim (em Produção) | String (gerada no painel Asaas)                   | `lib/asaas/client.ts:505` |
| `ASAAS_ACCESS_TOKEN`       | Alias para validação de token do webhook             | Opcional          | String                                            | `lib/asaas/client.ts:506` |
| `DATABASE_URL`             | String de conexão PostgreSQL (com pool de conexões)  | Sim               | URL: `postgres://user:pass@host:port/db`          | `lib/db/client.ts:13`     |
| `DATABASE_URL_NON_POOLING` | String de conexão direta (sem pool, para migrations) | Opcional          | URL: `postgres://user:pass@host:5432/db`          | `lib/db/client.ts:12`     |
| `DATABASE_POOL_SIZE`       | Tamanho máximo do pool de conexões do driver `pg`    | Opcional          | Inteiro (Padrão: `10`)                            | `lib/db/client.ts:27`     |
| `JWT_SECRET`               | Chave criptográfica para validação de tokens JWT     | Sim               | String de 64 bytes                                | `lib/auth/jwt.ts:6`       |
| `JWT_EXPIRY`               | Tempo de expiração dos tokens de autenticação        | Opcional          | String (Padrão: `"7d"`)                           | `lib/auth/jwt.ts:8`       |
| `NODE_ENV`                 | Identificador do ambiente de execução do Node.js     | Opcional          | `"production"` \| `"development"` \| `"test"`     | Múltiplos arquivos        |

### 2.2. Resolução Dinâmica de Credenciais e Ambientes

A função `getAsaasBaseUrl()` em `lib/asaas/client.ts` implementa uma lógica inteligente de autodetecção de ambiente baseada no prefixo da chave da API:

```typescript
export const getAsaasBaseUrl = (): string => {
  const apiKey = getAsaasApiKey();

  // 1. Chave de produção oficial Asaas
  if (apiKey.startsWith('$aact_prod_')) {
    return (
      process.env.ASAAS_BASE_URL_PRODUCAO ||
      process.env.ASAAS_BASE_URL ||
      'https://api.asaas.com/v3'
    ).replace(/\/+$/, '');
  }

  // 2. Chave de homologação / sandbox Asaas
  if (apiKey.startsWith('$aact_hmlg_')) {
    return (
      process.env.ASAAS_BASE_URL_SANDBOX ||
      process.env.ASAAS_BASE_URL ||
      'https://api-sandbox.asaas.com/v3'
    ).replace(/\/+$/, '');
  }

  // 3. Fallback explícito
  if (process.env.ASAAS_BASE_URL) {
    return process.env.ASAAS_BASE_URL.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://api.asaas.com/v3';
  }

  return 'https://api-sandbox.asaas.com/v3';
};
```

Além disso, a função `getAsaasApiKey()` remove aspas eventuais inseridas por editores de `.env`:
`return rawKey.replace(/^["']|["']$/g, "").trim();`.

### 2.3. Comportamento Diante de Ausência ou Invalidez

- **Sem `ASAAS_API_KEY` em modo desenvolvimento**: O sistema entra no modo `mock/devStore`. Gera IDs simulados (`cus_...`, `sub_...`), SVG de QR Code genérico e permite simulação de pagamento sem disparar requisições de rede.
- **Sem `ASAAS_API_KEY` em modo produção**: O cliente Axios falhará na chamada ao Asaas retornando HTTP 401/500, o que fará `/api/checkout` responder:
  `{ erro: "Erro ao gerar cobrança de assinatura via Asaas" }` com HTTP 500.
- **Sem `ASAAS_WEBHOOK_SECRET` em desenvolvimento**: A requisição de webhook é permitida para facilitar testes locais.
- **Sem `ASAAS_WEBHOOK_SECRET` ou token incorreto em produção**: O webhook retorna imediatamente HTTP 401 com `{ erro: "Token de webhook do Asaas inválido" }`.

### 2.4. Arquivo `.env.example` Sanitizado

```env
# ==============================================================================
# CONFIGURAÇÃO DE INTEGRAÇÃO ASAAS - EXEMPLO SEGURO
# ==============================================================================

NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://seu-dominio.com

# BANCO DE DADOS POSTGRESQL (SUPABASE / AWS)
DATABASE_URL=postgres://usuario:senha@host-pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_URL_NON_POOLING=postgres://usuario:senha@host-direto.supabase.com:5432/postgres?sslmode=require
DATABASE_POOL_SIZE=10

# AUTENTICAÇÃO JWT
JWT_SECRET=insira_uma_chave_secreta_jwt_longa_e_aleatoria_com_mais_de_64_caracteres
JWT_EXPIRY=7d

# CREDENCIAIS DO GATEWAY ASAAS
# Para produção: chave iniciando com $aact_prod_
# Para homologação/sandbox: chave iniciando com $aact_hmlg_
ASAAS_API_KEY=$aact_prod_0000000000000000000000000000000000000000000000000000000000000000
ASAAS_BASE_URL=https://api.asaas.com/v3

# TOKEN SECRETO DO WEBHOOK (Configurado no painel Asaas: Menu Integrações -> Webhooks)
ASAAS_WEBHOOK_SECRET=token_secreto_configurado_no_painel_do_asaas_para_validar_webhook
```

---

## 3. COMUNICAÇÃO COM A API DO ASAAS

### 3.1. Cliente HTTP e Instanciação Centralizada

A comunicação externa é centralizada na função `getAsaasClient()` em `lib/asaas/client.ts`. Ela encapsula a criação de instâncias do `axios` com timeout de 15 segundos:

```typescript
export const getAsaasClient = (): AxiosInstance => {
  const apiKey = getAsaasApiKey();
  const baseURL = getAsaasBaseUrl();

  return axios.create({
    baseURL,
    headers: {
      access_token: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'vira-propo-ai/1.0.0',
      accept: 'application/json',
    },
    timeout: 15000,
  });
};
```

### 3.2. Autenticação e Cabeçalhos Padrão

O Asaas utiliza autenticação via cabeçalho customizado (não utiliza o padrão `Bearer`).

- **Cabeçalho de autenticação**: `access_token: <sua_chave_de_api>`
- **Content-Type**: `application/json`
- **Accept**: `application/json`
- **User-Agent**: `vira-propo-ai/1.0.0`

### 3.3. Mapeamento dos Endpoints Utilizados

| Método HTTP | Endpoint Asaas v3                 | Função Local                     | Finalidade                                   |
| ----------- | --------------------------------- | -------------------------------- | -------------------------------------------- |
| `GET`       | `/v3/customers/{id}`              | `criarOuBuscarClienteAsaas`      | Valida se o cliente já existe no Asaas       |
| `GET`       | `/v3/customers?cpfCnpj=...`       | `criarOuBuscarClienteAsaas`      | Busca cliente por documento                  |
| `GET`       | `/v3/customers?email=...`         | `criarOuBuscarClienteAsaas`      | Busca cliente por e-mail                     |
| `POST`      | `/v3/customers`                   | `criarOuBuscarClienteAsaas`      | Cadastra novo cliente no Asaas               |
| `PUT`       | `/v3/customers/{id}`              | `criarOuBuscarClienteAsaas`      | Atualiza CPF/CNPJ de cliente existente       |
| `POST`      | `/v3/subscriptions`               | `criarAssinaturaAsaas`           | Cria contrato de assinatura recorrente       |
| `GET`       | `/v3/subscriptions/{id}/payments` | `obterPagamentosAssinaturaAsaas` | Lista cobranças geradas pela assinatura      |
| `GET`       | `/v3/payments/{id}/pixQrCode`     | `obterPixQrCodeAsaas`            | Extrai imagem Base64 e Copia e Cola do PIX   |
| `GET`       | `/v3/payments/{id}`               | `obterStatusCobrancaAsaas`       | Consulta o status de uma cobrança específica |

---

### 3.4. Contratos Técnicos de Comunicação com a API Asaas

#### 3.4.1. Endpoint de Clientes: Criação (`POST /v3/customers`)

- **Request Body Enviado**:

```json
{
  "name": "João da Silva",
  "email": "joao@empresa.com.br",
  "cpfCnpj": "24971563792",
  "phone": "11987654321",
  "mobilePhone": "11987654321",
  "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8",
  "notificationDisabled": true
}
```

_Nota: `notificationDisabled: true` é enviado propositalmente para que o Asaas não envie e-mails automáticos ao cliente final, mantendo o controle total da comunicação dentro da plataforma._

- **Response Utilizada pelo Sistema**:

```json
{
  "object": "customer",
  "id": "cus_000005938210",
  "name": "João da Silva",
  "email": "joao@empresa.com.br",
  "cpfCnpj": "24971563792",
  "phone": "11987654321",
  "mobilePhone": "11987654321",
  "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8",
  "notificationDisabled": true
}
```

#### 3.4.2. Endpoint de Assinaturas: Criação (`POST /v3/subscriptions`)

- **Request Body Enviado (Ciclo Mensal)**:

```json
{
  "customer": "cus_000005938210",
  "billingType": "PIX",
  "cycle": "MONTHLY",
  "value": 45.9,
  "nextDueDate": "2026-10-18",
  "description": "Assinatura ViraPropo AI! Pro (Mensal)",
  "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8",
  "maxPayments": 24
}
```

- **Request Body Enviado (Ciclo Anual)**:

```json
{
  "customer": "cus_000005938210",
  "billingType": "PIX",
  "cycle": "YEARLY",
  "value": 397.0,
  "nextDueDate": "2026-10-18",
  "description": "Assinatura ViraPropo AI! Pro (Anual - 28% OFF)",
  "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8",
  "maxPayments": 5
}
```

- **Response Utilizada pelo Sistema**:

```json
{
  "object": "subscription",
  "id": "sub_000000849201",
  "dateCreated": "2026-10-18",
  "customer": "cus_000005938210",
  "paymentLink": null,
  "value": 45.9,
  "nextDueDate": "2026-10-18",
  "cycle": "MONTHLY",
  "description": "Assinatura ViraPropo AI! Pro (Mensal)",
  "billingType": "PIX",
  "status": "ACTIVE",
  "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8"
}
```

#### 3.4.3. Listagem de Cobranças da Assinatura (`GET /v3/subscriptions/{id}/payments`)

Ao criar uma assinatura com `nextDueDate` para a data presente, o Asaas gera assincronamente a cobrança associada.

- **Response Utilizada pelo Sistema**:

```json
{
  "object": "list",
  "hasMore": false,
  "totalCount": 1,
  "limit": 10,
  "offset": 0,
  "data": [
    {
      "object": "payment",
      "id": "pay_093847291039",
      "dateCreated": "2026-10-18",
      "customer": "cus_000005938210",
      "subscription": "sub_000000849201",
      "value": 45.9,
      "netValue": 44.91,
      "originalValue": null,
      "interestValue": null,
      "description": "Assinatura ViraPropo AI! Pro (Mensal)",
      "billingType": "PIX",
      "status": "PENDING",
      "dueDate": "2026-10-18",
      "originalDueDate": "2026-10-18",
      "paymentDate": null,
      "clientPaymentDate": null,
      "invoiceUrl": "https://www.asaas.com/i/093847291039",
      "invoiceNumber": "09384729",
      "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8",
      "bankSlipUrl": null
    }
  ]
}
```

#### 3.4.4. Obtenção do QR Code PIX (`GET /v3/payments/{id}/pixQrCode`)

- **Response Utilizada pelo Sistema**:

```json
{
  "encodedImage": "iVBORw0KGgoAAAANSUhEUgAA...",
  "payload": "00020126580014BR.GOV.BCB.PIX0136d2b4e5f6-7890-abcd-ef12-093847291039520400005303986540545.905802BR5915VIRAPROPO AI PRO6009SAO PAULO62070503***6304",
  "expirationDate": "2026-10-19T23:59:59Z"
}
```

_Tratamento no código:_ Se `encodedImage` não contiver o prefixo data URI, o sistema o sanitiza via:
`rawEncoded.startsWith("data:") ? rawEncoded : 'data:image/png;base64,' + rawEncoded`.

#### 3.4.5. Consulta de Status de Cobrança (`GET /v3/payments/{id}`)

- **Response Utilizada pelo Sistema**:

```json
{
  "object": "payment",
  "id": "pay_093847291039",
  "customer": "cus_000005938210",
  "value": 45.9,
  "status": "CONFIRMED",
  "dueDate": "2026-10-18",
  "invoiceUrl": "https://www.asaas.com/i/093847291039",
  "bankSlipUrl": null
}
```

---

### 3.5. Tratamento de Erros, Retentativas e Backoff

1. **Extração Unificada de Erros**:
   A função `extrairErroAsaas(error)` em `lib/asaas/client.ts` extrai a lista estruturada de erros retornada pelo Asaas:
   ```typescript
   function extrairErroAsaas(error: any): string {
     if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
       return error.response.data.errors.map((e: any) => e.description || e.message).join('; ');
     }
     if (error.response?.data?.message) {
       return error.response.data.message;
     }
     return error.message || 'Erro desconhecido na API do Asaas';
   }
   ```
2. **Backoff Progressivo na Captura de Cobrança**:
   Como a cobrança inicial de uma assinatura criada via `POST /subscriptions` pode levar alguns milissegundos para ser persistida e disponibilizada nas réplicas do Asaas, `app/api/checkout/route.ts` implementa uma esteira com 5 tentativas com delays incrementais:
   ```typescript
   if ((!payments || payments.length === 0) && subscription.id.startsWith('sub_')) {
     const delays = [500, 1000, 1500, 2000, 2500];
     for (const delay of delays) {
       await new Promise((res) => setTimeout(res, delay));
       payments = await obterPagamentosAssinaturaAsaas(subscription.id);
       if (payments && payments.length > 0) break;
     }
   }
   ```
   Caso nenhuma cobrança seja retornada após 7,5 segundos de tentativas acumuladas, o sistema adota `paymentId = subscription.id` como identificador de contingência.

### 3.6. Modo de Desenvolvimento e Simulação Offline (`devStore`)

Em ambiente sem internet ou com chaves mock, a função `simularPagamentoDevAsaas(paymentId)` grava no Map em memória:
`devStore.set(paymentId, { status: "CONFIRMED", invoiceUrl: ..., updatedAt: new Date() })`.
Quando `/api/checkout/status` consulta o pagamento, o status `CONFIRMED` é lido do `devStore`, promovendo a conta de teste local para `pro`.

---

## 4. GESTÃO DE CLIENTES E PAGADORES

### 4.1. Estratégia de Identificação e Resolução de Clientes

A função `criarOuBuscarClienteAsaas` em `lib/asaas/client.ts` adota uma política de 3 etapas para evitar duplicidade de cadastros no Asaas:

1. **Verificação de `existingCustomerId`**: Se o usuário local já possui um `asaas_customer_id` salvo (iniciando com `cus_`), o sistema tenta buscá-lo via `GET /customers/{id}`. Se encontrado e o cliente estiver sem CPF/CNPJ no Asaas, envia um `PUT` atualizando o documento.
2. **Busca por Documento ou E-mail**: Se o cliente não tinha ID local, pesquisa via `GET /customers?cpfCnpj=...`. Se não encontrar, tenta via `GET /customers?email=...`.
3. **Criação de Novo Cliente**: Se todas as buscas retornarem lista vazia, executa `POST /customers` vinculando `externalReference: usuario.id`.

### 4.2. Algoritmo de Validação e Fallback de CPF

No Brasil, o Asaas exige estritamente um CPF (11 dígitos) ou CNPJ (14 dígitos) válido para gerar cobranças PIX registradas no Banco Central.
Para que a experiência do usuário não seja interrompida caso ele ainda não tenha preenchido o CNPJ da empresa nas configurações, o sistema sanitiza o documento:

```typescript
const rawCpfCnpj = (payload.cpfCnpj || '').replace(/\D/g, '');
let cleanCpfCnpj = rawCpfCnpj;
if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
  cleanCpfCnpj = gerarCpfValidoFallback();
}
```

O algoritmo `gerarCpfValidoFallback()` gera matematicamente os dois dígitos verificadores válidos segundo o módulo 11 da Receita Federal:

```typescript
export function gerarCpfValidoFallback(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  let d1 = n.reduce((total, num, idx) => total + num * (10 - idx), 0) % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  let d2 = [...n, d1].reduce((total, num, idx) => total + num * (11 - idx), 0) % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  return `${n.join('')}${d1}${d2}`;
}
```

### 4.3. Associação com o Usuário Local

Quando o ID do cliente é retornado pelo Asaas, a rota de checkout atualiza imediatamente a coluna `asaas_customer_id` na tabela `users` do PostgreSQL:

```typescript
if (usuario.asaas_customer_id !== asaasCustomerId) {
  await atualizarUserAsaasCustomerId(usuario.id, asaasCustomerId);
}
```

---

## 5. COBRANÇAS, ASSINATURAS E CICLO FINANCEIRO

### 5.1. Modalidade Implementada: Assinatura Recorrente via PIX

O sistema não cria cobranças avulsas desconectadas para os planos. Toda assinatura no checkout é registrada como um contrato recorrente no Asaas (`POST /v3/subscriptions`) com `billingType: "PIX"`.

- A cada novo vencimento de ciclo, o Asaas gera automaticamente uma nova cobrança PIX vinculada à mesma `subscription.id`.
- Ao liquidar o PIX, o webhook do Asaas dispara a notificação de confirmação, renovando a data de expiração no banco local.

### 5.2. Ciclos de Cobrança e Preços

O sistema suporta dois ciclos de cobrança:

1. **Plano Mensal**:
   - Preço: **R$ 45,90** (`45.9`)
   - Ciclo Asaas: `"MONTHLY"`
   - Limite de cobranças (`maxPayments`): 24 meses
   - Próxima renovação: `CURRENT_TIMESTAMP + INTERVAL '30 days'`
2. **Plano Anual**:
   - Preço: **R$ 397,00** (`397.0`) — equivalente a R$ 33,08/mês (economia de R$ 153,80/ano)
   - Ciclo Asaas: `"YEARLY"`
   - Limite de cobranças (`maxPayments`): 5 anos
   - Próxima renovação: `CURRENT_TIMESTAMP + INTERVAL '365 days'`

### 5.3. Máquina de Estados de Pagamentos

```
          ┌────────────────────────────────────────────────────────┐
          │                    INÍCIO DO CHECKOUT                  │
          └───────────────────────────┬────────────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Status Inicial: PENDING    │
                      │  (Registro local: 'pendente') │
                      └───────────────┬───────────────┘
                                      │
             ┌────────────────────────┼────────────────────────┐
             │ Pagamento Liquidado    │ Cancelamento/Expiração │ Estorno Solicitado
             ▼                        ▼                        ▼
┌─────────────────────────┐ ┌───────────────────┐ ┌────────────────────────┐
│  RECEIVED / CONFIRMED   │ │   OVERDUE /       │ │    PAYMENT_REFUNDED    │
│ (Registro local: 'pago')│ │ SUBSCRIPTION_DEL  │ │(Registro local:        │
│                         │ │(Registro local:   │ │ 'estornado')           │
│                         │ │ 'cancelado')      │ │                        │
└─────────────────────────┘ └───────────────────┘ └────────────────────────┘
```

### 5.4. Mapeamento de Status: Asaas vs. Sistema Local

| Status na API Asaas    | Status na Tabela `pagamentos` | Status na Tabela `users`       | Efeito Prático no Sistema                                 |
| ---------------------- | ----------------------------- | ------------------------------ | --------------------------------------------------------- |
| `PENDING`              | `pendente`                    | Inalterado (`free` ou mantido) | Aguardando liquidação do PIX.                             |
| `RECEIVED`             | `pago`                        | `pro`                          | Ativação imediata do Plano Pro e renovação do vencimento. |
| `CONFIRMED`            | `pago`                        | `pro`                          | Ativação imediata do Plano Pro e renovação do vencimento. |
| `RECEIVED_IN_CASH`     | `pago`                        | `pro`                          | Ativação imediata do Plano Pro.                           |
| `OVERDUE`              | `cancelado`                   | `free` (se não admin)          | Rebaixamento imediato do usuário para o plano Free.       |
| `REFUNDED`             | `estornado`                   | `free` (se não admin)          | Cancelamento da assinatura e rebaixamento para Free.      |
| `DELETED`              | `cancelado`                   | `free` (se não admin)          | Cancelamento de fatura e rebaixamento para Free.          |
| `CHARGEBACK_REQUESTED` | `cancelado`                   | `free` (se não admin)          | Disputa bancária: rebaixamento preventivo para Free.      |

### 5.5. Política de Vencimento, Renovação e Tolerância (Grace Period de 3 Dias)

Implementada em `validarAssinaturaUsuario(user)` em `lib/db/users.ts:85-292`:

1. **Administradores**: Imunidade absoluta. Possuem acesso Pro vitalício permanente (`statusAssinatura: "ativa"`).
2. **Concessão Manual Vitalícia** (`pro_tipo_concessao = 'manual_vitalicio'`): Imunidade permanente contra expiração.
3. **Assinante Regular em Dia** (`diasAtraso <= 0`): Assinatura ativa.
4. **Período de Tolerância (Dias de Atraso de 1 a 3)**:
   - `emPeriodoGraca: true`
   - `diasRestantesGraca: 4 - diasAtraso`
   - `statusAssinatura: "periodo_graca"`
   - O usuário **mantém todos os acessos Pro**, mas o layout do dashboard exibe uma barra de alerta âmbar no topo incentivando a regularização.
5. **Dia 4+ em Atraso sem Pagamento**:
   - Tolerância encerrada.
   - O sistema executa UPDATE no banco: `plano = 'free'`.
   - `statusAssinatura: "expirada_downgrade"`.
   - Limite de geração de propostas cai para 3/mês e ferramentas Pro são bloqueadas.

### 5.6. Política de Cancelamento Agendado

Se o usuário clica em "Cancelar assinatura do plano" nas configurações:

1. A rota `POST /api/auth/downgrade` com `{ acao: "agendar" }` marca `cancelamento_agendado = TRUE` em `users`.
2. O usuário **não perde o acesso Pro imediatamente**: seus recursos continuam 100% ativos até a data marcada em `data_proxima_cobranca`.
3. Ao expirar a competência contratada (`diasAtraso > 0` e `cancelamento_agendado = TRUE`), o sistema executa o rebaixamento automático para Free sem conceder os 3 dias de tolerância, pois o cancelamento foi intencional.
4. O usuário pode reativar a assinatura a qualquer instante antes do término do ciclo via `POST /api/auth/downgrade` com `{ acao: "reativar" }`, restaurando `cancelamento_agendado = FALSE`.

---

## 6. WEBHOOKS E OBSERVABILIDADE OPERACIONAL

### 6.1. Rota, Métodos e Autenticação do Webhook

- **URL Exata**: `POST /api/webhooks/asaas`
- **Diretiva Next.js**: `export const dynamic = "force-dynamic";`
- **Mecanismo de Autenticação**:
  O Asaas envia o token de autenticação cadastrado pelo desenvolvedor através do cabeçalho HTTP:
  `asaas-access-token` (também são verificados alternativamente `access_token` ou `X-Asaas-Token`).
  Adicionalmente, parâmetros de query string (`?token=...`, `?secret=...`, `?webhookSecret=...`) são suportados.
- **Validação Segura**:
  A função `validarWebhookTokenAsaas(receivedToken)` em `lib/asaas/client.ts` compara o valor recebido com `process.env.ASAAS_WEBHOOK_SECRET`. Se o token for inválido e o ambiente não for `development`, retorna HTTP 401.

### 6.2. Arquitetura de Idempotência e Deduplicação

Gateways de pagamento podem reenviar webhooks repetidos em caso de latência na resposta de rede.
O sistema implementa uma camada de proteção na tabela `webhook_eventos`:

1. Quando um webhook chega, verifica se `payload.id` já existe na tabela `webhook_eventos`:
   `SELECT id FROM webhook_eventos WHERE id = $1`.
2. Se já existir:
   - Grava um registro de auditoria com ID `${payload.id}_dup_${Date.now()}` e status `"duplicado"` / ação `"DUPLICATE_SKIPPED"`.
   - Responde **HTTP 200 OK** imediatamente com:
     `{ ok: true, duplicado: true, id: payload.id, evento: eventName }`.
   - Interrompe a execução, impedindo atualizações redundantes no banco de dados.

### 6.3. Algoritmo Multi-Chave de Resolução do Usuário

Para garantir resiliência caso o Asaas omita algum identificador em eventos específicos de assinatura, o webhook localiza o usuário através de três chaves hierárquicas em cascata:

```typescript
let targetUser: any = null;

// Chave 1: externalReference (ID UUID do usuário inserido na criação do cliente e assinatura)
if (externalReference) {
  targetUser = await obterUserPorId(externalReference);
}

// Chave 2: asaas_subscription_id
if (!targetUser && subscriptionId) {
  const res = await query(
    'SELECT id, email, nome, role, plano FROM users WHERE asaas_subscription_id = $1 AND deletado_em IS NULL',
    [subscriptionId]
  );
  if (res.rows[0]) targetUser = res.rows[0];
}

// Chave 3: asaas_customer_id
if (!targetUser && customerId) {
  const res = await query(
    'SELECT id, email, nome, role, plano FROM users WHERE asaas_customer_id = $1 AND deletado_em IS NULL',
    [customerId]
  );
  if (res.rows[0]) targetUser = res.rows[0];
}
```

---

### 6.4. Matriz Completa de Eventos Tratados e Ações Executadas

| Evento Asaas                             | Categoria        | Ação Interna Gravada (`acao`) | Efeitos no Banco de Dados Local                                                                             |
| ---------------------------------------- | ---------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `PAYMENT_RECEIVED`                       | Ativação         | `PLAN_ACTIVATED`              | `users.plano = 'pro'`, renova vencimento (+30 ou +365 dias), `pagamentos.status = 'pago'`, grava `pago_em`. |
| `PAYMENT_CONFIRMED`                      | Ativação         | `PLAN_ACTIVATED`              | Mesmos efeitos de `PAYMENT_RECEIVED`.                                                                       |
| `PAYMENT_RECEIVED_IN_CASH_UNDONE`        | Ativação         | `PLAN_ACTIVATED`              | Mesmos efeitos de ativação.                                                                                 |
| `PAYMENT_DUNNING_RECEIVED`               | Ativação         | `PLAN_ACTIVATED`              | Recuperação de cobrança: reativa plano Pro e estende competência.                                           |
| `payment.status == 'RECEIVED'`           | Ativação         | `PLAN_ACTIVATED`              | Ativação por status explícito dentro do objeto payment.                                                     |
| `PAYMENT_OVERDUE`                        | Cancelamento     | `DOWNGRADE_TO_FREE`           | `users.plano = 'free'`, limpa data de vencimento, `pagamentos.status = 'cancelado'`.                        |
| `PAYMENT_REFUNDED`                       | Estorno          | `DOWNGRADE_TO_FREE`           | `users.plano = 'free'`, `pagamentos.status = 'estornado'`.                                                  |
| `PAYMENT_DELETED`                        | Cancelamento     | `DOWNGRADE_TO_FREE`           | Fatura excluída no painel: `users.plano = 'free'`, `pagamentos.status = 'cancelado'`.                       |
| `PAYMENT_CHARGEBACK_REQUESTED`           | Disputa          | `DOWNGRADE_TO_FREE`           | Rebaixamento imediato preventivo para o plano Free.                                                         |
| `SUBSCRIPTION_CANCELED`                  | Cancelamento     | `DOWNGRADE_TO_FREE`           | Assinatura cancelada no Asaas: rebaixa imediatamente para Free.                                             |
| `SUBSCRIPTION_DELETED`                   | Cancelamento     | `DOWNGRADE_TO_FREE`           | Assinatura excluída no Asaas: rebaixa imediatamente para Free.                                              |
| _Qualquer evento sem usuário localizado_ | Falha de Vínculo | `UNMATCHED_USER`              | Não altera usuários; grava log de auditoria com status `"aviso"`.                                           |
| _Eventos em contas Admin_                | Cancelamento     | `ADMIN_DOWNGRADE_SKIPPED`     | Bloqueia o downgrade; administrador permanece Pro vitalício.                                                |
| _Eventos não mapeados_                   | Informativo      | `IGNORED`                     | Não executa ações de escrita em usuários ou pagamentos.                                                     |

---

### 6.5. Proteção de Usuários Administradores contra Downgrade

Em `app/api/webhooks/asaas/route.ts:192-210`:

```typescript
if (isCancellationEvent) {
  if (targetUserId) {
    if (targetUser?.role === 'admin') {
      executedAction = 'ADMIN_DOWNGRADE_SKIPPED';
      console.log(
        `🛡️ Usuário administrador ${targetUserId} protegido contra downgrade via evento Asaas [${eventName}].`
      );
    } else {
      await query(
        `UPDATE users 
         SET plano = 'free', 
             cancelamento_agendado = FALSE,
             data_proxima_cobranca = NULL,
             pro_tipo_concessao = NULL,
             atualizado_em = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [targetUserId]
      );
      executedAction = 'DOWNGRADE_TO_FREE';
    }
  }
}
```

### 6.6. Registro de Auditoria e Tabela de Observabilidade

Para cada webhook recebido, mesmo com falhas, uma entrada detalhada é gravada ou atualizada em `webhook_eventos` através da função `registrarEventoAuditoria`:

- `id`: ID do evento (ex: `evt_091823719283`)
- `evento`: Nome do evento Asaas (ex: `PAYMENT_RECEIVED`)
- `gateway`: `'asaas'`
- `status`: `'sucesso'` | `'aviso'` | `'erro'` | `'duplicado'`
- `acao`: Código de ação executada (ex: `PLAN_ACTIVATED`, `DOWNGRADE_TO_FREE`)
- `usuario_id`: UUID do usuário vinculado
- `duracao_ms`: Tempo de processamento em milissegundos
- `payload`: O objeto JSON completo recebido do Asaas
- `processado_em`: Timestamp com fuso do servidor

### 6.7. Exemplos Sanitizados de Payloads Reais do Asaas

#### Payload 1: `PAYMENT_RECEIVED` (Ativação e Renovação Pro)

```json
{
  "id": "evt_098123712893",
  "event": "PAYMENT_RECEIVED",
  "dateCreated": "2026-10-18 14:30:00",
  "payment": {
    "object": "payment",
    "id": "pay_982371928371",
    "customer": "cus_000005938210",
    "subscription": "sub_000000849201",
    "value": 45.9,
    "netValue": 44.91,
    "billingType": "PIX",
    "status": "RECEIVED",
    "dueDate": "2026-10-18",
    "paymentDate": "2026-10-18",
    "clientPaymentDate": "2026-10-18",
    "invoiceUrl": "https://www.asaas.com/i/982371928371",
    "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8"
  }
}
```

#### Payload 2: `SUBSCRIPTION_CANCELED` (Cancelamento e Downgrade)

```json
{
  "id": "evt_872635182930",
  "event": "SUBSCRIPTION_CANCELED",
  "dateCreated": "2026-10-18 16:00:00",
  "subscription": {
    "object": "subscription",
    "id": "sub_000000849201",
    "customer": "cus_000005938210",
    "value": 45.9,
    "cycle": "MONTHLY",
    "status": "INACTIVE",
    "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8"
  }
}
```

#### Payload 3: `PAYMENT_REFUNDED` (Estorno)

```json
{
  "id": "evt_736251829304",
  "event": "PAYMENT_REFUNDED",
  "dateCreated": "2026-10-18 18:00:00",
  "payment": {
    "object": "payment",
    "id": "pay_982371928371",
    "customer": "cus_000005938210",
    "subscription": "sub_000000849201",
    "value": 45.9,
    "status": "REFUNDED",
    "externalReference": "adf4cf5a-eca4-44b7-92f4-d69a376af7b8"
  }
}
```

---

## 7. BANCO DE DADOS E PERSISTÊNCIA

### 7.1. Modelo Lógico Textual de Relacionamentos

```
[users] 1 ────────── 0..* [pagamentos]
   │
   │ 1 (opcional)
   │
   ▼ 0..*
[webhook_eventos] (usuario_id REFERENCES users(id) ON DELETE SET NULL)
```

- A tabela `users` é o agregador central de identidade, plano e concessões.
- A tabela `pagamentos` registra cada cobrança gerada ou liquidada no gateway para fins de conciliação financeira e histórico.
- A tabela `webhook_eventos` atua como log imutável de observabilidade e trava de concorrência/idempotência.

### 7.2. Script DDL Completo das Tabelas Relacionadas

Extraído de `lib/db/schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  empresa_nome VARCHAR(255),
  empresa_cnpj VARCHAR(18),
  empresa_email VARCHAR(255),
  empresa_telefone VARCHAR(20),
  empresa_logo_url TEXT,
  tema VARCHAR(10) DEFAULT 'light',
  idioma VARCHAR(5) DEFAULT 'pt-BR',
  notificacoes_email BOOLEAN DEFAULT TRUE,
  plano VARCHAR(50) DEFAULT 'free',
  role VARCHAR(20) DEFAULT 'cliente',
  suspenso BOOLEAN DEFAULT FALSE,
  pro_tipo_concessao VARCHAR(50),
  ciclo_plano VARCHAR(20) DEFAULT 'mensal',
  propostas_mes_atual INT DEFAULT 0,
  data_assinatura TIMESTAMP,
  data_proxima_cobranca TIMESTAMP,
  data_ultima_verificacao_pagamento DATE,
  cancelamento_agendado BOOLEAN DEFAULT FALSE,
  asaas_customer_id VARCHAR(255),
  asaas_subscription_id VARCHAR(255),
  abacate_customer_id VARCHAR(255),
  abacate_subscription_id VARCHAR(255),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletado_em TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plano ON users(plano);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_suspenso ON users(suspenso);
CREATE INDEX IF NOT EXISTS idx_users_asaas_customer ON users(asaas_customer_id);

-- 2. TABELA DE HISTÓRICO DE PAGAMENTOS
CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asaas_payment_id VARCHAR(255),
  asaas_subscription_id VARCHAR(255),
  abacate_transaction_id VARCHAR(255),
  invoice_url TEXT,
  valor DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  tipo VARCHAR(50),
  data_vencimento TIMESTAMP,
  pago_em TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_usuario ON pagamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_payment ON pagamentos(asaas_payment_id);

-- 3. TABELA DE IDEMPOTÊNCIA E AUDITORIA DE WEBHOOKS
CREATE TABLE IF NOT EXISTS webhook_eventos (
  id VARCHAR(255) PRIMARY KEY,
  evento VARCHAR(100) NOT NULL,
  gateway VARCHAR(50) DEFAULT 'asaas',
  status VARCHAR(50) DEFAULT 'sucesso',
  acao VARCHAR(100),
  usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,
  duracao_ms INT,
  erro_mensagem TEXT,
  payload JSONB,
  processado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_eventos_processado_em ON webhook_eventos(processado_em DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_eventos_gateway ON webhook_eventos(gateway);
CREATE INDEX IF NOT EXISTS idx_webhook_eventos_status ON webhook_eventos(status);
CREATE INDEX IF NOT EXISTS idx_webhook_eventos_usuario ON webhook_eventos(usuario_id);
```

### 7.3. Dicionário de Dados dos Campos Relevantes

#### Tabela `users`

- `id` (UUID): Identificador primário do usuário. Usado como `externalReference` no Asaas.
- `plano` (VARCHAR(50)): `"free"` ou `"pro"`.
- `role` (VARCHAR(20)): `"cliente"` ou `"admin"`.
- `suspenso` (BOOLEAN): Trava administrativa de acesso.
- `pro_tipo_concessao` (VARCHAR(50)): Origem do plano Pro: `"manual_vitalicio"`, `"manual_temporario"`, `"asaas"`.
- `ciclo_plano` (VARCHAR(20)): `"mensal"` ou `"anual"`.
- `data_assinatura` (TIMESTAMP): Data e hora da primeira ativação do Pro.
- `data_proxima_cobranca` (TIMESTAMP): Data limite da competência contratada atual.
- `data_ultima_verificacao_pagamento` (DATE): Data da última verificação passiva (evita múltiplas consultas ao banco no mesmo dia).
- `cancelamento_agendado` (BOOLEAN): Se `true`, rebaixa para Free assim que `data_proxima_cobranca` expirar.
- `asaas_customer_id` (VARCHAR(255)): Identificador do cliente no Asaas (`cus_...`).
- `asaas_subscription_id` (VARCHAR(255)): Identificador do contrato de assinatura recorrente (`sub_...`).

#### Tabela `pagamentos`

- `id` (UUID): Identificador interno do registro.
- `usuario_id` (UUID): Chave estrangeira para `users.id`.
- `asaas_payment_id` (VARCHAR(255)): Identificador da cobrança no Asaas (`pay_...`).
- `asaas_subscription_id` (VARCHAR(255)): Identificador da assinatura associada (`sub_...`).
- `invoice_url` (TEXT): Link direto para a fatura pública web no Asaas.
- `valor` (DECIMAL(12, 2)): Valor monetário (ex: `45.90` ou `397.00`).
- `status` (VARCHAR(50)): `"pendente"`, `"pago"`, `"cancelado"`, `"estornado"`.
- `tipo` (VARCHAR(50)): `"assinatura_pro"` (mensal) ou `"assinatura_pro_anual"` (anual).
- `pago_em` (TIMESTAMP): Timestamp do momento da confirmação de pagamento.

#### Tabela `webhook_eventos`

- `id` (VARCHAR(255)): Identificador único do evento fornecido pelo Asaas (ex: `evt_...`). Chave primária que garante a **idempotência**.
- `evento` (VARCHAR(100)): Código do evento do Asaas (ex: `PAYMENT_RECEIVED`).
- `gateway` (VARCHAR(50)): `"asaas"` ou `"abacate"`.
- `status` (VARCHAR(50)): `"sucesso"`, `"aviso"`, `"erro"`, `"duplicado"`.
- `acao` (VARCHAR(100)): Ação executada (`PLAN_ACTIVATED`, `DOWNGRADE_TO_FREE`, `ADMIN_DOWNGRADE_SKIPPED`, `DUPLICATE_SKIPPED`, `UNMATCHED_USER`).
- `duracao_ms` (INT): Latência de processamento interno em milissegundos.
- `payload` (JSONB): Cópia integral do payload JSON enviado pelo webhook.

### 7.4. Mecanismo de Inicialização Sob Demanda (`Schema-on-Demand`)

Para garantir resiliência caso o banco de dados seja recriado ou conectado em instâncias limpas sem rodar migrações prévias, os arquivos `lib/db/users.ts` e `lib/db/webhooks.ts` invocam:

- `garantirColunaVerificacaoAssinatura()`: Executa blocos `DO $$ BEGIN ALTER TABLE users ADD COLUMN IF NOT EXISTS ... EXCEPTION WHEN OTHERS THEN NULL; END $$;`
- `garantirTabelaWebhookEventos()`: Executa `CREATE TABLE IF NOT EXISTS webhook_eventos ...` antes de consultar ou inserir eventos.

---

## 8. FLUXOS COMPLETOS DE PONTA A PONTA

### 8.1. Fluxo 1: Assinatura e Pagamento via PIX Transparente

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Usuário no Navegador
    participant Modal as UpgradeModal.tsx
    participant API as Route /api/checkout
    participant ClientAsaas as lib/asaas/client.ts
    participant Asaas as Asaas API (v3)
    participant DB as PostgreSQL
    participant Poll as Route /api/checkout/status

    Cliente->>Modal: Clica em "Pagar com PIX" (Mensal ou Anual)
    Modal->>API: POST /api/checkout { ciclo: "mensal" } com Bearer JWT
    API->>API: Verifica Rate Limit (10 req/min)
    API->>DB: Busca usuário por ID
    API->>ClientAsaas: criarOuBuscarClienteAsaas()
    ClientAsaas->>Asaas: GET /v3/customers ou POST /v3/customers
    Asaas-->>ClientAsaas: Retorna Customer ID (cus_...)
    API->>DB: UPDATE users SET asaas_customer_id = 'cus_...'
    API->>ClientAsaas: criarAssinaturaAsaas({ customer, billingType: "PIX", value: 45.9 })
    ClientAsaas->>Asaas: POST /v3/subscriptions
    Asaas-->>ClientAsaas: Retorna Subscription (sub_...)
    API->>ClientAsaas: obterPagamentosAssinaturaAsaas(sub_...) [com Retry Backoff]
    ClientAsaas->>Asaas: GET /v3/subscriptions/{subId}/payments
    Asaas-->>ClientAsaas: Retorna lista contendo paymentId (pay_...)
    API->>ClientAsaas: obterPixQrCodeAsaas(pay_...)
    ClientAsaas->>Asaas: GET /v3/payments/{payId}/pixQrCode
    Asaas-->>ClientAsaas: Retorna { encodedImage, payload }
    API->>DB: INSERT INTO pagamentos (status: 'pendente', asaas_payment_id: pay_...)
    API-->>Modal: Retorna { sucesso: true, chargeId, brCode, brCodeBase64, invoiceUrl }
    Modal->>Cliente: Exibe QR Code e Código Copia e Cola
    loop Polling a cada 3 segundos
        Modal->>Poll: GET /api/checkout/status?chargeId=pay_...
        Poll->>DB: Verifica se status já é 'pago' (via webhook)
        alt Já marcado como pago pelo webhook
            Poll-->>Modal: Retorna { status: "PAID", isPro: true }
        else Ainda pendente no DB
            Poll->>ClientAsaas: obterStatusCobrancaAsaas(pay_...)
            ClientAsaas->>Asaas: GET /v3/payments/{payId}
            Asaas-->>Poll: Retorna status da cobrança
            alt Asaas retornou RECEIVED ou CONFIRMED
                Poll->>DB: UPDATE users SET plano = 'pro', vencimento = +30 dias
                Poll->>DB: UPDATE pagamentos SET status = 'pago'
                Poll-->>Modal: Retorna { status: "PAID", isPro: true }
            else Status PENDING
                Poll-->>Modal: Retorna { status: "PENDING", isPro: false }
            end
        end
    end
    Modal->>Cliente: Transiciona para tela de SUCESSO e ativa recursos PRO
```

### 8.2. Fluxo 2: Processamento do Webhook de Ativação / Renovação

```mermaid
sequenceDiagram
    autonumber
    participant Asaas as Gateway Asaas
    participant Route as POST /api/webhooks/asaas
    participant DB as PostgreSQL

    Asaas->>Route: POST /api/webhooks/asaas com Header asaas-access-token
    Route->>Route: Valida token contra ASAAS_WEBHOOK_SECRET
    alt Token Inválido
        Route-->>Asaas: Retorna 401 Unauthorized
    end
    Route->>DB: verificarEventoProcessado(payload.id)
    alt Evento já processado (Duplicado)
        Route->>DB: Grava auditoria (status: 'duplicado', acao: 'DUPLICATE_SKIPPED')
        Route-->>Asaas: Retorna 200 OK { duplicado: true }
    end
    Route->>Route: Resolução do Usuário (externalReference -> subscriptionId -> customerId)
    Route->>Route: Identifica evento (ex: PAYMENT_RECEIVED)
    Route->>DB: UPDATE users SET plano = 'pro', vencimento = +30d (ou +365d), cancelamento_agendado = FALSE
    Route->>DB: UPDATE pagamentos SET status = 'pago', pago_em = CURRENT_TIMESTAMP
    Route->>DB: registrarEventoAuditoria(status: 'sucesso', acao: 'PLAN_ACTIVATED')
    Route-->>Asaas: Retorna 200 OK { ok: true, acao: 'PLAN_ACTIVATED' }
```

### 8.3. Fluxo 3: Processamento do Webhook de Inadimplência / Cancelamento

```mermaid
sequenceDiagram
    autonumber
    participant Asaas as Gateway Asaas
    participant Route as POST /api/webhooks/asaas
    participant DB as PostgreSQL

    Asaas->>Route: POST /api/webhooks/asaas (ex: SUBSCRIPTION_CANCELED ou PAYMENT_OVERDUE)
    Route->>Route: Valida Token e Idempotência
    Route->>Route: Localiza Usuário Alvo
    alt Usuário tem role == 'admin'
        Route->>DB: registrarEventoAuditoria(acao: 'ADMIN_DOWNGRADE_SKIPPED')
        Route-->>Asaas: Retorna 200 OK (Administrador protegido contra downgrade)
    else Usuário Cliente Comum
        Route->>DB: UPDATE users SET plano = 'free', data_proxima_cobranca = NULL
        Route->>DB: UPDATE pagamentos SET status = 'cancelado' (ou 'estornado')
        Route->>DB: registrarEventoAuditoria(status: 'sucesso', acao: 'DOWNGRADE_TO_FREE')
        Route-->>Asaas: Retorna 200 OK { ok: true, acao: 'DOWNGRADE_TO_FREE' }
    end
```

### 8.4. Fluxo 4: Verificação Passiva de Assinatura no Carregamento (`/api/auth/me`)

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Usuário Logado
    participant App as useAuthStore (fetchMe)
    participant Route as GET /api/auth/me
    participant Valid as validarAssinaturaUsuario()
    participant DB as PostgreSQL

    Cliente->>App: Abre o sistema no navegador
    App->>Route: GET /api/auth/me com Bearer JWT
    Route->>DB: SELECT * FROM users WHERE id = $userId
    Route->>Valid: Executa validação de assinatura
    alt Role == 'admin' ou Concessão Vitalícia
        Valid-->>Route: Status 'ativa', Pro mantido
    else Plano == 'free'
        Valid-->>Route: Status 'free'
    else Plano == 'pro' e vencimento não alcançado
        Valid-->>Route: Status 'ativa'
    else Plano == 'pro' e vencimento expirado com cancelamento_agendado == TRUE
        Valid->>DB: UPDATE users SET plano = 'free', cancelamento_agendado = FALSE
        Valid-->>Route: Status 'expirada_downgrade', plano alterado para Free
    else Plano == 'pro' e dias de atraso entre 1 e 3 (Grace Period)
        Valid-->>Route: Status 'periodo_graca', emPeriodoGraca = true, diasRestantesGraca = (4 - diasAtraso)
    else Plano == 'pro' e dias de atraso >= 4 (Grace Period Esgotado)
        Valid->>DB: UPDATE users SET plano = 'free'
        Valid-->>Route: Status 'expirada_downgrade', plano alterado para Free
    end
    Route-->>App: Retorna { usuario, emPeriodoGraca, diasRestantesGraca, statusAssinatura }
    App->>Cliente: Se periodo de graça, exibe alerta âmbar; se downgrade, bloqueia ferramentas Pro
```

---

## 9. ROTAS INTERNAS DA APLICAÇÃO E CONTRATOS LOCAIS

### 9.1. `POST /api/checkout`

- **Autenticação**: Bearer Token JWT obrigatório (`Authorization: Bearer <token>`).
- **Rate Limit**: 10 requisições por minuto por `userId`.
- **Request Body (JSON)**:
  ```json
  {
    "ciclo": "mensal" // Aceita: "mensal" | "anual" | "YEARLY"
  }
  ```
- **Response de Sucesso (HTTP 200)**:
  ```json
  {
    "sucesso": true,
    "chargeId": "pay_982371928371",
    "subscriptionId": "sub_000000849201",
    "ciclo": "mensal",
    "amount": 45.9,
    "amountCents": 4590,
    "brCode": "00020126580014BR.GOV.BCB.PIX0136...",
    "brCodeBase64": "data:image/png;base64,iVBORw0KGgoAAA...",
    "invoiceUrl": "https://www.asaas.com/i/982371928371",
    "expiresAt": "2026-10-19T23:59:59Z",
    "status": "PENDING",
    "devMode": false
  }
  ```
- **Responses de Erro**:
  - `401`: `{ "erro": "Não autenticado" }` ou `{ "erro": "Token inválido" }`
  - `404`: `{ "erro": "Usuário não encontrado" }`
  - `429`: `{ "sucesso": false, "erro": "Muitas requisições de checkout...", "retryAfter": 60 }`
  - `500`: `{ "erro": "Mensagem detalhada do Asaas ou erro de servidor" }`

### 9.2. `GET /api/checkout/status`

- **Autenticação**: Bearer Token JWT obrigatório.
- **Query Params**: `?chargeId=<paymentId>`
- **Response quando Confirmado (HTTP 200)**:
  ```json
  {
    "status": "PAID",
    "isPro": true,
    "plano": "pro",
    "invoiceUrl": "https://www.asaas.com/i/982371928371"
  }
  ```
- **Response quando Pendente (HTTP 200)**:
  ```json
  {
    "status": "PENDING",
    "isPro": false,
    "plano": "free",
    "invoiceUrl": "https://www.asaas.com/i/982371928371"
  }
  ```

### 9.3. `POST /api/checkout/status` (Simulação Sandbox)

- **Autenticação**: Bearer Token JWT obrigatório.
- **Request Body (JSON)**:
  ```json
  {
    "chargeId": "pay_982371928371",
    "simulatePaid": true
  }
  ```
- **Response (HTTP 200)**:
  ```json
  {
    "sucesso": true,
    "status": "PAID",
    "isPro": true,
    "plano": "pro",
    "mensagem": "Pagamento simulado e Plano Pro ativado com sucesso!"
  }
  ```

### 9.4. `POST /api/webhooks/asaas`

- **Autenticação**: Header `asaas-access-token` (ou query `?token=...`).
- **Response (HTTP 200)**:
  ```json
  {
    "ok": true,
    "recebido": true,
    "id": "evt_098123712893",
    "evento": "PAYMENT_RECEIVED",
    "acao": "PLAN_ACTIVATED",
    "duracaoMs": 35
  }
  ```

### 9.5. `POST /api/auth/downgrade`

- **Autenticação**: Bearer Token JWT obrigatório.
- **Request Body (JSON)**:
  ```json
  {
    "acao": "agendar" // ou "reativar"
  }
  ```
- **Response (HTTP 200)**:
  ```json
  {
    "sucesso": true,
    "mensagem": "Cancelamento da assinatura agendado com sucesso. Seus recursos Pro permanecerão ativos até o término do ciclo atual.",
    "cancelamentoAgendado": true,
    "dataFimAcesso": "2026-11-18T14:30:00.000Z"
  }
  ```

### 9.6. `GET /api/admin/webhooks`

- **Autenticação**: Bearer Token JWT com `role === 'admin'`.
- **Query Params**: `?gateway=asaas&status=sucesso&pagina=1&limite=20&evento=PAYMENT_RECEIVED`
- **Response (HTTP 200)**:
  Retorna lista paginada de eventos auditados, métricas de contagem, tempo de execução e dados do usuário vinculado.

---

## 10. SEGURANÇA E RESILIÊNCIA

### 10.1. Proteção de Credenciais

- Chaves de API nunca são expostas ao frontend. Nenhuma chamada direta ao domínio `asaas.com` é realizada a partir do navegador do cliente. Todas as requisições passam pelas Route Handlers do Next.js no servidor.
- O token `asaas-access-token` do webhook é comparado via string match contra a variável privada do servidor `ASAAS_WEBHOOK_SECRET`.

### 10.2. Rate Limiting de Operações Financeiras

Implementado via `checkRateLimit` com algoritmo de janela deslizante (Sliding Window):

- Checkout (`/api/checkout`): máximo de 10 tentativas por minuto por usuário autenticado.
- Em caso de abuso, o IP/usuário recebe HTTP 429 com cabeçalho padronizado `Retry-After: 60`.

### 10.3. Imunidade de Contas Administrativas

Para garantir que testes financeiros ou faturas de teste não rebaixem a conta do proprietário/administrador da plataforma, tanto a rota de webhook quanto a função de validação de assinatura (`validarAssinaturaUsuario`) verificam se `user.role === 'admin'`. Se positivo, o downgrade é abortado e registrado como `ADMIN_DOWNGRADE_SKIPPED`.

### 10.4. Resiliência a Conexões SSL em Servidores Remotos

O arquivo `lib/db/client.ts` detecta se a string de conexão aponta para hosts remotos (Supabase, AWS ou Railway) e ajusta a verificação de certificados para `rejectUnauthorized: false`, permitindo que conexões em ambientes serverless com certificados autoassinados da AWS/Supabase funcionem sem quebras de handshake.

---

## 11. MATRIZ DE ERROS E RECUPERAÇÃO

| Cenário de Falha                                   | Causa Raiz                                                           | Comportamento Atual do Código                                   | Impacto na Persistência                                                                       | Mecanismo de Recuperação / Reprodução                                               |
| -------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Usuário sem CPF/CNPJ no perfil**                 | O usuário não preencheu dados da empresa ao se cadastrar             | O Asaas rejeitaria com HTTP 400                                 | O código calcula CPF determinístico com dígito verificador e salva no Asaas                   | Reproduzir chamando `gerarCpfValidoFallback()`                                      |
| **Delay do Asaas ao gerar cobrança da assinatura** | O Asaas leva até 2s para gerar a cobrança da assinatura recém-criada | `obterPagamentosAssinaturaAsaas` retornaria array vazio         | O sistema executa 5 retentativas com backoff (500ms a 2500ms)                                 | Manter loop de espera antes de retornar o QR Code                                   |
| **Webhook duplicado reenviado pelo Asaas**         | Reenvio automático por timeout de rede ou retentativa programada     | Poderia duplicar logs ou disparar processamentos desnecessários | O banco bloqueia via chave primária em `webhook_eventos` e responde 200 OK                    | A nova implementação DEVE manter a chave primária no ID do evento do Asaas          |
| **Webhook recebido para usuário não encontrado**   | Cobrança criada fora do sistema ou ID de usuário inconsistente       | Não seria possível saber quem promover                          | Grava auditoria com `status: 'aviso'` e `acao: 'UNMATCHED_USER'`, respondendo 200 OK ao Asaas | Responder 200 OK para evitar retentativas infinitas do Asaas e auditar em log       |
| **Queda do banco de dados durante o webhook**      | Falha transiente de conexão PostgreSQL                               | Webhook captura no bloco `catch`                                | Tenta gravar log de erro e responde HTTP 500                                                  | O Asaas fará novas tentativas programadas com backoff conforme sua política oficial |
| **Falha de rede no polling do frontend**           | Perda de conexão no celular do cliente                               | O polling captura o erro e loga no console                      | Nenhuma perda de consistência, pois o Webhook no backend confirmará o pagamento               | O webhook garante a confirmação assíncrona independente do frontend                 |

---

## 12. TESTES, SIMULAÇÕES E VALIDAÇÃO

### 12.1. Estrutura de Testes Automatizados (Vitest)

O projeto possui uma cobertura integral de testes unitários e de integração:

- **`__tests__/lib/asaas.test.ts`**: Valida parsing de chaves, seleção de URL base, instanciação do Axios, validação de tokens e chamadas mockadas.
- **`__tests__/api/asaas-checkout.test.ts`**: Valida fluxos de `/api/checkout`, `/api/checkout/status` GET e POST.
- **`__tests__/api/asaas-webhook.test.ts`**: Valida a esteira de webhooks, resolução multi-chave, idempotência, downgrades, imunidade de admin e audit logging.
- **`__tests__/components/modals.test.tsx`**: Valida o componente visual `UpgradeModal`, cópia de código PIX, polling e transição para a tela de sucesso.

**Comando para Execução dos Testes**:

```bash
npm run test
```

_Todos os 28 arquivos de teste e 288 testes da aplicação foram validados e passam com código 0._

### 12.2. Scripts Utilitários de Diagnóstico e Homologação

Localizados na pasta `scripts/`:

- `scripts/test-asaas.js`: Cria cliente e assinatura no sandbox Asaas via Node.js e imprime o payload do QR Code.
- `scripts/test-real-asaas.js`: Executa testes com dados de cliente real em sandbox.
- `scripts/test-e2e-checkout.js`: Simula o fluxo ponta a ponta: busca usuário no PostgreSQL, gera JWT, cria assinatura e valida se a fatura é acessível.
- `scripts/test-full-checkout-simulation.js`: Teste integrado de ciclo completo com banco remoto.

### 12.3. Guia Passo a Passo de Homologação em Sandbox

1. Cadastre uma conta de testes em: [https://sandbox.asaas.com](https://sandbox.asaas.com).
2. Obtenha uma chave de API de homologação iniciando com `$aact_hmlg_` em **Configurações da Conta -> Integrações**.
3. Configure as variáveis no seu `.env.local`:
   ```env
   ASAAS_API_KEY=$aact_hmlg_SUA_CHAVE_AQUI
   ASAAS_WEBHOOK_SECRET=token_de_teste_definido_no_asaas
   ```
4. Inicie o servidor local: `npm run dev`.
5. Abra o navegador, faça login e clique no botão de Upgrade na barra lateral ou em Configurações.
6. Clique em "Pagar com PIX".
7. Copie o `chargeId` retornado.
8. Para simular a liquidação imediata no sandbox do Asaas, você pode:
   - Acessar o painel do Sandbox Asaas e clicar no botão "Confirmar Recebimento" na cobrança; OU
   - Disparar uma chamada local:
     ```bash
     curl -X POST http://localhost:3000/api/checkout/status \
       -H "Authorization: Bearer SEU_JWT_AQUI" \
       -H "Content-Type: application/json" \
       -d '{"chargeId": "pay_ID_DA_COBRANCA", "simulatePaid": true}'
     ```
9. Observe o polling na tela do modal transicionar automaticamente para a tela verde de sucesso: "Parabéns! Sua assinatura está ativa".

---

## 13. DEPENDÊNCIAS OPERACIONAIS E CONFIGURAÇÃO NO PAINEL ASAAS

Para reproduzir esta integração em qualquer outro sistema, as seguintes etapas devem ser configuradas no painel do Asaas:

1. **Geração da API Key**:
   - Menu: **Configurações da Conta -> Integrações -> Chaves de API**.
   - Criar uma nova chave e copiar seu valor para a variável `ASAAS_API_KEY`.
2. **Configuração da URL de Webhook**:
   - Menu: **Configurações da Conta -> Integrações -> Webhooks**.
   - Selecionar tipo: **Cobranças e Assinaturas**.
   - URL do Webhook: `https://seu-dominio.com/api/webhooks/asaas`.
   - Versão da API: **v3**.
   - Token de Autenticação: Definir uma string alfanumérica segura e gravá-la em `ASAAS_WEBHOOK_SECRET`.
   - Eventos Habilitados:
     - `PAYMENT_RECEIVED`
     - `PAYMENT_CONFIRMED`
     - `PAYMENT_OVERDUE`
     - `PAYMENT_REFUNDED`
     - `PAYMENT_DELETED`
     - `PAYMENT_CHARGEBACK_REQUESTED`
     - `SUBSCRIPTION_CANCELED`
     - `SUBSCRIPTION_DELETED`
3. **Requisitos de Infraestrutura**:
   - A URL de Webhook precisa ser pública (HTTPS) com certificado SSL válido.
   - O endpoint do webhook deve responder em menos de 5 segundos com código HTTP 2xx para evitar que o Asaas enfileire reenvios por timeout.

---

## 14. DEPENDÊNCIAS DO DOMÍNIO ORIGINAL VS. NÚCLEO REUTILIZÁVEL

Ao transferir esta integração para outro projeto ou tecnologia (ex: NestJS, Go, Python/FastAPI, Laravel), atente-se à separação entre o domínio específico e o motor financeiro:

### O que pertence ao Domínio do ViraPropo AI! (Adaptar para seu projeto)

- Contadores de propostas (`propostas_mes_atual`, limite de 3/mês).
- Injeção de logotipo corporativo em propostas comerciais (`injetarOuAtualizarLogoHtml`).
- Nomes dos planos: `"free"` e `"pro"`.
- Gating de assinatura eletrônica e manifesto probatório SHA-256 de propostas.
- Preços específicos fixados em código (R$ 45,90 mensal / R$ 397,00 anual).

### O que pertence ao Núcleo Reutilizável do Asaas (Copiar integralmente)

- A lógica de inicialização do Axios com header `access_token` e resolução dinâmica de sandbox vs. produção.
- O algoritmo de fallback de CPF válido com módulo 11.
- A esteira de consulta em cascata de clientes (`ID -> CPF -> Email -> Criação`).
- O mecanismo de retentativas com backoff para aguardar a primeira cobrança da assinatura criada.
- A extração e formatação do QR Code PIX (Copia e Cola + Base64 PNG).
- A tabela `webhook_eventos` e o bloqueio de concorrência por `id` primário (idempotência).
- A resolução multi-chave do usuário (`externalReference` -> `subscriptionId` -> `customerId`).
- A esteira de Grace Period de 3 dias e cancelamento agendado até a data da próxima cobrança.

---

## 15. ÍNDICE REMISSIVO DE ARQUIVOS E CÓDIGO-FONTE

Abaixo estão os caminhos relativos exatos de todos os arquivos inspecionados:

1. `lib/asaas/client.ts`
   - **Responsabilidade**: Instanciação do cliente HTTP, métodos de comunicação com API Asaas, gerador de CPF fallback, validação de token e devStore.
2. `app/api/checkout/route.ts`
   - **Responsabilidade**: Rota de criação da assinatura e retorno do QR Code PIX.
3. `app/api/checkout/status/route.ts`
   - **Responsabilidade**: Rota de polling de confirmação e simulação sandbox.
4. `app/api/webhooks/asaas/route.ts`
   - **Responsabilidade**: Processamento assíncrono dos eventos oficiais do Asaas, idempotência, resoluções e downgrades.
5. `app/api/auth/downgrade/route.ts`
   - **Responsabilidade**: Gerenciamento de cancelamento agendado e reativação pelo usuário.
6. `app/api/auth/me/route.ts`
   - **Responsabilidade**: Verificação passiva diária de expiração da assinatura (`validarAssinaturaUsuario`).
7. `lib/db/users.ts`
   - **Responsabilidade**: Regras de negócio de usuários, motor de tolerância (Grace Period) e concessões manuais.
8. `lib/db/webhooks.ts`
   - **Responsabilidade**: DDL sob demanda, verificação de idempotência e auditoria de webhooks.
9. `lib/db/admin-dashboard.ts`
   - **Responsabilidade**: Cálculos agregados de MRR, faturamento diário/mensal e ticket médio.
10. `lib/db/schema.sql`
    - **Responsabilidade**: Definição canônica do banco de dados relacional PostgreSQL.
11. `components/Billing/UpgradeModal.tsx`
    - **Responsabilidade**: Componente frontend React do checkout transparente com PIX e cópia de chave.
12. `components/Admin/WebhookLogsTable.tsx` e `components/Admin/WebhookAuditModal.tsx`
    - **Responsabilidade**: Interface de observabilidade e auditoria de webhooks para administradores.
13. `__tests__/api/asaas-webhook.test.ts` e `__tests__/api/asaas-checkout.test.ts`
    - **Responsabilidade**: Suíte de testes automatizados com cobertura de cenários de sucesso, erro, idempotência e downgrade.

---

## 16. AUDITORIA FINAL DE COMPLETUDE E LACUNAS

### 16.1. Checklist de Verificação

- [x] Todas as variáveis de ambiente foram mapeadas e cruzadas com o código.
- [x] O fluxo de comunicação com o Asaas foi documentado endpoint por endpoint com exemplos de request/response sanitizados.
- [x] As modalidades financeiras (Assinatura Recorrente Mensal e Anual via PIX) foram completamente detalhadas.
- [x] O fluxo de Webhooks foi dissecado: segurança, idempotência, resolução multi-chave, eventos e persistência.
- [x] O DDL completo e o modelo lógico do banco de dados foram reproduzidos fielmente.
- [x] Todos os fluxos ponta a ponta foram modelados em diagramas Mermaid.
- [x] As políticas de tolerância (Grace Period de 3 dias) e cancelamento agendado foram comprovadas pelo código.
- [x] Todos os 288 testes automatizados do projeto foram executados e aprovados com sucesso.
- [x] Nenhuma credencial real ou dado sensível foi incluído na documentação.

### 16.2. Lacunas e Comportamentos Não Identificados no Código

1. **Cobrança Direta por Cartão de Crédito**:
   - _Status_: **NÃO IMPLEMENTADA NO FRONTEND / CHECKOUT ATUAL**.
   - _Explicação_: Embora as tipagens em `lib/asaas/client.ts` aceitem `"CREDIT_CARD"`, o código de `/api/checkout` força estritamente `billingType: "PIX"`. Não existem formulários de captura de dados de cartão de crédito no repositório.
2. **Disparo de E-mails Transacionais de Fatura**:
   - _Status_: **DESABILITADO INTENCIONALMENTE NO ASAAS**.
   - _Explicação_: Ao criar clientes no Asaas, o sistema envia `notificationDisabled: true`. Não foi identificado serviço de envio de e-mails de cobrança via SMTP interno em `app/api/checkout/route.ts` (apenas logs de auditoria local).
3. **Ambiente Multi-Tenant / Split de Pagamento**:
   - _Status_: **NÃO IMPLEMENTADO**.
   - _Explicação_: A aplicação opera como SaaS proprietário único, recebendo todos os valores em uma única conta master do Asaas, sem divisão de comissões (splits) ou subcontas.
