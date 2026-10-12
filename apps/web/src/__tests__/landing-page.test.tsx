import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../routes/AppRoutes';
import { useAuthStore } from '../stores/auth.store';

describe('Landing Page de Alta Conversão (PLG & Conversão B2B)', () => {
  beforeEach(() => {
    // Start unauthenticated by default
    useAuthStore.setState({
      user: null,
      account: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('1. Renderiza o cabeçalho, logo NextMsg e links de navegação para visitantes anônimos', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // Brand and Tagline
    expect(screen.getAllByText('NextMsg').length).toBeGreaterThan(0);
    expect(screen.getByText('Mensageria Corporativa Focada')).toBeInTheDocument();

    // Nav anchor buttons
    expect(screen.getByText('Recursos')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp vs NextMsg')).toBeInTheDocument();
    expect(screen.getByText('Planos')).toBeInTheDocument();
    expect(screen.getByText('Segurança & LGPD')).toBeInTheDocument();
    expect(screen.getByText('Dúvidas')).toBeInTheDocument();

    // Auth direct buttons
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Testar Pro 14 Dias Grátis/i })).toHaveAttribute(
      'href',
      '/register?plan=pro&trial=true'
    );
  });

  it('2. Renderiza a Hero section com proposta de valor, badges de confiança e mockup do chat', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // Primary Headline
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Comunicação corporativa focada,/i,
      })
    ).toBeInTheDocument();

    // Trust badges
    expect(screen.getByText('Sem cartão de crédito no cadastro')).toBeInTheDocument();
    expect(screen.getByText('Plano Free até 12 colaboradores')).toBeInTheDocument();
    expect(screen.getByText('100% Conforme à LGPD (Art. 18)')).toBeInTheDocument();

    // Interactive App Mockup items
    expect(screen.getByText(/NextMsg Desktop — TechCorp Soluções/i)).toBeInTheDocument();
    expect(screen.getByText(/34 Colaboradores Online/i)).toBeInTheDocument();
    expect(screen.getByText('Acordo_Comercial_Q4.pdf')).toBeInTheDocument();
    expect(screen.getByText('Enquete: Cronograma de homologação aprovado?')).toBeInTheDocument();
  });

  it('3. Renderiza a faixa de métricas e o quadro comparativo WhatsApp vs NextMsg', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // Metrics
    expect(screen.getByText('Foco em Produtividade')).toBeInTheDocument();
    expect(screen.getByText('Retenção no Plano Free')).toBeInTheDocument();
    expect(screen.getByText('Retenção Máxima no Pro')).toBeInTheDocument();
    expect(screen.getByText('Conformidade LGPD Nativa')).toBeInTheDocument();

    // Comparison Matrix
    expect(
      screen.getByText('Por que empresas de alta performance estão saindo do WhatsApp?')
    ).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Tradicional')).toBeInTheDocument();
    expect(screen.getByText('NextMsg Corporativo')).toBeInTheDocument();
  });

  it('4. Renderiza a vitrine dos 5 recursos principais já construídos', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('Relay em Memória (Zero Retenção Free)')).toBeInTheDocument();
    expect(screen.getByText('Grupos Temporários Expiráveis')).toBeInTheDocument();
    expect(screen.getByText('Canal Oficial "Comunicados"')).toBeInTheDocument();
    expect(screen.getByText('Enquetes Corporativas ao Vivo')).toBeInTheDocument();
    expect(screen.getByText('Assinatura Eletrônica Clicksign')).toBeInTheDocument();
  });

  it('5. Permite alternar a periodicidade dos planos (Mensal e Anual) com atualização de preços', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // Monthly initial prices
    expect(screen.getByText('R$ 79,90')).toBeInTheDocument();
    expect(screen.getByText('R$ 259,90')).toBeInTheDocument();

    // Toggle to Annual
    const annualLabel = screen.getByText('Faturamento Anual');
    fireEvent.click(annualLabel);

    // Annual discounted prices
    expect(screen.getByText('R$ 66,50')).toBeInTheDocument();
    expect(screen.getByText('R$ 216,50')).toBeInTheDocument();
    expect(screen.getByText(/cobrado anualmente \(R\$ 798\/ano\)/i)).toBeInTheDocument();

    // CTAs with query params
    const freeCta = screen.getByRole('link', { name: /Começar no Plano Free/i });
    expect(freeCta).toHaveAttribute('href', '/register?plan=free');

    const proCtas = screen.getAllByRole('link', { name: /Testar Pro por 14 Dias Grátis/i });
    expect(proCtas.length).toBeGreaterThan(0);
    expect(proCtas[0]).toHaveAttribute('href', '/register?plan=pro&trial=true');
  });

  it('6. Apresenta o painel de conformidade com a LGPD e direitos do titular', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(
      screen.getByText('Segurança jurídica e conformidade absoluta com a LGPD')
    ).toBeInTheDocument();
    expect(screen.getByText('Art. 18, V — Portabilidade de Dados')).toBeInTheDocument();
    expect(screen.getByText('Art. 18, VI — Direito ao Esquecimento')).toBeInTheDocument();
    expect(screen.getByText('Canal Direto com o Encarregado (DPO)')).toBeInTheDocument();
  });

  it('7. Alterna a visibilidade dos itens do accordion de perguntas frequentes (FAQ)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // Question 1 answer is open by default
    expect(
      screen.getByText(/Você cadastra sua organização em menos de 1 minuto sem precisar informar cartão/i)
    ).toBeInTheDocument();

    // Question 2: Why no audio messages?
    const q2Button = screen.getByText(
      'Por que o NextMsg não possui mensagens de áudio ou chamadas?'
    );
    fireEvent.click(q2Button);

    expect(
      screen.getByText(
        /Esta é uma escolha deliberada de produtividade e foco\. Áudios de 5 minutos consomem horas de trabalho/i
      )
    ).toBeInTheDocument();
  });

  it('8. Redireciona automaticamente para /chat quando o usuário já está autenticado', () => {
    // Set authenticated state in store
    useAuthStore.setState({
      user: {
        id: 'u1',
        accountId: 'acc-1',
        name: 'Carlos Admin',
        email: 'admin@empresa.com',
        role: 'owner',
        status: 'active',
      },
      account: {
        id: 'acc-1',
        name: 'Tech Corp',
        plan: 'pro',
        status: 'active',
      },
      accessToken: 'valid-jwt-token',
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // When authenticated, visiting '/' redirects to '/chat', which renders ChatPage
    expect(screen.getByTitle('Conversas')).toBeInTheDocument();
    expect(screen.getByTitle('NextMsg')).toBeInTheDocument();
  });

  it('9. Abre e fecha o menu mobile da Navbar e navega para seções', () => {
    // Mock scrollIntoView
    const scrollMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    const menuBtn = screen.getByLabelText('Abrir menu');
    expect(menuBtn).toBeInTheDocument();

    // Open mobile drawer
    fireEvent.click(menuBtn);
    const faqElements = screen.getAllByText('Perguntas Frequentes');
    expect(faqElements.length).toBeGreaterThan(0);

    // Click section in mobile menu
    fireEvent.click(faqElements[0]);

    // Close menu
    fireEvent.click(menuBtn);
  });

  it('10. Alterna accordion de Perguntas Frequentes para questões adicionais', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    const q3Button = screen.getByText(
      'Como funciona o envio de arquivos no Plano Free sem salvar nada?'
    );
    fireEvent.click(q3Button);

    // Answer should be visible
    expect(
      screen.getByText(
        /No Plano Free \(até 12 usuários\), implementamos a arquitetura de "Relay em Memória"/i
      )
    ).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(q3Button);
  });
});

