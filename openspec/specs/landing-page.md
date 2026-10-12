# Spec: Landing Page de Alta Conversão

> OpenSpec Specification: `landing-page`

## Problem Statement

Pequenas e médias equipes corporativas (10 a 80 colaboradores) que buscam uma alternativa profissional ao WhatsApp enfrentam falta de clareza institucional sobre ferramentas corporativas. Ao acessarem a raiz da aplicação, encontravam apenas os formulários técnicos de login/cadastro, sem contexto sobre privacidade radical, zero retenção no plano Free, enquetes, canais de transmissão e conformidade com a LGPD.

## Solution

Landing Page completa, orientada a Product-Led Growth (PLG) e de alta conversão, montada na rota pública `/` do aplicativo web. Apresenta o posicionamento anti-ruído corporativo, comparativo visual com o WhatsApp pessoal, showcase interativo de recursos, tabela de planos com alternador mensal/anual e CTA duplo focado no Trial de 14 dias do Plano Pro sem cartão de crédito. Usuários autenticados são redirecionados automaticamente para `/chat`.

## User Stories

1. As a prospective business customer, I want to see a clear Hero headline and app preview on the homepage, so that I understand what NextMsg is within seconds.
2. As an operations or HR manager, I want to see a visual comparison between personal WhatsApp and NextMsg, so that I can justify adopting an official corporate messenger.
3. As an IT administrator, I want to learn about the zero-retention Free plan and 5-day file lifecycle, so that I can verify data privacy commitments.
4. As a decision maker, I want to see trust badges ("14-day Pro trial", "No credit card required", "LGPD compliant"), so that I feel safe trying the platform immediately.
5. As an interested visitor, I want to click the primary CTA button, so that I can start a 14-day Pro trial with plan parameters pre-selected.
6. As a budget evaluator, I want an interactive pricing table with monthly/annual billing options, so that I can evaluate plan costs transparently.
7. As an authorized legal or compliance officer, I want an LGPD privacy section, so that I know statutory rights (Art. 18) are honored.
8. As a curious visitor, I want an interactive FAQ accordion, so that I can resolve common purchasing objections before registering.
9. As an authenticated user returning to the website, I want visits to `/` to redirect me to `/chat`, so that I can access my active conversations without friction.

## Implementation Decisions

- **Route Placement:** Mounted at `/` in `apps/web/src/routes`. The authenticated chat panel resides at `/chat`.
- **Automatic Navigation:** `LandingPage` inspects `accessToken` in `useAuthStore` and redirects authenticated sessions to `/chat`.
- **Component Breakdown:** Modular components in `apps/web/src/components/landing`: `LandingNavbar`, `LandingHero`, `LandingMetrics`, `LandingComparison`, `LandingFeatures`, `LandingPricing`, `LandingLgpdTrust`, `LandingFaq`, and `LandingFooter`.
- **Styling:** Tailwind CSS with responsive breakpoints (mobile, tablet, desktop) and refined dark/light tokens.
- **Conversion Parameters:** Action buttons route to `/register?plan=pro&trial=true`, `/register?plan=free`, or `/login`.

## Testing Decisions

- **Test Seam:** Highest integration seam using React Testing Library in `apps/web/src/__tests__/landing-page.test.tsx`.
- **Behavioral Assertions:**
  - Unauthenticated visitor renders all 9 sections.
  - Primary CTA button navigates to registration with trial parameters.
  - Pricing switcher toggles monthly/annual values.
  - FAQ accordion items expand and collapse on click.
  - Authenticated session redirects to `/chat`.

## Out of Scope

- External headless CMS integration.
- Third-party live-chat support widgets.
- Multilingual localization beyond pt-BR in initial launch.
