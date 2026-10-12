import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClicksignProviderService } from '../services/clicksign.service';
import crypto from 'crypto';

describe('ClicksignProviderService Sandbox & Live Adapter Tests', () => {
  let sandboxService: ClicksignProviderService;
  let liveService: ClicksignProviderService;

  beforeEach(() => {
    sandboxService = new ClicksignProviderService('mock-api-key', 'https://sandbox.clicksign.com/api/v1');
    liveService = new ClicksignProviderService('live-token-secret-123', 'https://app.clicksign.com/api/v1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes sha256 correctly for string and buffer', () => {
    const fromStr = sandboxService.computeSha256('SGVsbG8gV29ybGQ=');
    const fromBuf = sandboxService.computeSha256(Buffer.from('Hello World'));
    expect(fromStr).toBe(fromBuf);
  });

  describe('Sandbox Mode Operations', () => {
    it('creates document, creates signer, adds signer, and simulates signing flow', async () => {
      // 1. Create document
      const doc = await sandboxService.createDocument({
        documentName: 'contrato.pdf',
        contentBase64: Buffer.from('PDF Content').toString('base64'),
      });
      expect(doc.key).toBeDefined();
      expect(doc.status).toBe('draft');
      expect(doc.signersCount).toBe(0);

      // 2. Create signer
      const signer = await sandboxService.createSigner({
        name: 'Maria Silva',
        email: 'maria@corp.com',
        documentation: '11122233344',
      });
      expect(signer.key).toBeDefined();
      expect(signer.email).toBe('maria@corp.com');

      // 3. Add signer to document
      const association = await sandboxService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signer.key,
        signAs: 'sign',
        groupOrder: 1,
      });
      expect(association.status).toBe('pending');
      expect(association.url).toContain(association.requestSignatureKey);

      // 4. Download signed doc before closing throws error
      await expect(sandboxService.downloadSignedDocument(doc.key)).rejects.toThrow(
        'O documento ainda não foi finalizado por todos os signatários.'
      );

      // 5. Simulate sign
      const signRes = await sandboxService.simulateSignDocument({
        documentKey: doc.key,
        requestSignatureKey: association.requestSignatureKey,
        signerInfo: {
          name: 'Maria Silva',
          email: 'maria@corp.com',
          documentation: '11122233344',
        },
      });
      expect(signRes.listItem.status).toBe('signed');
      expect(signRes.document.status).toBe('closed');
      expect(signRes.document.signedHash).toBeDefined();

      // 6. Signing again throws error
      await expect(
        sandboxService.simulateSignDocument({
          documentKey: doc.key,
          requestSignatureKey: association.requestSignatureKey,
          signerInfo: {
            name: 'Maria Silva',
            email: 'maria@corp.com',
          },
        })
      ).rejects.toThrow('Este signatário já assinou o documento.');

      // 7. Get document
      const retrieved = await sandboxService.getDocument(doc.key);
      expect(retrieved.document.key).toBe(doc.key);
      expect(retrieved.signers).toHaveLength(1);

      // 8. Get evidence report
      const evidence = await sandboxService.getEvidenceReport(doc.key);
      expect(evidence.documentKey).toBe(doc.key);
      expect(evidence.events).toHaveLength(1);

      // 9. Download signed document after closing succeeds
      const file = await sandboxService.downloadSignedDocument(doc.key);
      expect(file.contentType).toBe('application/pdf');
      expect(file.filename).toBe('contrato_assinado.pdf');
      expect(file.buffer).toBeInstanceOf(Buffer);
    });

    it('handles sandbox error states for missing documents and keys', async () => {
      await expect(
        sandboxService.addSignerToDocument({
          documentKey: 'missing-doc',
          signerKey: 'sig-1',
        })
      ).rejects.toThrow('Documento missing-doc não encontrado no sandbox.');

      await expect(
        sandboxService.simulateSignDocument({
          documentKey: 'missing-doc',
          requestSignatureKey: 'req-1',
          signerInfo: { name: 'A', email: 'a@a.com' },
        })
      ).rejects.toThrow('Documento missing-doc não encontrado no sandbox.');

      // Valid doc but invalid requestSignatureKey
      const doc = await sandboxService.createDocument({
        documentName: 'doc.pdf',
        contentBase64: 'abc',
      });
      await expect(
        sandboxService.simulateSignDocument({
          documentKey: doc.key,
          requestSignatureKey: 'unknown-req',
          signerInfo: { name: 'A', email: 'a@a.com' },
        })
      ).rejects.toThrow('Chave de assinatura unknown-req não encontrada.');

      await expect(sandboxService.getDocument('unknown-doc')).rejects.toThrow(
        'Documento unknown-doc não encontrado.'
      );
      await expect(sandboxService.getEvidenceReport('unknown-doc')).rejects.toThrow(
        'Documento unknown-doc não encontrado.'
      );
      await expect(sandboxService.downloadSignedDocument('unknown-doc')).rejects.toThrow(
        'Documento unknown-doc não encontrado.'
      );
    });
  });

  describe('Live API Mode Operations (Real HTTP / Mocked Fetch)', () => {
    it('createDocument handles API success, 400 error and network failure', async () => {
      // 1. Success
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: {
            key: 'live-doc-1',
            path: '/contrato.pdf',
            status: 'draft',
            deadline_at: '2026-12-31',
            auto_close: true,
            original_hash: 'hash123',
            created_at: '2026-10-12T00:00:00Z',
            updated_at: '2026-10-12T00:00:00Z',
          },
        }),
      } as any);

      const doc = await liveService.createDocument({
        documentName: 'contrato.pdf',
        contentBase64: 'abc',
      });
      expect(doc.key).toBe('live-doc-1');

      // 2. 400 Error
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: ['Documento corrompido'] }),
      } as any);

      await expect(
        liveService.createDocument({ documentName: 'c.pdf', contentBase64: 'abc' })
      ).rejects.toThrow('Falha no Clicksign (createDocument): Documento corrompido');

      // 3. Network Failure
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection reset'));
      await expect(
        liveService.createDocument({ documentName: 'c.pdf', contentBase64: 'abc' })
      ).rejects.toThrow('Falha no Clicksign (createDocument): Connection reset');
    });

    it('createSigner handles API success, 400 error and network failure', async () => {
      // 1. Success
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signer: {
            key: 'sig-live-1',
            email: 'live@corp.com',
            name: 'Live User',
            documentation: '12345678900',
            phone_number: '+5511999999999',
            created_at: '2026-10-12T00:00:00Z',
          },
        }),
      } as any);

      const signer = await liveService.createSigner({
        name: 'Live User',
        email: 'live@corp.com',
        documentation: '12345678900',
        phoneNumber: '+5511999999999',
      });
      expect(signer.key).toBe('sig-live-1');

      // 2. 400 Error
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: ['Email já cadastrado'] }),
      } as any);

      await expect(
        liveService.createSigner({ name: 'Err', email: 'err@corp.com' })
      ).rejects.toThrow('Falha no Clicksign (createSigner): Email já cadastrado');

      // 3. Network Failure
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('DNS resolution error'));
      await expect(
        liveService.createSigner({ name: 'Err', email: 'err@corp.com' })
      ).rejects.toThrow('Falha no Clicksign (createSigner): DNS resolution error');
    });

    it('addSignerToDocument handles API success, 400 error and network failure', async () => {
      // 1. Success
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: {
            key: 'list-1',
            request_signature_key: 'req-live-1',
            document_key: 'doc-live-1',
            signer_key: 'sig-live-1',
            sign_as: 'sign',
            group: 1,
            url: 'https://app.clicksign.com/sign/req-live-1',
          },
        }),
      } as any);

      const item = await liveService.addSignerToDocument({
        documentKey: 'doc-live-1',
        signerKey: 'sig-live-1',
      });
      expect(item.requestSignatureKey).toBe('req-live-1');

      // 2. 400 Error
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: ['Signatário inválido para o documento'] }),
      } as any);

      await expect(
        liveService.addSignerToDocument({
          documentKey: 'doc-live-1',
          signerKey: 'sig-live-1',
        })
      ).rejects.toThrow('Falha no Clicksign (addSignerToDocument): Signatário inválido para o documento');

      // 3. Network error
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('EPIPE'));
      await expect(
        liveService.addSignerToDocument({
          documentKey: 'doc-live-1',
          signerKey: 'sig-live-1',
        })
      ).rejects.toThrow('Falha no Clicksign (addSignerToDocument): EPIPE');
    });

    it('getDocument, getEvidenceReport, downloadSignedDocument live calls', async () => {
      // 1. getDocument success
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: {
            key: 'doc-live-1',
            path: '/contrato.pdf',
            filename: 'contrato.pdf',
            status: 'closed',
            original_hash: 'orig-hash',
            signed_hash: 'signed-hash',
            signers: [
              {
                key: 'k-1',
                request_signature_key: 'r-1',
                signer_key: 's-1',
                sign_as: 'sign',
                group: 1,
                url: 'https://sign.url',
                status: 'signed',
                signed_at: '2026-10-12T00:00:00Z',
              },
            ],
          },
        }),
      } as any);

      const retrieved = await liveService.getDocument('doc-live-1');
      expect(retrieved.document.key).toBe('doc-live-1');
      expect(retrieved.signers).toHaveLength(1);

      // 2. getDocument error (404)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as any);
      await expect(liveService.getDocument('unknown')).rejects.toThrow(
        'Falha no Clicksign (getDocument): Documento não encontrado na API Clicksign.'
      );

      // 3. getEvidenceReport live success
      vi.spyOn(liveService, 'getDocument').mockResolvedValueOnce({
        document: {
          key: 'doc-live-1',
          path: '/c.pdf',
          filename: 'c.pdf',
          status: 'closed',
          autoClose: true,
          originalHash: 'h1',
          signedHash: 'h2',
          signersCount: 1,
          signedCount: 1,
          createdAt: '2026-10-12',
          updatedAt: '2026-10-12',
        },
        signers: [],
      });
      const rep = await liveService.getEvidenceReport('doc-live-1');
      expect(rep.documentKey).toBe('doc-live-1');

      // 4. getEvidenceReport live error
      vi.spyOn(liveService, 'getDocument').mockRejectedValueOnce(new Error('API Down'));
      await expect(liveService.getEvidenceReport('doc-err')).rejects.toThrow(
        'Falha no Clicksign (getEvidenceReport): API Down'
      );

      // 5. downloadSignedDocument live success
      const pdfBytes = Buffer.from('%PDF-1.4 Mock Real Live File');
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength),
      } as any);

      const downloaded = await liveService.downloadSignedDocument('doc-live-1');
      expect(downloaded.filename).toBe('doc-live-1_assinado.pdf');
      expect(downloaded.sha256).toBeDefined();

      // 6. downloadSignedDocument live error
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as any);
      await expect(liveService.downloadSignedDocument('doc-fail')).rejects.toThrow(
        'Falha no Clicksign (downloadSignedDocument): Falha ao baixar documento assinado.'
      );
    });
  });

  describe('Webhook Signature Verification', () => {
    it('verifies valid HMAC-SHA256 signature and rejects mismatches', () => {
      const secret = 'super-webhook-secret-key-42';
      const payload = JSON.stringify({ event: { name: 'document.signed' } });
      const validSig = liveService.generateTestWebhookSignature(payload, secret);

      // Valid
      expect(liveService.verifyWebhookSignature(payload, validSig, secret)).toBe(true);

      // Mismatched signature content
      const invalidSig = liveService.generateTestWebhookSignature(payload + '!', secret);
      expect(liveService.verifyWebhookSignature(payload, invalidSig, secret)).toBe(false);

      // Mismatched signature length
      expect(liveService.verifyWebhookSignature(payload, 'short', secret)).toBe(false);

      // Missing header or secret
      expect(liveService.verifyWebhookSignature(payload, '', secret)).toBe(false);
      expect(liveService.verifyWebhookSignature(payload, validSig, '')).toBe(false);

      // Thrown error fallback
      vi.spyOn(crypto, 'timingSafeEqual').mockImplementationOnce(() => {
        throw new Error('Buffer mismatch');
      });
      expect(liveService.verifyWebhookSignature(payload, validSig, secret)).toBe(false);
    });
  });
});
