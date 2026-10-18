# Especificação: Landing Page de Alta Conversão

> Publicada via comando `/to-spec`. Status: `ready-for-agent`.

## Problem Statement

Pequenas e médias empresas (10 a 80 colaboradores) que dependem do WhatsApp informal para a comunicação diária enfrentam sobrecarga cognitiva por excesso de ruído (áudios longos, conversas dispersas, mensagens fora de horário), riscos severos de vazamento de dados estratégicos e insegurança jurídica quanto à conformidade com a LGPD. Ao mesmo tempo, plataformas corporativas tradicionais (como Slack e Microsoft Teams) são caras, burocráticas e complexas demais para a dinâmica operacional dessas equipes.

Hoje, quando um potencial tomador de decisão (CEO, COO, Gerente de TI ou RH) chega ao endereço da plataforma, depara-se diretamente com formulários crus de login e cadastro, sem qualquer apresentação convincente da proposta de valor, sem demonstração visual do produto, sem desmistificação de objeções (como custos e migração) e sem um caminho de entrada de fricção zero (como o Trial de 14 dias do Plano Pro sem cartão de crédito). Isso resulta em abandono de tráfego e baixa taxa de conversão de visitantes em organizações ativas.

## Solution

Criar uma Landing Page institucional e comercial de alta conversão, moderna, responsiva e alinhada ao design system premium da aplicação, servida na rota raiz pública (`/`).

A Landing Page apresenta uma narrativa de Product-Led Growth estruturada em 9 blocos estratégicos:

1. **Cabeçalho Fixo (Header):** Identidade visual, links âncora de navegação e botões diretos de "Entrar" e "Começar Grátis".
2. **Seção Hero:** Headline matadora expondo a Proposta Única de Valor ("Comunicação corporativa focada, sem ruídos e com privacidade radical"), Subheadline persuasiva, duplo Call-to-Action (CTA primário para o Trial de 14 dias e CTA secundário para demonstração interativa), badges de confiança ("Sem cartão de crédito", "100% LGPD") e mockup visual do app em ação.
3. **Barra de Métricas e Confiança:** Indicadores de impacto (economia de tempo, 0% de retenção indevida de dados no Free, alta disponibilidade).
4. **Quadro de Contraste (WhatsApp Informal vs. NextMsg):** Tabela visual comparativa evidenciando as dores do aplicativo pessoal no trabalho versus a governança do mensageiro corporativo.
5. **Vitrine de Diferenciais Exclusivos:** Destaques interativos dos recursos já desenvolvidos (Relay de arquivos em memória sem persistência no Free, Grupos Temporários com autoarquivamento, Canal "Comunicados" para avisos oficiais, Enquetes em tempo real e Assinatura Eletrônica integrada).
6. **Tabela Comparativa de Planos (Pricing Table):** Comparativo transparente entre os planos Free (R$ 0), Pro (R$ 79,90/mês) e Enterprise (R$ 259,90/mês) com alternador de faturamento (mensal/anual com desconto) e botões que injetam o plano e trial no fluxo de registro.
7. **Privacidade e Garantia LGPD:** Bloco educacional detalhando a política de retenção temporária e os direitos do titular previstos no Art. 18.
8. **FAQ Interativo (Accordion):** Quebra direta das principais objeções de contratação por gestores e administradores.
9. **Fechamento e Rodapé (Footer):** Última chamada de conversão e links institucionais para termos de privacidade e login.

Se um usuário com sessão ativa (autenticado com JWT válido) acessar a raiz `/`, a aplicação o redireciona automaticamente para o ambiente operacional em `/chat`.

---

## User Stories

### Descoberta e Primeira Impressão (Hero & Header)

1. Como um visitante acessando a página pela primeira vez, quero visualizar um cabeçalho fixo com logo e links de navegação, para poder me orientar rapidamente sobre o conteúdo da página.
2. Como um visitante no smartphone, quero acessar um menu responsivo simplificado no cabeçalho, para navegar confortavelmente sem que elementos visuais quebrem a tela.
3. Como um gestor de equipe visitando a página, quero ler uma headline clara e impactante no Hero, para entender em menos de 5 segundos o que o produto resolve e por que ele é diferente do WhatsApp.
4. Como um tomador de decisão, quero ver badges de baixo risco (ex.: "14 dias grátis", "Sem cartão de crédito no cadastro", "Conformidade LGPD"), para me sentir seguro em testar a solução imediatamente.
5. Como um visitante visual, quero visualizar um mockup realista da interface do chat com exemplos de mensagens corporativas, enquetes e status de entrega, para tangibilizar o produto antes de criar conta.
6. Como um visitante interessado, quero clicar no CTA principal do Hero ("Testar Pro por 14 dias grátis"), para ser direcionado à tela de cadastro com o plano Pro e o trial de 14 dias já pré-selecionados.
7. Como um visitante cauteloso, quero clicar no CTA secundário ("Conhecer Recursos e Planos"), para a página rolar suavemente até a seção demonstrativa ou de preços.

