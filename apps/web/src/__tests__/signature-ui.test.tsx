import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignatureCard } from '../components/signatures/SignatureCard';
import { CreateSignatureModal } from '../components/signatures/CreateSignatureModal';
import { SignatureDetailsModal } from '../components/signatures/SignatureDetailsModal';
import { VerifyHashModal } from '../components/signatures/VerifyHashModal';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatPanel } from '../components/chat/ChatPanel';
import { useAuthStore } from '../stores/auth.store';
import { useSignatureStore } from '../stores/signature.store';
import { api } from '../services/api';
import { SignatureRequestResponse, SignatureEvidenceReport } from '@corpchat/shared';

// Mock api
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock URL.createObjectURL and revokeObjectURL
window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
window.URL.revokeObjectURL = vi.fn();

describe('Electronic Signatures Frontend (T-34)', () => {
  const mockSignature: SignatureRequestResponse = {
    id: 'sig-test-123',
    accountId: 'acc-enterprise-1',
    conversationId: 'conv-1',
    creatorId: 'user-1',
    provider: 'clicksign',
    externalDocumentKey: 'doc-clicksign-abc',
    autoClose: true,
    title: 'Contrato de Parceria Estratégica 2026',
    documentName: 'contrato_parceria.pdf',
    originalSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    signedSha256: 'f0e1d2c3b4a59876543210fedcba9876543210fedcba9876543210fedcba9876',
    status: 'running',
    signersCount: 2,
    signedCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    signers: [
      {
        id: 'signer-1',
        signatureRequestId: 'sig-test-123',
        name: 'Carlos Mendes',
        email: 'carlos@mendes.com.br',
        authType: 'email',
        signAs: 'sign',
        groupOrder: 1,
        status: 'signed',
        signUrl: 'https://sandbox.clicksign.com/sign/signer-1',
        signedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'signer-2',
        signatureRequestId: 'sig-test-123',
        name: 'Mariana Silva',
        email: 'mariana@silva.com.br',
        authType: 'whatsapp',
        signAs: 'sign',
        groupOrder: 1,
        status: 'pending',
        signUrl: 'https://sandbox.clicksign.com/sign/signer-2',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const mockEvidenceReport: SignatureEvidenceReport = {
    documentKey: 'doc-clicksign-abc',
    documentName: 'contrato_parceria.pdf',
    originalDocSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    signedDocSha256: 'f0e1d2c3b4a59876543210fedcba9876543210fedcba9876543210fedcba9876',
    status: 'running',
    legalFramework: 'Lei Federal nº 14.063/2020 e MP 2.200-2/2001',
    createdAt: new Date().toISOString(),
    events: [
      {
        signerName: 'Carlos Mendes',
        signerEmail: 'carlos@mendes.com.br',
        signatureRole: 'sign',
        authType: 'email',
        ipAddress: '189.40.21.99',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        signedAt: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-1',
        accountId: 'acc-enterprise-1',
        name: 'Diretoria Jurídica',
        email: 'juridico@enterprise.com',
        role: 'owner',
        status: 'active',
      },
      account: {
        id: 'acc-enterprise-1',
        name: 'Enterprise Corp',
        plan: 'enterprise',
        status: 'active',
      },
      isAuthenticated: true,
    });

    useSignatureStore.setState({
      signatures: [mockSignature],
      activeSignature: mockSignature,
      evidenceReport: mockEvidenceReport,
      verificationResult: null,
      isLoading: false,
      error: null,
    });
  });

  describe('1. CreateSignatureModal Component', () => {
    it('shows Enterprise plan requirement warning for Free/Pro accounts', () => {
      useAuthStore.setState({
        account: {
          id: 'acc-free-1',
          name: 'Free Account',
          plan: 'free',
          status: 'active',
        },
      });

      const onNavigate = vi.fn();
      render(
        <CreateSignatureModal
          isOpen={true}
          onClose={() => {}}
          conversationId="conv-1"
          onSubmit={async () => {}}
          onNavigateToPlans={onNavigate}
        />
      );

      expect(screen.getByText(/Recurso Exclusivo do Plano Enterprise/i)).toBeInTheDocument();
      expect(screen.getByText(/Fazer Upgrade para Enterprise/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Fazer Upgrade para Enterprise/i));
      expect(onNavigate).toHaveBeenCalled();
    });

    it('renders form for Enterprise accounts, dynamically manages signers and submits', async () => {
      const onSubmitMock = vi.fn(async () => {});
      const onCloseMock = vi.fn();

      render(
        <CreateSignatureModal
          isOpen={true}
          onClose={onCloseMock}
          conversationId="conv-1"
          onSubmit={onSubmitMock}
        />
      );

      expect(screen.getByText(/Nova Solicitação de Assinatura Eletrônica/i)).toBeInTheDocument();

      // Add second signer
      const addSignerBtn = screen.getByText(/Adicionar Signatário/i);
      fireEvent.click(addSignerBtn);

      expect(screen.getByText(/Signatário #2/i)).toBeInTheDocument();

      // Fill signer 1
      const nameInputs = screen.getAllByPlaceholderText(/Nome completo \*/i);
      const emailInputs = screen.getAllByPlaceholderText(/E-mail corporativo \*/i);

      fireEvent.change(nameInputs[0], { target: { value: 'João Silva' } });
      fireEvent.change(emailInputs[0], { target: { value: 'joao@silva.com' } });

      // Fill signer 2
      fireEvent.change(nameInputs[1], { target: { value: 'Maria Oliveira' } });
      fireEvent.change(emailInputs[1], { target: { value: 'maria@oliveira.com' } });

      // Simulate PDF file selection
      const file = new File(['%PDF-1.4 mock content'], 'acordo_comercial.pdf', {
        type: 'application/pdf',
      });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      // Dispatch file upload
      Object.defineProperty(fileInput, 'files', {
        value: [file],
      });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('acordo_comercial.pdf')).toBeInTheDocument();
      });

      // Submit form
      const submitBtn = screen.getByText(/Enviar para Assinatura/i);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmitMock).toHaveBeenCalledWith(
          expect.objectContaining({
            conversationId: 'conv-1',
            title: 'acordo_comercial',
            documentName: 'acordo_comercial.pdf',
            signers: expect.arrayContaining([
              expect.objectContaining({ name: 'João Silva', email: 'joao@silva.com' }),
              expect.objectContaining({ name: 'Maria Oliveira', email: 'maria@oliveira.com' }),
            ]),
          })
        );
      });
    });
  });

  describe('2. SignatureCard Component', () => {
    it('renders signature envelope card in chat with progress and actions', () => {
      const onOpenDetails = vi.fn();
      const onDownloadSigned = vi.fn();
      const onOpenVerifyHash = vi.fn();

      render(
        <SignatureCard
          signature={mockSignature}
          isSelf={false}
          onOpenDetails={onOpenDetails}
          onDownloadSigned={onDownloadSigned}
          onOpenVerifyHash={onOpenVerifyHash}
        />
      );

      expect(screen.getByText('Contrato de Parceria Estratégica 2026')).toBeInTheDocument();
      expect(screen.getByText('contrato_parceria.pdf')).toBeInTheDocument();
      expect(screen.getByText('1 de 2 (50%)')).toBeInTheDocument();
      expect(screen.getByText(/SHA-256: a1b2c3d4e5f67890/i)).toBeInTheDocument();

      // Click Acompanhar & Assinar
      const detailsBtn = screen.getByText(/Acompanhar & Assinar/i);
      fireEvent.click(detailsBtn);
      expect(onOpenDetails).toHaveBeenCalledWith('sig-test-123');

      // Click verify hash icon
      const verifyBtn = screen.getByTitle(/Verificar Hash de Autenticidade/i);
      fireEvent.click(verifyBtn);
      expect(onOpenVerifyHash).toHaveBeenCalledWith('sig-test-123');
    });

    it('renders Assinado badge and Download button when status is closed', () => {
      const closedSignature = { ...mockSignature, status: 'closed' as const, signedCount: 2 };
      const onDownload = vi.fn();

      render(
        <SignatureCard
          signature={closedSignature}
          onOpenDetails={() => {}}
          onDownloadSigned={onDownload}
        />
      );

      expect(screen.getByText(/Assinado/i)).toBeInTheDocument();
      expect(screen.getByText(/Baixar PDF/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Baixar PDF/i));
      expect(onDownload).toHaveBeenCalledWith('sig-test-123');
    });
  });

  describe('3. SignatureDetailsModal Component', () => {
    it('renders signers list, simulates signing, and switches to evidence audit trail tab', async () => {
      (api.get as any).mockImplementation((url: string) => {
        if (url.includes('/evidence')) return Promise.resolve(mockEvidenceReport);
        return Promise.resolve(mockSignature);
      });

      const updatedAfterSign = {
        ...mockSignature,
        signedCount: 2,
        status: 'closed' as const,
        signers: mockSignature.signers.map((s) => ({ ...s, status: 'signed' as const })),
      };
      (api.post as any).mockResolvedValue(updatedAfterSign);

      const onClose = vi.fn();
      render(<SignatureDetailsModal isOpen={true} onClose={onClose} signatureId="sig-test-123" />);

      expect(screen.getByText(/Acompanhamento do Documento Eletrônico/i)).toBeInTheDocument();
      expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
      expect(screen.getByText('Mariana Silva')).toBeInTheDocument();

      // Click "Simular Assinatura" on pending signer Mariana Silva
      const simulateBtn = screen.getByText(/Simular Assinatura/i);
      fireEvent.click(simulateBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/signatures/sig-test-123/signers/signer-2/simulate',
          {}
        );
      });

      // Switch to Evidence Audit Trail Tab
      const evidenceTab = screen.getByText(/Trilha de Evidências/i);
      fireEvent.click(evidenceTab);

      expect(screen.getByText(/Validade Jurídica:/i)).toBeInTheDocument();
      expect(screen.getByText(/189.40.21.99/i)).toBeInTheDocument();
    });
  });

  describe('4. VerifyHashModal Component', () => {
    it('verifies SHA-256 hash against backend and displays authentic badge', async () => {
      const mockResult = {
        documentId: 'sig-test-123',
        documentName: 'contrato.pdf',
        providedSha256: 'f0e1d2c3b4a59876543210fedcba9876543210fedcba9876543210fedcba9876',
        originalSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        signedSha256: 'f0e1d2c3b4a59876543210fedcba9876543210fedcba9876543210fedcba9876',
        matchesOriginal: false,
        matchesSigned: true,
        isValid: true,
        status: 'closed' as const,
      };

      (api.post as any).mockResolvedValue(mockResult);

      const onClose = vi.fn();
      render(<VerifyHashModal isOpen={true} onClose={onClose} signatureId="sig-test-123" />);

      expect(
        screen.getByText(/Verificação de Autenticidade e Integridade \(SHA-256\)/i)
      ).toBeInTheDocument();

      // Input 64 char hash
      const hashInput = screen.getByPlaceholderText(/Ex: 8f47b567a9d.../i);
      fireEvent.change(hashInput, {
        target: { value: 'f0e1d2c3b4a59876543210fedcba9876543210fedcba9876543210fedcba9876' },
      });

      // Click verify
      const verifyBtn = screen.getByText(/Verificar Autenticidade/i);
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/signatures/sig-test-123/verify-hash',
          expect.objectContaining({
            sha256: 'f0e1d2c3b4a59876543210fedcba9876543210fedcba9876543210fedcba9876',
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/Autenticidade Confirmada!/i)).toBeInTheDocument();
        expect(screen.getByText('VÁLIDO')).toBeInTheDocument();
      });
    });
  });

  describe('5. Chat Integration (MessageBubble & ChatPanel)', () => {
    it('renders SignatureCard inside MessageBubble when message type is signature', () => {
      const msg: any = {
        id: 'msg-sig-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'Solicitação de Assinatura Eletrônica: Contrato de Parceria Estratégica 2026',
        type: 'signature',
        status: 'delivered',
        isSelf: true,
        createdAt: new Date().toISOString(),
        metadata: {
          signature: mockSignature,
        },
      };

      render(<MessageBubble message={msg} />);
      expect(screen.getByText('Contrato de Parceria Estratégica 2026')).toBeInTheDocument();
      expect(screen.getByText('contrato_parceria.pdf')).toBeInTheDocument();
    });

    it('renders signature button in ChatPanel header and composer for initiating signatures', () => {
      const conv: any = {
        id: 'conv-1',
        type: 'direct',
        status: 'active',
        otherUser: { id: 'user-2', name: 'Dr. Roberto', role: 'member' },
      };

      render(
        <ChatPanel
          conversation={conv}
          messages={[]}
          onSendMessage={async () => {}}
          onSendTyping={() => {}}
        />
      );

      const sigButtons = screen.getAllByTitle(/Solicitar Assinatura Eletrônica \(Enterprise\)/i);
      expect(sigButtons.length).toBeGreaterThan(0);

      fireEvent.click(sigButtons[0]);
      expect(screen.getByText(/Nova Solicitação de Assinatura Eletrônica/i)).toBeInTheDocument();
    });
  });
});
