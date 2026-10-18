# 0001 - Arquitetura e Rota da Landing Page

## Status

Aceito

## Contexto e Decisão

Para viabilizar a aquisição de clientes por meio de Product-Led Growth (PLG), decidimos implementar a Landing Page de Alta Conversão diretamente dentro de `apps/web` montada na rota pública `/`, deslocando a interface operacional autenticada de mensageria para `/chat`. Usuários que acessarem a raiz com token JWT de autenticação válido são redirecionados automaticamente e de forma transparente para `/chat`.

## Opções Consideradas

1. **Novo app no monorepo (`apps/landing`):** Rejeitado para evitar complexidade adicional de múltiplos domínios, duplicação do design system Tailwind e configuração de um terceiro serviço no Vercel Services.
2. **Página HTML estática separada em CDN externa:** Rejeitada por dificultar o compartilhamento do estado de autenticação e navegação SPA integrada para o cadastro.
3. **Landing Page integrada em `apps/web` (Escolhida):** Aproveita a infraestrutura Vite + Tailwind existente, garante compatibilidade total com o roteamento do Vercel Services e permite que o CTA navegue diretamente para as telas de autenticação sem recarregar a aplicação.