### Compreensão de Valor e Resolução de Dores

8. Como um empresário incomodado com o uso indiscriminado de áudios no WhatsApp por colaboradores, quero ver uma seção destacando o foco estrito em mensagens de texto e arquivos, para confirmar que o app elimina distrações operacionais.
9. Como um gestor de operações, quero ver a tabela comparativa "WhatsApp Pessoal vs. NextMsg", para justificar internamente perante a diretoria a adoção de um canal oficial de comunicação.
10. Como um administrador de TI, quero conhecer o funcionamento do Plano Free com relay em memória sem retenção em disco, para entender o compromisso de privacidade da plataforma.
11. Como um líder de projetos, quero conhecer o funcionamento dos Grupos Temporários com data de expiração, para saber como conduzir projetos sazonais que se encerram automaticamente em modo somente leitura.
12. Como um diretor de comunicação interna, quero entender como funciona a Lista de Transmissão corporativa ("Comunicados"), para avaliar a eficácia do envio de comunicados oficiais sem respostas públicas desordenadas.
13. Como um gerente de departamento, quero visualizar como funcionam as Enquetes com apuração em tempo real, para entender a facilidade de tomada de decisões democráticas na equipe.
14. Como um executivo de empresa de médio/grande porte, quero conhecer a funcionalidade de Assinatura Eletrônica Clicksign, para saber se posso assinar ordens de serviço e documentos diretamente pelo mensageiro corporativo.

### Avaliação Financeira e Escolha de Planos

15. Como um gestor orçamentário, quero alternar entre os modos de pagamento "Mensal" e "Anual (com desconto)", para calcular a economia de escala para a minha organização.
16. Como um coordenador de equipe pequena (até 12 pessoas), quero ver os limites claros do Plano Free (até 12 membros, 5 MB por arquivo, envio para destinatário online), para saber se consigo começar com custo zero.
17. Como um gestor de equipe em crescimento (10 a 80 pessoas), quero examinar os benefícios do Plano Pro (R$ 79,90/mês, até 80 membros, 25 MB por arquivo, store-and-forward de 5 dias, enquetes e comunicados), para identificar o melhor custo-benefício.
18. Como um decisor de empresa com mais de 80 colaboradores, quero examinar os diferenciais do Plano Enterprise (R$ 259,90/mês, usuários ilimitados, assinaturas eletrônicas ilimitadas), para iniciar o processo de contratação corporativa.
19. Como um usuário clicando no botão "Começar no Free", quero ser levado ao fluxo de cadastro já posicionado no plano gratuito.
20. Como um usuário clicando no botão "Iniciar Trial do Pro", quero ser levado ao fluxo de cadastro com o trial de 14 dias ativo sem solicitação de cartão.
21. Como um usuário clicando no botão "Falar com Especialista / Enterprise", quero ter um canal direto (abertura de conversa comercial via WhatsApp/e-mail) para negociar condições personalizadas.

### Quebra de Objeções e Conformidade Jurídica (LGPD)

22. Como um encarregado de dados (DPO) ou advogado corporativo, quero ler a seção dedicada à LGPD, para verificar que o sistema cumpre o Artigo 18 (direito de confirmação, acesso, exportação e anonimização/eliminação).
23. Como um cliente preocupado com segurança, quero consultar no FAQ se os arquivos do Plano Pro ficam armazenados para sempre, para confirmar que há expiração programada em até 5 dias ou deleção pós-download.
24. Como um administrador de empresa, quero expandir as perguntas frequentes do FAQ em formato accordion, para esclarecer dúvidas sobre convite de membros e compatibilidade móvel (PWA).
25. Como um visitante no FAQ, quero expandir uma pergunta e poder fechar outra automaticamente ou de forma independente, sem travamentos de layout.

### Acesso Recorrente e Rodapé

26. Como um usuário que já possui conta ativa e está autenticado, quero que o acesso à URL raiz `/` me redirecione imediatamente para `/chat`, para que eu não precise navegar pela landing page toda vez que abrir o sistema.
27. Como um usuário com conta criada mas deslogado, quero clicar em "Entrar" no cabeçalho ou rodapé, para ser levado diretamente à página de login.
28. Como um usuário preocupado com transparência, quero clicar no link de Política de Privacidade no rodapé, para acessar a política completa exigida pela LGPD.

---

## Implementation Decisions

### 1. Arquitetura da Rota e Componentização

- A Landing Page será implementada como uma página principal dedicada dentro de `apps/web` no caminho de rota `/`.
- A rota operacional do chat e gerenciamento corporativo residirá na rota `/chat`.
- O roteador principal da aplicação (`apps/web/src/routes/index.tsx` ou equivalente) verificará o estado de autenticação no `useAuthStore`: se o token JWT for válido, a raiz `/` efetuará um redirecionamento automático (`Navigate to="/chat" replace`). Caso contrário, renderizará a `LandingPage`.

