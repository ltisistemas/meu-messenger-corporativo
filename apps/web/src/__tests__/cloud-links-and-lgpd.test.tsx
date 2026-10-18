import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloudLinkCard } from '../components/chat/CloudLinkCard';
import { LgpdPrivacySection } from '../components/account/LgpdPrivacySection';
import { InvoicesHistorySection } from '../components/account/InvoicesHistorySection';
import { QuotaWarningBanner } from '../components/account/QuotaWarningBanner';
import { api } from '../services/api';
import { useAuthStore } from '../stores/auth.store';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('CloudLinkCard & LGPD Privacy Section Deep Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CloudLinkCard Provider & Resource Variations', () => {
    it('renders google-drive provider with various resource types', () => {
      const gDriveFolder: any = {
        url: 'https://drive.google.com/drive/folders/123',
        provider: 'google-drive',
        domain: 'drive.google.com',
        title: 'Documentos Squad Alfa',
        resourceType: 'folder',
      };

      const { rerender } = render(<CloudLinkCard link={gDriveFolder} isSelf={false} />);
      expect(screen.getByText('Google Drive')).toBeInTheDocument();
      expect(screen.getByText('Documentos Squad Alfa')).toBeInTheDocument();
      expect(screen.getByText('Abrir no Google Drive')).toBeInTheDocument();

      // Test spreadsheet
      rerender(
        <CloudLinkCard
          link={{ ...gDriveFolder, resourceType: 'spreadsheet', title: 'Planilha Q1' }}
          isSelf={true}
        />
      );
      expect(screen.getByText('Planilha Q1')).toBeInTheDocument();

      // Test presentation
      rerender(
        <CloudLinkCard
          link={{ ...gDriveFolder, resourceType: 'presentation', title: 'Pitch Deck' }}
          isSelf={false}
        />
      );
      expect(screen.getByText('Pitch Deck')).toBeInTheDocument();
    });

    it('renders onedrive / sharepoint provider', () => {
      const oneDriveDoc: any = {
        url: 'https://company.sharepoint.com/:w:/r/doc1',
        provider: 'onedrive',
        domain: 'company.sharepoint.com',
        title: 'Políticas Internas.docx',
        resourceType: 'document',
      };

      render(<CloudLinkCard link={oneDriveDoc} isSelf={false} />);
      expect(screen.getByText('SharePoint / OneDrive')).toBeInTheDocument();
      expect(screen.getByText('Políticas Internas.docx')).toBeInTheDocument();
      expect(screen.getByText('Abrir no OneDrive')).toBeInTheDocument();
    });

    it('renders dropbox and box providers with archive and image resources', () => {
      const dropboxArchive: any = {
        url: 'https://dropbox.com/s/xyz/assets.zip',
        provider: 'dropbox',
        domain: 'dropbox.com',
        title: 'assets.zip',
        resourceType: 'archive',
      };

      const { rerender } = render(<CloudLinkCard link={dropboxArchive} isSelf={true} />);
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
      expect(screen.getByText('assets.zip')).toBeInTheDocument();

      const boxImage: any = {
        url: 'https://app.box.com/s/xyz/photo.png',
        provider: 'box',
        domain: 'app.box.com',
        title: 'photo.png',
        resourceType: 'image',
      };
      rerender(<CloudLinkCard link={boxImage} isSelf={false} />);
      expect(screen.getByText('Box')).toBeInTheDocument();

      const genericFile: any = {
        url: 'https://externo.com/doc.pdf',
        provider: 'generic',
        domain: 'externo.com',
        title: 'Contrato.pdf',
        resourceType: 'file',
      };
      rerender(<CloudLinkCard link={genericFile} isSelf={false} />);
      expect(screen.getByText('Link Externo')).toBeInTheDocument();
    });
  });

  describe('LgpdPrivacySection Component', () => {
    const mockPolicy = {
      version: '2026.2',
      lastUpdated: '2026-03-01T00:00:00.000Z',
      dpoContact: 'dpo@empresa.com',
      rights: ['Acesso e confirmação de dados', 'Revogação de consentimento'],
      retentionPolicies: {
        free: 'Zero retenção de arquivos em disco.',
        pro: 'Arquivos com retenção temporária de 5 dias.',
        enterprise: 'Retenção configurável.',
      },
      legalBases: ['Consentimento', 'Legítimo Interesse'],
    };

    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: 'u-1',
          name: 'Alice',
          email: 'alice@empresa.com',
          role: 'owner',
          status: 'active',
          accountId: 'acc-1',
        },
      });
      vi.mocked(api.get).mockResolvedValue(mockPolicy);
    });

    it('loads and displays privacy policy and exports personal data', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) => {
        if (url === '/lgpd/privacy-policy') {
          return mockPolicy;
        }
        if (url === '/lgpd/export') {
          return { user: { name: 'Alice' }, auditLogs: [] };
        }
        return {};
      });

      // Mock URL.createObjectURL
      window.URL.createObjectURL = vi.fn(() => 'blob:mock');
      window.URL.revokeObjectURL = vi.fn();

      render(<LgpdPrivacySection userRole="owner" userEmail="alice@empresa.com" />);

      expect(await screen.findByText('dpo@empresa.com')).toBeInTheDocument();
      expect(screen.getByText(/Versão da Política: 2026.2/i)).toBeInTheDocument();

      // Export data
      const exportBtn = screen.getByRole('button', { name: /Baixar Meus Dados \(JSON\)/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/lgpd/export');
        expect(
          screen.getByText(/Arquivo JSON gerado e download iniciado com sucesso!/i)
        ).toBeInTheDocument();
      });
    });

    it('opens account deletion modal, validates confirmation text and deletes account', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({});
      window.alert = vi.fn();
      const logoutSpy = vi.fn();
      useAuthStore.setState({ logout: logoutSpy });

      render(<LgpdPrivacySection userRole="owner" userEmail="alice@empresa.com" />);

      await screen.findByText('dpo@empresa.com');

      const openDeleteBtn = screen.getByRole('button', { name: /Excluir Minha Conta/i });
      fireEvent.click(openDeleteBtn);

      expect(screen.getByText(/Confirmar Exclusão de Conta/i)).toBeInTheDocument();

      // Missing confirmation text
      const confirmDeleteBtn = screen.getByRole('button', { name: /Excluir Definitivamente/i });
      expect(confirmDeleteBtn).toBeDisabled();

      // Fill wrong confirmation
      const confirmInput = screen.getByPlaceholderText('EXCLUIR');
      fireEvent.change(confirmInput, { target: { value: 'quero excluir' } });
      expect(confirmDeleteBtn).toBeDisabled();

      // Fill correct confirmation and password
      fireEvent.change(confirmInput, { target: { value: 'EXCLUIR' } });
      const passwordInput = screen.getByPlaceholderText('Sua senha de acesso');
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(confirmDeleteBtn).not.toBeDisabled();
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/lgpd/delete-account', {
          password: 'password123',
          confirmationText: 'EXCLUIR',
        });
        expect(logoutSpy).toHaveBeenCalled();
      });
    });

    it('renders generic cloud link and additional resource types', () => {
      const genericLink: any = {
        url: 'https://externo.com/doc',
        provider: 'generic',
        providerName: 'Servidor Externo',
        domain: 'externo.com',
        title: 'Arquivo Zip & Design',
        resourceType: 'archive',
      };

      const { rerender } = render(<CloudLinkCard link={genericLink} isSelf={true} />);
      expect(screen.getByText('Servidor Externo')).toBeInTheDocument();
      expect(screen.getByText('Acessar Link')).toBeInTheDocument();

      // Test design, page, image, figma, and notion
      rerender(<CloudLinkCard link={{ ...genericLink, resourceType: 'design' }} isSelf={false} />);
      rerender(<CloudLinkCard link={{ ...genericLink, resourceType: 'page' }} isSelf={false} />);
      rerender(<CloudLinkCard link={{ ...genericLink, resourceType: 'image' }} isSelf={false} />);

      // Figma & Notion
      rerender(
        <CloudLinkCard
          link={{
            ...genericLink,
            provider: 'figma',
            providerName: 'Figma',
            title: 'Design System',
          }}
          isSelf={true}
        />
      );
      expect(screen.getByText('Visualizar no Figma')).toBeInTheDocument();

      rerender(
        <CloudLinkCard
          link={{ ...genericLink, provider: 'notion', providerName: 'Notion', title: 'Wiki Docs' }}
          isSelf={false}
        />
      );
      expect(screen.getByText('Abrir no Notion')).toBeInTheDocument();
    });
  });

  describe('InvoicesHistorySection & QuotaWarningBanner Edge Cases', () => {
    it('renders empty invoices list and different invoice statuses', () => {
      const onCancelSubscription = vi.fn();
      const emptySummary: any = {
        subscription: null,
        invoices: [],
      };

      const { rerender } = render(
        <InvoicesHistorySection
          billingSummary={emptySummary}
          onCancelSubscription={onCancelSubscription}
        />
      );

      expect(screen.getByText(/Nenhuma fatura registrada/i)).toBeInTheDocument();

      // Render with active sub, cancel confirmation flow, and various invoice statuses
      const detailedSummary: any = {
        subscription: {
          id: 'sub-1',
          plan: 'enterprise',
          status: 'active',
          billingCycle: 'yearly',
          amountCents: 49900,
          currentPeriodEnd: '2026-12-31T00:00:00.000Z',
          cancelAtPeriodEnd: false,
          paymentMethod: 'boleto',
        },
        invoices: [
          {
            id: 'inv-1',
            amountCents: 49900,
            status: 'pending',
            dueDate: '2026-10-30T00:00:00.000Z',
            paymentMethod: 'boleto',
            bankSlipUrl: 'https://asaas.com/boleto.pdf',
            createdAt: '2026-10-12T00:00:00.000Z',
          },
          {
            id: 'inv-2',
            amountCents: 49900,
            status: 'overdue',
            dueDate: '2026-09-30T00:00:00.000Z',
            paymentMethod: 'pix',
            pdfUrl: 'https://asaas.com/fatura2.pdf',
            createdAt: '2026-09-12T00:00:00.000Z',
          },
          {
            id: 'inv-3',
            amountCents: 49900,
            status: 'canceled',
            dueDate: '2026-08-30T00:00:00.000Z',
            paymentMethod: 'credit_card',
            createdAt: '2026-08-12T00:00:00.000Z',
          },
        ],
      };

      rerender(
        <InvoicesHistorySection
          billingSummary={detailedSummary}
          onCancelSubscription={onCancelSubscription}
        />
      );

      expect(screen.getByText('Boleto')).toBeInTheDocument();
      expect(screen.getByText('Vencida')).toBeInTheDocument();
      expect(screen.getByText('Cancelada')).toBeInTheDocument();

      // Test cancel confirmation flow
      const cancelBtn = screen.getByText('Cancelar Renovação');
      fireEvent.click(cancelBtn);

      expect(screen.getByText('Confirmar cancelamento?')).toBeInTheDocument();
      const backBtn = screen.getByText('Voltar');
      fireEvent.click(backBtn);

      fireEvent.click(screen.getByText('Cancelar Renovação'));
      const confirmBtn = screen.getByText('Sim, Cancelar');
      fireEvent.click(confirmBtn);
      expect(onCancelSubscription).toHaveBeenCalled();
    });

    it('renders QuotaWarningBanner trial state with upgrade action', () => {
      const onUpgrade = vi.fn();
      render(
        <QuotaWarningBanner isTrialing={true} trialDaysRemaining={7} onUpgradeClick={onUpgrade} />
      );

      expect(screen.getByText(/Trial Pro de 14 dias/i)).toBeInTheDocument();
      expect(screen.getByText(/7 dias restantes/i)).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /Assinar Plano Pro/i });
      fireEvent.click(btn);
      expect(onUpgrade).toHaveBeenCalled();
    });
  });
});
