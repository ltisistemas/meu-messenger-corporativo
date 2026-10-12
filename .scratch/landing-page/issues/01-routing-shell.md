# 01: Roteamento Base e Shell da Landing Page (Navbar & Footer)

**What to build:**
A rota pública `/` do aplicativo web renderiza a casca da Landing Page (`LandingPage`), contendo cabeçalho fixo com navegação suave por âncora, botões de ação e rodapé institucional. Se um usuário autenticado com sessão válida acessar `/`, ele é automaticamente redirecionado para `/chat`.

**Blocked by:** None (can start immediately)

**Status:** closed (resolved)

- [x] Acessar `/` sem token JWT renderiza o shell da Landing Page com cabeçalho e rodapé
- [x] Acessar `/` com token JWT ativo no `useAuthStore` redireciona para `/chat`
- [x] O componente `LandingNavbar` possui logo NextMsg, links de âncora e botões para login (`/login`) e cadastro (`/register?plan=free`)
- [x] O componente `LandingFooter` exibe links para política de privacidade LGPD, copyright e volta ao topo