### 2. Decomposição de Componentes da Landing Page

A página será organizada em componentes isolados e de alta coesão:

- `LandingNavbar`: Barra de navegação com glassmorphism, links suaves com `scrollIntoView`, logo NextMsg e botões de ação.
- `LandingHero`: Área principal de conversão com badges de benefício, headline persuasiva, CTA duplo, avatar stack de times e preview do app.
- `LandingMetrics`: Faixa de métricas de impacto (tempo de foco recuperado, 0% retenção no Free, disponibilidade garantida).
- `LandingComparison`: Tabela/cards comparativos visuais entre os problemas do WhatsApp convencional e as vantagens estruturadas do NextMsg.
- `LandingFeatures`: Grid moderno com cards visuais com ícones e micro-cenários demonstrativos (Zero Retenção Free, Grupos Temporários, Transmissão, Enquetes, Assinatura Eletrônica).
- `LandingPricing`: Seletor de período Mensal/Anual (com selo "-17% OFF no Anual") e 3 cards de preços destacados (Free, Pro como "Mais Popular", Enterprise) com CTAs parametrizados.
- `LandingLgpdTrust`: Painel com selo de conformidade com a Lei 13.709/2018 (LGPD), destacando privacidade por design.
- `LandingFaq`: Accordion acessível com respostas claras às 6 principais dúvidas de clientes B2B.
- `LandingFooter`: Rodapé com copyright, links para termos, política LGPD e botão de retorno ao topo.

### 3. Integração de Rotas com os CTAs de Conversão

- O CTA "Testar Pro por 14 dias grátis" navega para `/register?plan=pro&trial=true`.
- O CTA "Começar Grátis" navega para `/register?plan=free`.
- O CTA "Entrar" navega para `/login`.
- A tela existente de registro já aceita parâmetros de plano ou permite ao usuário concluir o cadastro sem fricção inicial de faturamento.

### 4. Estilos, Acessibilidade e Performance

- Utilização estrita de Tailwind CSS já configurado no projeto, com paleta de cores corporativa escura/clara refinada (tons de Slate/Zinc, destaques em Emerald/Indigo).
- Contraste WCAG AA para todas as fontes e botões.
- Efeitos visuais refinados: gradientes sutis, sombras em camadas (`shadow-xl`), bordas finas com transparência (`border-slate-700/50` / `border-slate-200`) e microtransições de hover (`transition-all duration-200`).
- Sem dependências de bibliotecas externas pesadas: microinterações baseadas no Lucide React e transições nativas de CSS do Tailwind.

---

## Testing Decisions

### Seams de Teste

- **Seam de Teste Primário (Highest Seam):** Testes de integração em nível de página via React Testing Library e Vitest em `apps/web/src/__tests__/landing-page.test.tsx`.
- Esse seam renderiza a aplicação completa dentro do `MemoryRouter` na rota `/`, simulando a experiência real de navegação do usuário no navegador sem mockar a árvore interna de DOM.

### Critérios de Aceite para Testes

- **Comportamento Externo:**
  1. Renderização de todos os 9 blocos principais da Landing Page para usuários anônimos (Hero, Dores, Recursos, Preços, LGPD, FAQ, Rodapé).
  2. Clique no CTA primário redireciona o usuário para a página de registro com os parâmetros adequados.
  3. Clique no botão "Entrar" direciona para `/login`.
  4. Redirecionamento automático: se o teste inicializar o `authStore` com um token válido de autenticação, acessar a rota `/` deve navegar automaticamente para `/chat`.
  5. Alternador da tabela de preços atualiza os valores e períodos exibidos dinamicamente na tela.
  6. Itens do accordion de FAQ alternam os estados de visibilidade da resposta ao serem clicados.

### Prior Art

- Testes de roteamento e fluxos de tela em `apps/web/src/__tests__/App.test.tsx` e `apps/web/src/__tests__/auth-pages.test.tsx`.

---

## Out of Scope

- Criação de um Blog corporativo ou integração com CMS externo (Headless CMS como Strapi ou Sanity).
- Widget de chat ao vivo de suporte de terceiros (como Zendesk ou Intercom) nesta versão inicial.
- Internacionalização multilíngue além de pt-BR (o produto tem foco imediato no mercado brasileiro e aderência à LGPD).
- Checkout transparente do Asaas embutido diretamente na Landing Page antes da criação da conta de usuário (o pagamento ocorre após o cadastro e durante/após o período de Trial no painel da conta).

---

## Further Notes

- A linguagem adotada na landing page deve espelhar com exatidão a taxonomia do produto: "Organização", "Colaborador", "Plano Free", "Plano Pro", "Plano Enterprise", "Trial de 14 dias", "Canal Comunicados" e "Grupos Temporários".
- A página utiliza a identidade de trabalho **NextMsg**, com parametrização centralizada caso haja alteração futura da marca comercial.
