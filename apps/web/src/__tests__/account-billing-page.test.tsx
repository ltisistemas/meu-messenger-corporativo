import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AccountOverviewCard } from '../components/account/AccountOverviewCard';
import { QuotaWarningBanner } from '../components/account/QuotaWarningBanner';
import { MemberManagementSection } from '../components/account/MemberManagementSection';
import { PlansComparisonSection } from '../components/account/PlansComparisonSection';
import { UpgradeCheckoutModal } from '../components/account/UpgradeCheckoutModal';
import { InvoicesHistorySection } from '../components/account/InvoicesHistorySection';
import { AccountPage } from '../pages/AccountPage';
import { useAuthStore } from '../stores/auth.store';
import { useAccountStore } from '../stores/account.store';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Plans, Invoices & Account Dashboard Frontend (T-30)', () => {
  const mockAccountDetails = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Acme Corporação',
    plan: 'free' as const,
    status: 'over_quota' as const,
    trialUntil: null,
    isTrialing: false,
    trialDaysRemaining: null,
    activeUsersCount: 15,
    inactiveUsersCount: 2,
    maxUsers: 12,
    isOverQuota: true,
    excessUsersCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const mockMembers = [
    {
      id: '22222222-2222-2222-2222-222222222222',
      accountId: '11111111-1111-1111-1111-111111111111',
      name: 'Carlos Proprietário',
      email: 'carlos@acme.com',
      role: 'owner' as const,
      status: 'active' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      accountId: '11111111-1111-1111-1111-111111111111',
      name: 'Mariana Admin',
      email: 'mariana@acme.com',
      role: 'admin' as const,
      status: 'active' as const,
      createdAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      accountId: '11111111-1111-1111-1111-111111111111',
      name: 'Lucas Desenvolvedor',
      email: 'lucas@acme.com',
      role: 'member' as const,
      status: 'active' as const,
      createdAt: '2026-01-03T00:00:00.000Z',
    },
  ];

  const mockBillingSummary = {
    account: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Corporação',
      plan: 'pro',
      status: 'active',
      activeUsersCount: 15,
      maxUsers: 80,
    },
    subscription: {
      id: 'sub_123',
      accountId: '11111111-1111-1111-1111-111111111111',
      gateway: 'asaas',
      gatewaySubscriptionId: 'sub_asaas_123',
      plan: 'pro' as const,
      billingCycle: 'monthly' as const,
      paymentMethod: 'pix' as const,
      status: 'active' as const,
      amountCents: 7990,
      currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    latestInvoice: null,
    invoices: [
      {
        id: 'inv_123',
        accountId: '11111111-1111-1111-1111-111111111111',
        subscriptionId: 'sub_123',
        gatewayInvoiceId: 'pay_123',
        amountCents: 7990,
        status: 'paid' as const,
        paymentMethod: 'pix' as const,
        pdfUrl: 'https://asaas.com/invoices/inv_123.pdf',
        bankSlipUrl: null,
        pixQrCode: null,
        pixCopyPaste: null,
        dueDate: '2026-02-01T00:00:00.000Z',
        paidAt: '2026-01-01T12:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: '22222222-2222-2222-2222-222222222222',
        accountId: '11111111-1111-1111-1111-111111111111',
        name: 'Carlos Proprietário',
        email: 'carlos@acme.com',
        role: 'owner',
        status: 'active',
      },
      account: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Acme Corporação',
        plan: 'free',
        status: 'over_quota',
      },
      isAuthenticated: true,
    });

    (api.get as any).mockImplementation((url: string) => {
      if (url === '/accounts/me') return Promise.resolve(mockAccountDetails);
      if (url === '/accounts/members') return Promise.resolve({ members: mockMembers });
      if (url === '/billing/summary') return Promise.resolve(mockBillingSummary);
      return Promise.resolve({});
    });
  });

  describe('AccountOverviewCard Component', () => {
    it('renders organization name, plan badge and active users progress metrics', () => {
      render(
        <AccountOverviewCard
          account={mockAccountDetails}
          onUpgradeClick={vi.fn()}
          onInviteClick={vi.fn()}
        />
      );

      expect(screen.getByText('Acme Corporação')).toBeInTheDocument();
      expect(screen.getByText(/PLANO FREE/i)).toBeInTheDocument();
      expect(screen.getByText('15 / 12 usuários')).toBeInTheDocument();
      expect(screen.getByText(/Limite Excedido/i)).toBeInTheDocument();
      expect(screen.getByText(/3 membro\(s\) acima da cota/i)).toBeInTheDocument();
    });

    it('renders Trial Pro badge and days countdown when account is trialing', () => {
      const trialingAccount = {
        ...mockAccountDetails,
        plan: 'pro' as const,
        status: 'active' as const,
        isOverQuota: false,
        isTrialing: true,
        trialDaysRemaining: 12,
      };

      render(
        <AccountOverviewCard
          account={trialingAccount}
          onUpgradeClick={vi.fn()}
          onInviteClick={vi.fn()}
        />
      );

      expect(screen.getByText(/Trial Pro \(12d\)/i)).toBeInTheDocument();
    });
  });

  describe('QuotaWarningBanner Component', () => {
    it('renders over_quota warning banner with excess members and action CTA buttons', () => {
      const onUpgrade = vi.fn();
      const onManage = vi.fn();

      render(
        <QuotaWarningBanner
          status="over_quota"
          isOverQuota={true}
          excessUsersCount={3}
          maxUsers={12}
          activeUsersCount={15}
          planName="FREE"
          onUpgradeClick={onUpgrade}
          onManageMembersClick={onManage}
        />
      );

      expect(screen.getByText(/Limite de Usuários Excedido/i)).toBeInTheDocument();
      expect(screen.getByText(/15 membros ativos/i)).toBeInTheDocument();

      const upgradeBtn = screen.getByText(/Fazer Upgrade/i);
      fireEvent.click(upgradeBtn);
      expect(onUpgrade).toHaveBeenCalled();

      const manageBtn = screen.getByText(/Desativar 3 Membros/i);
      fireEvent.click(manageBtn);
      expect(onManage).toHaveBeenCalled();
    });

    it('renders suspended warning banner when account is suspended', () => {
      render(
        <QuotaWarningBanner
          status="suspended"
          onUpgradeClick={vi.fn()}
        />
      );

      expect(screen.getByText(/Conta suspensa por inadimplência/i)).toBeInTheDocument();
    });
  });

  describe('MemberManagementSection Component', () => {
    it('renders list of members and filters by search query', () => {
      render(
        <MemberManagementSection
          members={mockMembers}
          currentUserRole="owner"
          currentUserId="22222222-2222-2222-2222-222222222222"
          onUpdateStatus={vi.fn()}
          onUpdateRole={vi.fn()}
          onOpenInviteModal={vi.fn()}
        />
      );

      expect(screen.getByText('Carlos Proprietário')).toBeInTheDocument();
      expect(screen.getByText('Mariana Admin')).toBeInTheDocument();
      expect(screen.getByText('Lucas Desenvolvedor')).toBeInTheDocument();

      // Search
      const searchInput = screen.getByPlaceholderText(/Buscar por nome ou e-mail/i);
      fireEvent.change(searchInput, { target: { value: 'Mariana' } });

      expect(screen.getByText('Mariana Admin')).toBeInTheDocument();
      expect(screen.queryByText('Lucas Desenvolvedor')).not.toBeInTheDocument();
    });

    it('calls onUpdateStatus when clicking Desativar button', async () => {
      const onUpdateStatus = vi.fn().mockResolvedValue(undefined);

      render(
        <MemberManagementSection
          members={mockMembers}
          currentUserRole="owner"
          currentUserId="22222222-2222-2222-2222-222222222222"
          onUpdateStatus={onUpdateStatus}
          onUpdateRole={vi.fn()}
          onOpenInviteModal={vi.fn()}
        />
      );

      const deactivateButtons = screen.getAllByText('Desativar');
      fireEvent.click(deactivateButtons[0]);

      expect(onUpdateStatus).toHaveBeenCalledWith('33333333-3333-3333-3333-333333333333', 'inactive');
    });

    it('calls onUpdateStatus to activate an inactive member and renders error when update fails', async () => {
      const onUpdateStatus = vi.fn().mockRejectedValueOnce(new Error('Erro ao alterar status'));
      const inactiveMembers = [
        {
          id: 'm-inactive',
          name: 'Julia Inativa',
          email: 'julia@empresa.com',
          role: 'member' as const,
          status: 'inactive' as const,
          joinedAt: new Date().toISOString(),
        },
      ];

      render(
        <MemberManagementSection
          members={inactiveMembers}
          currentUserRole="owner"
          currentUserId="admin-id"
          onUpdateStatus={onUpdateStatus}
          onUpdateRole={vi.fn()}
          onOpenInviteModal={vi.fn()}
        />
      );

      const activateBtn = screen.getByRole('button', { name: /Ativar/i });
      fireEvent.click(activateBtn);

      expect(onUpdateStatus).toHaveBeenCalledWith('m-inactive', 'active');
      await waitFor(() => {
        expect(screen.getByText('Erro ao alterar status')).toBeInTheDocument();
      });
    });
  });

  describe('PlansComparisonSection Component', () => {
    it('renders Free, Pro, and Enterprise plan cards with feature checkmarks and prices', () => {
      render(
        <PlansComparisonSection
          currentPlan="free"
          onSelectUpgrade={vi.fn()}
          onDowngradeToFree={vi.fn()}
        />
      );

      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText(/R\$ 79,90/i)).toBeInTheDocument();
      expect(screen.getByText(/R\$ 259,90/i)).toBeInTheDocument();
      expect(screen.getByText(/Mais Escolhido/i)).toBeInTheDocument();
    });

    it('toggles between monthly and yearly billing cycles with 10% discount', () => {
      render(
        <PlansComparisonSection
          currentPlan="free"
          onSelectUpgrade={vi.fn()}
          onDowngradeToFree={vi.fn()}
        />
      );

      const yearlyBtn = screen.getByText('Anual');
      fireEvent.click(yearlyBtn);

      expect(screen.getByText(/R\$ 71,91/i)).toBeInTheDocument();
      expect(screen.getByText(/R\$ 233,91/i)).toBeInTheDocument();
    });

    it('calls onSelectUpgrade when clicking Fazer Upgrade para Pro', () => {
      const onSelect = vi.fn();

      render(
        <PlansComparisonSection
          currentPlan="free"
          onSelectUpgrade={onSelect}
          onDowngradeToFree={vi.fn()}
        />
      );

      const upgradeProBtn = screen.getByText('Fazer Upgrade para Pro');
      fireEvent.click(upgradeProBtn);

      expect(onSelect).toHaveBeenCalledWith('pro', 'monthly');
    });
  });

  describe('UpgradeCheckoutModal Component', () => {
    it('allows choosing payment method (Pix, Cartão, Boleto) and submitting form', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <UpgradeCheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          targetPlan="pro"
          billingCycle="monthly"
          onSubmitCheckout={onSubmit}
        />
      );

      expect(screen.getByText(/Assinatura Plano Pro/i)).toBeInTheDocument();
      expect(screen.getByText(/Pix \(Instantâneo\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Cartão de Crédito/i)).toBeInTheDocument();
      expect(screen.getByText(/Boleto Bancário/i)).toBeInTheDocument();

      // Fill in required fields
      fireEvent.change(screen.getByPlaceholderText('Nome Completo'), {
        target: { value: 'Carlos Silva' },
      });
      fireEvent.change(screen.getByPlaceholderText('financeiro@empresa.com'), {
        target: { value: 'carlos@empresa.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), {
        target: { value: '12345678901' },
      });

      const submitBtn = screen.getByText('Gerar Cobrança Asaas');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it('renders QR code and Copy Paste code when Pix checkout result is present', () => {
      render(
        <UpgradeCheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          targetPlan="pro"
          billingCycle="monthly"
          onSubmitCheckout={vi.fn()}
          checkoutResult={{
            pixQrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            pixCopyPaste: '00020126580014br.gov.bcb.pix0136asaas_pix_mock',
          }}
        />
      );

      expect(screen.getByText(/Pague via Pix para Ativação Instantânea/i)).toBeInTheDocument();
      expect(screen.getByText(/00020126580014br.gov.bcb.pix0136asaas_pix_mock/i)).toBeInTheDocument();
      expect(screen.getByText('Copiar')).toBeInTheDocument();
    });
  });

  describe('InvoicesHistorySection Component', () => {
    it('renders active subscription and past invoices list with PDF links', () => {
      render(
        <InvoicesHistorySection
          billingSummary={mockBillingSummary}
          onCancelSubscription={vi.fn()}
        />
      );

      expect(screen.getByText(/Assinatura Plano PRO/i)).toBeInTheDocument();
      expect(screen.getByText(/Histórico de Faturas/i)).toBeInTheDocument();
      expect(screen.getByText('Fatura PDF')).toBeInTheDocument();
      expect(screen.getByText('Cancelar Renovação')).toBeInTheDocument();
    });
  });

  describe('AccountPage Complete Integration', () => {
    it('renders AccountPage, loads data and switches tabs between Membros, Planos, Faturas, and Privacidade', async () => {
      window.confirm = vi.fn(() => true);

      render(
        <BrowserRouter>
          <AccountPage />
        </BrowserRouter>
      );

      // Verify header and overview loaded
      await waitFor(() => {
        expect(screen.getByText('Painel da Organização')).toBeInTheDocument();
        expect(screen.getByText('Acme Corporação')).toBeInTheDocument();
      });

      // Switch to Plans Tab
      const plansTab = screen.getByText(/Comparativo de Planos & Upgrade/i);
      fireEvent.click(plansTab);
      expect(screen.getByText(/Planos Flexíveis para a sua Empresa/i)).toBeInTheDocument();

      // Open Upgrade Modal from Plans tab
      const upgradeProBtn = screen.getByRole('button', { name: /Fazer Upgrade para Pro/i });
      fireEvent.click(upgradeProBtn);
      expect(screen.getByText(/Assinatura Plano Pro/i)).toBeInTheDocument();
      const cancelUpgradeBtn = screen.getByRole('button', { name: /Cancelar/i });
      fireEvent.click(cancelUpgradeBtn);

      // Test downgrade to free when on Pro plan
      act(() => {
        useAccountStore.setState({
          accountDetails: { ...mockAccountDetails, plan: 'pro' },
        });
      });
      const downgradeBtn = await screen.findByRole('button', { name: /Mudar para Free/i });
      fireEvent.click(downgradeBtn);
      expect(window.confirm).toHaveBeenCalled();

      // Switch to Invoices Tab
      const invoicesTab = screen.getByText(/Faturas & Assinatura/i);
      fireEvent.click(invoicesTab);
      expect(screen.getByText(/Histórico de Faturas/i)).toBeInTheDocument();

      // Switch to Privacy Tab
      const privacyTab = screen.getByText(/Privacidade & LGPD/i);
      fireEvent.click(privacyTab);
      expect(screen.getByText(/Proteção de Dados & LGPD/i)).toBeInTheDocument();

      // Switch back to Members Tab
      const membersTab = screen.getByText(/Membros da Equipe/i);
      fireEvent.click(membersTab);
      expect(screen.getAllByText('Carlos Proprietário')[0]).toBeInTheDocument();

      // Open invite modal via overview card button (ensure status is active so button is enabled)
      act(() => {
        useAccountStore.setState({
          accountDetails: {
            ...mockAccountDetails,
            plan: 'pro',
            status: 'active',
            isOverQuota: false,
            activeUsersCount: 5,
            maxUsers: 20,
          },
        });
      });
      const inviteBtn = screen.getByRole('button', { name: /Convidar Membro/i });
      fireEvent.click(inviteBtn);
      expect(screen.getByText(/Convidar Novo Membro/i)).toBeInTheDocument();

      // Close invite modal
      const closeBtn = screen.getByRole('button', { name: /Fechar/i });
      fireEvent.click(closeBtn);

      // Test Voltar ao Chat navigation
      const backBtn = screen.getByRole('button', { name: /Voltar ao Chat/i });
      fireEvent.click(backBtn);
    });
  });
});
