import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteMemberModal } from '../components/account/InviteMemberModal';
import { UpgradeCheckoutModal } from '../components/account/UpgradeCheckoutModal';
import { VerifyHashModal } from '../components/signatures/VerifyHashModal';
import { SignatureDetailsModal } from '../components/signatures/SignatureDetailsModal';
import { NewChatModal } from '../components/chat/NewChatModal';
import { useSignatureStore } from '../stores/signature.store';

describe('Account & Signature Modals UI Coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('InviteMemberModal', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <InviteMemberModal isOpen={false} onClose={vi.fn()} onInvite={vi.fn()} />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('submits email and role successfully, and copies link', async () => {
      const onInviteMock = vi.fn().mockResolvedValue({ inviteUrl: '/invite/token-abc' });
      const onCloseMock = vi.fn();

      render(<InviteMemberModal isOpen={true} onClose={onCloseMock} onInvite={onInviteMock} />);

      const input = screen.getByPlaceholderText(/exemplo@suaempresa\.com/i);
      fireEvent.change(input, { target: { value: 'novo@empresa.com' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'admin' } });

      const submitBtn = screen.getByRole('button', { name: /Gerar Link de Convite/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onInviteMock).toHaveBeenCalledWith('novo@empresa.com', 'admin');
        expect(screen.getByText(/Convite Criado com Sucesso!/i)).toBeInTheDocument();
      });

      // Copy link
      const writeTextMock = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });
      const copyBtn = screen.getByRole('button', { name: /Copiar Link/i });
      fireEvent.click(copyBtn);
      expect(writeTextMock).toHaveBeenCalled();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /Concluir/i });
      fireEvent.click(closeBtn);
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('displays error message on submission failure', async () => {
      const onInviteMock = vi.fn().mockRejectedValue(new Error('Limite de membros atingido'));

      render(<InviteMemberModal isOpen={true} onClose={vi.fn()} onInvite={onInviteMock} />);

      const input = screen.getByPlaceholderText(/exemplo@suaempresa\.com/i);
      fireEvent.change(input, { target: { value: 'err@empresa.com' } });

      const submitBtn = screen.getByRole('button', { name: /Gerar Link de Convite/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Limite de membros atingido')).toBeInTheDocument();
      });
    });
  });

  describe('UpgradeCheckoutModal', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <UpgradeCheckoutModal
          isOpen={false}
          onClose={vi.fn()}
          targetPlan="pro"
          billingCycle="monthly"
          onSubmitCheckout={vi.fn()}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('submits checkout form with PIX payment method', async () => {
      const onSubmitCheckoutMock = vi.fn().mockResolvedValue(undefined);
      const onCloseMock = vi.fn();

      render(
        <UpgradeCheckoutModal
          isOpen={true}
          onClose={onCloseMock}
          targetPlan="pro"
          billingCycle="monthly"
          onSubmitCheckout={onSubmitCheckoutMock}
        />
      );

      expect(screen.getByText(/Assinatura Plano Pro/i)).toBeInTheDocument();

      // Fill in required customer info
      fireEvent.change(screen.getByPlaceholderText(/Nome Completo/i), {
        target: { value: 'Acme LTDA' },
      });
      fireEvent.change(screen.getByPlaceholderText(/financeiro@empresa\.com/i), {
        target: { value: 'financeiro@acme.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/000\.000\.000-00/i), {
        target: { value: '12.345.678/0001-90' },
      });
      fireEvent.change(screen.getByPlaceholderText(/\(11\) 99999-9999/i), {
        target: { value: '11988887777' },
      });
      fireEvent.change(screen.getByPlaceholderText(/00000-000/i), {
        target: { value: '01310-100' },
      });
      fireEvent.change(screen.getByPlaceholderText(/123/i), {
        target: { value: '100' },
      });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Gerar Cobrança Asaas/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmitCheckoutMock).toHaveBeenCalled();
      });
    });

    it('renders checkout result with PIX copy/paste code and copy button', () => {
      const writeTextMock = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(
        <UpgradeCheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          targetPlan="pro"
          billingCycle="yearly"
          onSubmitCheckout={vi.fn()}
          checkoutResult={{
            pixQrCode: 'mock',
            pixCopyPaste: '00020126580014br.gov.bcb.pix...',
          }}
        />
      );

      expect(screen.getByText(/Pague via Pix para Ativação Instantânea/i)).toBeInTheDocument();

      const copyBtn = screen.getByRole('button', { name: /Copiar/i });
      fireEvent.click(copyBtn);
      expect(writeTextMock).toHaveBeenCalledWith('00020126580014br.gov.bcb.pix...');
    });

    it('submits checkout form with credit card payment method and validates fields', async () => {
      const onSubmitCheckoutMock = vi.fn().mockResolvedValue(undefined);

      const { container } = render(
        <UpgradeCheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          targetPlan="enterprise"
          billingCycle="yearly"
          onSubmitCheckout={onSubmitCheckoutMock}
        />
      );

      // Select Credit Card
      fireEvent.click(screen.getByText('Cartão de Crédito'));

      // Fill basic customer info
      fireEvent.change(screen.getByPlaceholderText(/Nome Completo/i), {
        target: { value: 'Tech Corp' },
      });
      fireEvent.change(screen.getByPlaceholderText(/financeiro@empresa\.com/i), {
        target: { value: 'tech@corp.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/000\.000\.000-00/i), {
        target: { value: '11222333000199' },
      });

      // Submit via form to trigger CC validation
      const form = container.querySelector('form')!;
      fireEvent.submit(form);
      expect(
        screen.getByText(/Por favor preencha todos os dados do cartão de crédito/i)
      ).toBeInTheDocument();

      // Fill CC fields
      fireEvent.change(screen.getByPlaceholderText('NOME COMO NO CARTAO'), {
        target: { value: 'TECH CORP' },
      });
      fireEvent.change(screen.getByPlaceholderText('0000 0000 0000 0000'), {
        target: { value: '4111111111111111' },
      });
      fireEvent.change(screen.getByPlaceholderText('12'), { target: { value: '11' } });
      fireEvent.change(screen.getByPlaceholderText('28'), { target: { value: '29' } });
      const ccvInput = container.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(ccvInput, { target: { value: '999' } });

      fireEvent.submit(form);
      await waitFor(() => {
        expect(onSubmitCheckoutMock).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentMethod: 'credit_card',
            creditCard: expect.objectContaining({
              holderName: 'TECH CORP',
              number: '4111111111111111',
            }),
          })
        );
      });
    });

    it('renders checkout result with Boleto link and invoice link', () => {
      render(
        <UpgradeCheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          targetPlan="pro"
          billingCycle="monthly"
          onSubmitCheckout={vi.fn()}
          checkoutResult={{
            bankSlipUrl: 'https://asaas.com/boleto-123',
            invoiceUrl: 'https://asaas.com/invoice-123',
          }}
        />
      );

      expect(screen.getByText(/Boleto Bancário Gerado/i)).toBeInTheDocument();
      expect(screen.getByText(/Visualizar \/ Imprimir Boleto/i)).toBeInTheDocument();
    });
  });

  describe('VerifyHashModal', () => {
    it('does not render when isOpen is false or signatureId is null', () => {
      const { container } = render(
        <VerifyHashModal isOpen={false} onClose={vi.fn()} signatureId="sig-1" />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('verifies SHA-256 hash input successfully', async () => {
      const verifyMock = vi.fn().mockResolvedValue({
        isValid: true,
        matchesOriginal: true,
        matchesSigned: false,
        originalSha256: 'a1b2c3d4',
      });
      useSignatureStore.setState({
        verifyDocumentHash: verifyMock,
        verificationResult: null,
      });

      render(<VerifyHashModal isOpen={true} onClose={vi.fn()} signatureId="sig-1" />);

      expect(screen.getByText(/Autenticidade e Integridade/i)).toBeInTheDocument();

      const hashInput = screen.getByPlaceholderText(/Ex: 8f47b567a9d.../i);
      const testHash = 'a'.repeat(64);
      fireEvent.change(hashInput, { target: { value: testHash } });

      const verifyBtn = screen.getByRole('button', { name: /Verificar Autenticidade/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(verifyMock).toHaveBeenCalledWith('sig-1', { sha256: testHash });
      });
    });

    it('displays validation results for original matched document', () => {
      useSignatureStore.setState({
        verificationResult: {
          isValid: true,
          matchesOriginal: true,
          matchesSigned: false,
          originalSha256: '1234',
          signedSha256: null,
          documentId: 'sig-1',
          documentName: 'contrato.pdf',
          status: 'running',
          providedSha256: '1234',
        },
      });

      render(<VerifyHashModal isOpen={true} onClose={vi.fn()} signatureId="sig-1" />);

      expect(screen.getByText(/Autenticidade Confirmada!/i)).toBeInTheDocument();
      expect(screen.getByText(/VÁLIDO/i)).toBeInTheDocument();
    });

    it('displays validation failure when hash does not match', () => {
      useSignatureStore.setState({
        verificationResult: {
          isValid: false,
          matchesOriginal: false,
          matchesSigned: false,
          originalSha256: '1234',
          signedSha256: '5678',
          documentId: 'sig-1',
          documentName: 'contrato.pdf',
          status: 'closed',
          providedSha256: '9999',
        },
      });

      render(<VerifyHashModal isOpen={true} onClose={vi.fn()} signatureId="sig-1" />);

      expect(screen.getByText(/Hash Divergente ou Documento Adulterado/i)).toBeInTheDocument();
      expect(screen.getByText(/INVÁLIDO/i)).toBeInTheDocument();
    });

    it('handles file selection, computes hash, and clears file', async () => {
      const { container } = render(
        <VerifyHashModal isOpen={true} onClose={vi.fn()} signatureId="sig-1" />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const testFile = new File(['conteudo para hash'], 'arquivo.pdf', { type: 'application/pdf' });
      // Mock arrayBuffer
      testFile.arrayBuffer = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode('conteudo para hash'));

      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        expect(screen.getByText('arquivo.pdf')).toBeInTheDocument();
      });

      // Clear file
      const clearBtn = screen.getByRole('button', { name: 'Remover' });
      fireEvent.click(clearBtn);
    });
  });

  describe('SignatureDetailsModal & NewChatModal Direct', () => {
    it('handles onOpenVerifyHash and empty events in SignatureDetailsModal', () => {
      const mockSignature: any = {
        id: 'sig-test-1',
        title: 'Contrato de Parceria',
        status: 'closed',
        deadlineAt: null,
        totalSigners: 1,
        signedCount: 1,
        signers: [
          {
            id: 's1',
            name: 'Carlos Dev',
            email: 'carlos@empresa.com',
            status: 'signed',
            authType: 'email',
            signAs: 'sign',
            signedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const onClose = vi.fn();
      const onOpenVerifyHash = vi.fn();

      useSignatureStore.setState({
        activeSignature: mockSignature,
        evidenceReport: {
          documentId: 'sig-test-1',
          documentName: 'contrato.pdf',
          originalSha256: 'abc1',
          signedSha256: 'abc2',
          legalFramework: 'MP 2.200-2/2001',
          events: [], // empty events
        } as any,
      });

      render(
        <SignatureDetailsModal
          isOpen={true}
          onClose={onClose}
          signatureId="sig-test-1"
          onOpenVerifyHash={onOpenVerifyHash}
        />
      );

      // Switch to evidence tab
      const evidenceTab = screen.getByText(/Trilha de Evidências/i);
      fireEvent.click(evidenceTab);

      // Verify empty events notice
      expect(screen.getByText(/Nenhum evento registrado ainda/i)).toBeInTheDocument();

      // Click verify hash button
      const verifyHashBtn = screen.getByRole('button', { name: /Verificar Hash/i });
      fireEvent.click(verifyHashBtn);

      expect(onClose).toHaveBeenCalled();
      expect(onOpenVerifyHash).toHaveBeenCalledWith('sig-test-1');
    });

    it('simulates signing and copies sign URL in SignatureDetailsModal', async () => {
      const simulateSignMock = vi.fn().mockResolvedValue({});
      const writeTextMock = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      const pendingSignature: any = {
        id: 'sig-test-2',
        title: 'Acordo Comercial',
        documentName: 'acordo.pdf',
        originalSha256: 'sha-orig-1234',
        status: 'running',
        deadlineAt: null,
        totalSigners: 1,
        signersCount: 1,
        signedCount: 0,
        signers: [
          {
            id: 'signer-pending',
            name: 'Bob Dev',
            email: 'bob@empresa.com',
            status: 'pending',
            authType: 'email',
            signAs: 'sign',
            signUrl: 'https://corpchat.app/sign/token-bob',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      useSignatureStore.setState({
        activeSignature: pendingSignature,
        simulateSign: simulateSignMock,
      });

      render(<SignatureDetailsModal isOpen={true} onClose={vi.fn()} signatureId="sig-test-2" />);

      // Copy sign link
      const copyLinkBtn = screen.getByTitle(/Copiar link de assinatura/i);
      fireEvent.click(copyLinkBtn);
      expect(screen.getByText('Copiado!')).toBeInTheDocument();

      // Simulate sign
      const simulateBtn = screen.getByRole('button', { name: /Simular Assinatura/i });
      fireEvent.click(simulateBtn);
      expect(simulateSignMock).toHaveBeenCalledWith('sig-test-2', 'signer-pending');
    });

    it('creates a direct conversation in NewChatModal', async () => {
      const onCreateDirect = vi.fn().mockResolvedValue({});
      const onClose = vi.fn();

      render(
        <NewChatModal
          isOpen={true}
          onClose={onClose}
          onCreateGroup={vi.fn()}
          onCreateDirect={onCreateDirect}
        />
      );

      // Switch to direct tab
      const directTab = screen.getByText(/Direto 1:1/i);
      fireEvent.click(directTab);

      const input = screen.getByPlaceholderText(/Ex: colaborador@empresa.com/i);
      fireEvent.change(input, { target: { value: 'target-user-123' } });

      const submitBtn = screen.getByRole('button', { name: /Iniciar Conversa/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onCreateDirect).toHaveBeenCalledWith('target-user-123');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
