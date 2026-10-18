import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { ClicksignProviderService } from '../services/clicksign.service.js';
import { SignatureEvidenceReportSchema } from '@/shared';

describe('Clicksign Signature Provider Spike & Sandbox Test (T-31)', () => {
  let clicksignService: ClicksignProviderService;
  const samplePdfContent = Buffer.from(
    '%PDF-1.4 Mock Contract Content for Corporate Messenger Sandbox Testing'
  ).toString('base64');

  beforeEach(() => {
    vi.clearAllMocks();
    clicksignService = new ClicksignProviderService(
      'mock-clicksign-key',
      'https://sandbox.clicksign.com/api/v1'
    );
  });

  describe('1. Document Creation & SHA-256 Hashing', () => {
    it('creates a document in sandbox and calculates deterministic SHA-256 hash of original PDF', async () => {
      const doc = await clicksignService.createDocument({
        documentName: 'contrato_prestacao_servicos.pdf',
        contentBase64: samplePdfContent,
        deadlineAt: '2026-12-31T23:59:59Z',
        autoClose: true,
      });

      expect(doc.key).toBeDefined();
      expect(doc.key.startsWith('doc_')).toBe(true);
      expect(doc.filename).toBe('contrato_prestacao_servicos.pdf');
      expect(doc.status).toBe('draft');
      expect(doc.autoClose).toBe(true);

      const expectedSha256 = crypto
        .createHash('sha256')
        .update(Buffer.from(samplePdfContent, 'base64'))
        .digest('hex');

      expect(doc.originalHash).toBe(expectedSha256);
      expect(doc.signersCount).toBe(0);
      expect(doc.signedCount).toBe(0);
    });
  });

  describe('2. Signers Enrollment & Authentication Methods', () => {
    it('creates signers with email, sms, whatsapp and icp_brasil auth types', async () => {
      const signer1 = await clicksignService.createSigner({
        name: 'Carlos Diretor',
        email: 'carlos@empresa.com',
        documentation: '11122233344',
        authType: 'email',
      });

      const signer2 = await clicksignService.createSigner({
        name: 'Mariana Sócia',
        email: 'mariana@parceira.com',
        phoneNumber: '+5511988887777',
        authType: 'whatsapp',
      });

      const signer3 = await clicksignService.createSigner({
        name: 'Roberto Jurídico',
        email: 'roberto@juridico.com',
        authType: 'icp_brasil',
      });

      expect(signer1.key).toBeDefined();
      expect(signer1.authType).toBe('email');
      expect(signer1.documentation).toBe('11122233344');

      expect(signer2.authType).toBe('whatsapp');
      expect(signer2.phoneNumber).toBe('+5511988887777');

      expect(signer3.authType).toBe('icp_brasil');
    });
  });

  describe('3. Linking Signers to Document & URL Generation', () => {
    it('links signers with specific roles (sign, approve, witness) and generates signing URLs', async () => {
      const doc = await clicksignService.createDocument({
        documentName: 'acordo_confidencialidade.pdf',
        contentBase64: samplePdfContent,
      });

      const signer1 = await clicksignService.createSigner({
        name: 'Alice Assinante',
        email: 'alice@empresa.com',
        authType: 'email',
      });

      const signer2 = await clicksignService.createSigner({
        name: 'Bruno Aprovador',
        email: 'bruno@empresa.com',
        authType: 'sms',
      });

      const listItem1 = await clicksignService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signer1.key,
        signAs: 'sign',
        groupOrder: 1,
        message: 'Por favor, assine o NDA corporativo.',
      });

      const listItem2 = await clicksignService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signer2.key,
        signAs: 'approve',
        groupOrder: 2,
      });

      expect(listItem1.requestSignatureKey).toBeDefined();
      expect(listItem1.url).toContain(listItem1.requestSignatureKey);
      expect(listItem1.signAs).toBe('sign');
      expect(listItem1.status).toBe('pending');

      expect(listItem2.signAs).toBe('approve');
      expect(listItem2.groupOrder).toBe(2);

      // Verify document status progressed to running
      const { document, signers } = await clicksignService.getDocument(doc.key);
      expect(document.status).toBe('running');
      expect(document.signersCount).toBe(2);
      expect(signers).toHaveLength(2);
    });
  });

  describe('4. End-to-End Signature Sandbox Simulation & Status Lifecycle', () => {
    it('simulates progressive signing, updates audit trail, and transitions document to closed', async () => {
      // 1. Create Document
      const doc = await clicksignService.createDocument({
        documentName: 'contrato_final.pdf',
        contentBase64: samplePdfContent,
      });

      // 2. Register 2 Signers
      const signerA = await clicksignService.createSigner({
        name: 'Fernanda Lima',
        email: 'fernanda@acme.com',
        documentation: '99988877766',
        authType: 'email',
      });

      const signerB = await clicksignService.createSigner({
        name: 'Gabriel Costa',
        email: 'gabriel@acme.com',
        documentation: '55544433322',
        authType: 'whatsapp',
      });

      // 3. Add to Document
      const listA = await clicksignService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signerA.key,
        signAs: 'sign',
      });

      const listB = await clicksignService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signerB.key,
        signAs: 'witness',
      });

      // 4. Signer A signs
      const resA = await clicksignService.simulateSignDocument({
        documentKey: doc.key,
        requestSignatureKey: listA.requestSignatureKey,
        signerInfo: {
          name: signerA.name,
          email: signerA.email,
          documentation: signerA.documentation,
          authType: signerA.authType,
        },
        ipAddress: '201.55.80.10',
        userAgent: 'Chrome/120.0 Mobile',
      });

      expect(resA.listItem.status).toBe('signed');
      expect(resA.evidenceEvent.signerEmail).toBe('fernanda@acme.com');
      expect(resA.evidenceEvent.ipAddress).toBe('201.55.80.10');
      expect(resA.document.status).toBe('running');
      expect(resA.document.signedCount).toBe(1);

      // Attempt duplicate sign by Signer A must fail
      await expect(
        clicksignService.simulateSignDocument({
          documentKey: doc.key,
          requestSignatureKey: listA.requestSignatureKey,
          signerInfo: {
            name: signerA.name,
            email: signerA.email,
          },
        })
      ).rejects.toThrow('Este signatário já assinou o documento.');

      // 5. Signer B signs
      const resB = await clicksignService.simulateSignDocument({
        documentKey: doc.key,
        requestSignatureKey: listB.requestSignatureKey,
        signerInfo: {
          name: signerB.name,
          email: signerB.email,
          documentation: signerB.documentation,
          authType: signerB.authType,
        },
        ipAddress: '177.135.20.90',
        userAgent: 'Firefox/121.0 macOS',
      });

      expect(resB.document.status).toBe('closed');
      expect(resB.document.signedCount).toBe(2);
      expect(resB.document.closedAt).toBeDefined();
      expect(resB.document.signedHash).toBeDefined();
    });
  });

  describe('5. Evidence Report & Lei 14.063/2020 Compliance', () => {
    it('generates a full legal evidence audit manifest with SHA-256 hashes, timestamps, and IP addresses', async () => {
      const doc = await clicksignService.createDocument({
        documentName: 'termo_adesao.pdf',
        contentBase64: samplePdfContent,
      });

      const signer = await clicksignService.createSigner({
        name: 'Juliana Silva',
        email: 'juliana@empresa.com',
        documentation: '12312312388',
        authType: 'email',
      });

      const list = await clicksignService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signer.key,
        signAs: 'sign',
      });

      await clicksignService.simulateSignDocument({
        documentKey: doc.key,
        requestSignatureKey: list.requestSignatureKey,
        signerInfo: {
          name: signer.name,
          email: signer.email,
          documentation: signer.documentation,
          authType: signer.authType,
        },
        ipAddress: '187.100.200.5',
        userAgent: 'Safari/17.2 iPhone',
      });

      const report = await clicksignService.getEvidenceReport(doc.key);

      // Validate schema compliance against shared Zod schema
      const parsed = SignatureEvidenceReportSchema.safeParse(report);
      expect(parsed.success).toBe(true);

      expect(report.documentKey).toBe(doc.key);
      expect(report.documentName).toBe('termo_adesao.pdf');
      expect(report.status).toBe('closed');
      expect(report.legalFramework).toContain('Lei Federal nº 14.063/2020');
      expect(report.events).toHaveLength(1);
      expect(report.events[0].signerName).toBe('Juliana Silva');
      expect(report.events[0].signerEmail).toBe('juliana@empresa.com');
      expect(report.events[0].ipAddress).toBe('187.100.200.5');
      expect(report.events[0].userAgent).toBe('Safari/17.2 iPhone');
      expect(report.events[0].signatureRole).toBe('sign');
    });
  });

  describe('6. Signed Document Download', () => {
    it('blocks download when document is still pending, and returns signed buffer once closed', async () => {
      const doc = await clicksignService.createDocument({
        documentName: 'contrato_download.pdf',
        contentBase64: samplePdfContent,
      });

      const signer = await clicksignService.createSigner({
        name: 'Rodrigo Engenharia',
        email: 'rodrigo@acme.com',
      });

      const list = await clicksignService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signer.key,
      });

      // Before signing: download must be rejected
      await expect(clicksignService.downloadSignedDocument(doc.key)).rejects.toThrow(
        'O documento ainda não foi finalizado por todos os signatários.'
      );

      // Sign document
      await clicksignService.simulateSignDocument({
        documentKey: doc.key,
        requestSignatureKey: list.requestSignatureKey,
        signerInfo: {
          name: signer.name,
          email: signer.email,
        },
      });

      // After signing: download succeeds
      const file = await clicksignService.downloadSignedDocument(doc.key);
      expect(file.contentType).toBe('application/pdf');
      expect(file.filename).toBe('contrato_download_assinado.pdf');
      expect(file.buffer).toBeInstanceOf(Buffer);
      expect(file.sha256).toBeDefined();
    });
  });

  describe('7. Webhook Security & Signature Verification', () => {
    const webhookSecret = 'secret_clicksign_webhook_test_key_123';

    it('verifies valid HMAC-SHA256 signature on incoming webhooks', () => {
      const rawPayload = JSON.stringify({
        event: {
          name: 'document.closed',
          occurred_at: '2026-10-05T12:00:00Z',
          data: {
            document: {
              key: 'doc_12345',
              filename: 'contrato.pdf',
              status: 'closed',
            },
          },
        },
      });

      const validSignature = clicksignService.generateTestWebhookSignature(
        rawPayload,
        webhookSecret
      );
      const isValid = clicksignService.verifyWebhookSignature(
        rawPayload,
        validSignature,
        webhookSecret
      );

      expect(isValid).toBe(true);
    });

    it('rejects tampered webhook payloads or wrong signatures', () => {
      const rawPayload = JSON.stringify({ event: { name: 'document.closed' } });
      const tamperedPayload = JSON.stringify({ event: { name: 'document.canceled' } });

      const validSignature = clicksignService.generateTestWebhookSignature(
        rawPayload,
        webhookSecret
      );
      const isTamperedValid = clicksignService.verifyWebhookSignature(
        tamperedPayload,
        validSignature,
        webhookSecret
      );
      const isWrongSignatureValid = clicksignService.verifyWebhookSignature(
        rawPayload,
        'invalid_signature_hex',
        webhookSecret
      );

      expect(isTamperedValid).toBe(false);
      expect(isWrongSignatureValid).toBe(false);
    });
  });

  describe('8. Live API Mocking & Error Handling', () => {
    it('throws descriptive error on API failure in live mode', async () => {
      const liveService = new ClicksignProviderService(
        'live-token-abc',
        'https://api.clicksign.com/api/v1'
      );

      // Mock fetch failure
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ errors: ['Limite de envelopes excedido na conta Clicksign.'] }),
      });
      global.fetch = mockFetch;

      await expect(
        liveService.createDocument({
          documentName: 'fail.pdf',
          contentBase64: samplePdfContent,
        })
      ).rejects.toThrow(
        'Falha no Clicksign (createDocument): Limite de envelopes excedido na conta Clicksign.'
      );
    });
  });
});

