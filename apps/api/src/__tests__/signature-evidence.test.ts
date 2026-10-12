import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { buildServer } from '../server.js';
import { db } from '../db/index.js';
import {
  accounts,
  users,
  conversations,
  conversationMembers,
  signatureRequests,
  signatureSigners,
  signatureEvidence,
} from '../db/schema/index.js';
import { ClicksignProviderService } from '../services/clicksign.service.js';
import { SignatureService } from '../services/signature.service.js';
import { SignatureEvidenceReportSchema } from '@corpchat/shared';

describe('Evidence Certificate, Hash Integrity & Document Download (T-33)', () => {
  let app: FastifyInstance;
  let clicksignService: ClicksignProviderService;
  let signatureService: SignatureService;

  const accountId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const conversationId = '33333333-3333-3333-3333-333333333333';
  const signatureRequestId = '44444444-4444-4444-4444-444444444444';

  const originalPdfBuffer = Buffer.from('%PDF-1.4 Mock Legal Agreement for T-33 Evidence Verification');
  const originalPdfBase64 = originalPdfBuffer.toString('base64');
  const expectedOriginalSha256 = crypto.createHash('sha256').update(originalPdfBuffer).digest('hex');

  const signedSha256Mock = crypto.createHash('sha256').update(Buffer.from('signed-version-t33')).digest('hex');

  // In-memory store
  const accountStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const signatureRequestStore = new Map<string, any>();
  const signatureSignerStore = new Map<string, any>();
  const signatureEvidenceStore = new Map<string, any>();

  beforeEach(async () => {
    vi.clearAllMocks();
    accountStore.clear();
    userStore.clear();
    signatureRequestStore.clear();
    signatureSignerStore.clear();
    signatureEvidenceStore.clear();

    accountStore.set(accountId, {
      id: accountId,
      name: 'Enterprise Corp',
      plan: 'enterprise',
      status: 'active',
      createdAt: new Date(),
    });

    userStore.set(userId, {
      id: userId,
      accountId,
      name: 'Diretor Legal',
      email: 'legal@enterprise.com',
      role: 'owner',
      status: 'active',
    });

    // Default mock select implementation
    vi.spyOn(db, 'select').mockImplementation((fields?: any) => {
      return {
        from: (table: any) => ({
          where: (condition: any) => {
            let records: any[] = [];
            if (table === accounts) {
              records = Array.from(accountStore.values());
            } else if (table === users) {
              records = Array.from(userStore.values());
            } else if (table === signatureRequests) {
              records = Array.from(signatureRequestStore.values());
            } else if (table === signatureSigners) {
              records = Array.from(signatureSignerStore.values());
            } else if (table === signatureEvidence) {
              records = Array.from(signatureEvidenceStore.values());
            }

            return {
              limit: (n: number) => records.slice(0, n),
              orderBy: () => records,
              then: (resolve: any) => resolve(records),
            };
          },
        }),
      } as any;
    });

    clicksignService = new ClicksignProviderService('mock-clicksign-key');
    signatureService = new SignatureService(clicksignService);

    app = buildServer({
      signatureService,
    });
    await app.ready();
  });

  describe('1. Evidence Report Manifest (GET /api/signatures/:id/evidence)', () => {
    it('returns full evidence report with matching SHA-256, timestamps, IP and legal framework', async () => {
      const mockReq = {
        id: signatureRequestId,
        accountId,
        conversationId,
        creatorId: userId,
        title: 'Contrato Social',
        documentName: 'contrato_social.pdf',
        provider: 'clicksign',
        externalDocumentKey: 'doc_clicksign_t33',
        originalSha256: expectedOriginalSha256,
        signedSha256: signedSha256Mock,
        status: 'closed',
        autoClose: true,
        closedAt: new Date('2026-10-05T12:00:00Z'),
        createdAt: new Date('2026-10-05T10:00:00Z'),
        updatedAt: new Date('2026-10-05T12:00:00Z'),
      };

      const mockSigner = {
        id: 'signer-1',
        signatureRequestId,
        userId: null,
        externalSignerKey: 'sig-ext-1',
        requestSignatureKey: 'req-sig-1',
        name: 'Ana Paula Sócia',
        email: 'ana@empresa.com',
        documentation: '99988877711',
        authType: 'email',
        signAs: 'sign',
        groupOrder: 1,
        signUrl: 'https://sandbox.clicksign.com/sign/req-sig-1',
        status: 'signed',
        signedAt: new Date('2026-10-05T12:00:00Z'),
        createdAt: new Date('2026-10-05T10:00:00Z'),
      };

      const mockEv = {
        id: 'ev-1',
        signatureRequestId,
        signerId: 'signer-1',
        eventType: 'signature_executed',
        ipAddress: '189.120.45.12',
        userAgent: 'Mozilla/5.0 Chrome/120',
        token: 'auth_token_hash_abc',
        details: {
          signerName: 'Ana Paula Sócia',
          signerEmail: 'ana@empresa.com',
        },
        occurredAt: new Date('2026-10-05T12:00:00Z'),
        createdAt: new Date('2026-10-05T12:00:00Z'),
      };

      signatureRequestStore.set(signatureRequestId, mockReq);
      signatureSignerStore.set('signer-1', mockSigner);
      signatureEvidenceStore.set('ev-1', mockEv);

      const token = app.jwt.sign({
        userId,
        accountId,
        email: 'legal@enterprise.com',
        role: 'owner',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/signatures/${signatureRequestId}/evidence`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const report = JSON.parse(response.body);

      // Validate against shared schema
      const parseResult = SignatureEvidenceReportSchema.safeParse(report);
      expect(parseResult.success).toBe(true);

      expect(report.documentName).toBe('contrato_social.pdf');
      expect(report.originalDocSha256).toBe(expectedOriginalSha256);
      expect(report.signedDocSha256).toBe(signedSha256Mock);
      expect(report.status).toBe('closed');
      expect(report.legalFramework).toContain('Lei Federal nº 14.063/2020');
      expect(report.events).toHaveLength(1);
      expect(report.events[0].signerName).toBe('Ana Paula Sócia');
      expect(report.events[0].ipAddress).toBe('189.120.45.12');
      expect(report.events[0].userAgent).toBe('Mozilla/5.0 Chrome/120');
    });
  });

  describe('2. Evidence Certificate PDF Download (GET /api/signatures/:id/evidence/pdf)', () => {
    it('generates and downloads certificate PDF with SHA-256 header and audit manifest', async () => {
      const mockReq = {
        id: signatureRequestId,
        accountId,
        conversationId,
        creatorId: userId,
        title: 'Contrato Social',
        documentName: 'contrato_social.pdf',
        provider: 'clicksign',
        externalDocumentKey: 'doc_clicksign_t33',
        originalSha256: expectedOriginalSha256,
        signedSha256: signedSha256Mock,
        status: 'closed',
        autoClose: true,
        closedAt: new Date('2026-10-05T12:00:00Z'),
        createdAt: new Date('2026-10-05T10:00:00Z'),
        updatedAt: new Date('2026-10-05T12:00:00Z'),
      };

      signatureRequestStore.set(signatureRequestId, mockReq);

      const token = app.jwt.sign({
        userId,
        accountId,
        email: 'legal@enterprise.com',
        role: 'owner',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/signatures/${signatureRequestId}/evidence/pdf`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('contrato_social_certificado_evidencias.pdf');
      expect(response.headers['x-certificate-sha256']).toBeDefined();

      const pdfBody = response.body;
      expect(pdfBody).toContain('%PDF-1.4');
      expect(pdfBody).toContain(expectedOriginalSha256);
      expect(pdfBody).toContain('Lei Federal nº 14.063/2020');
    });
  });

  describe('3. Signed Document Download & Status Check (GET /api/signatures/:id/download)', () => {
    it('blocks download with 400 when document status is running', async () => {
      const mockReq = {
        id: signatureRequestId,
        accountId,
        conversationId,
        creatorId: userId,
        title: 'Acordo Pendente',
        documentName: 'acordo.pdf',
        provider: 'clicksign',
        externalDocumentKey: 'doc_pending',
        originalSha256: expectedOriginalSha256,
        status: 'running',
        autoClose: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      signatureRequestStore.set(signatureRequestId, mockReq);

      const token = app.jwt.sign({
        userId,
        accountId,
        email: 'legal@enterprise.com',
        role: 'owner',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/signatures/${signatureRequestId}/download`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('ainda não foi finalizado');
    });

    it('downloads signed PDF with X-Document-Sha256 header when document is closed', async () => {
      // First create document in sandbox provider
      const doc = await clicksignService.createDocument({
        documentName: 'contrato_assinado.pdf',
        contentBase64: originalPdfBase64,
      });

      const signer = await clicksignService.createSigner({
        name: 'Gabriel Teste',
        email: 'gabriel@teste.com',
      });

      const list = await clicksignService.addSignerToDocument({
        documentKey: doc.key,
        signerKey: signer.key,
      });

      await clicksignService.simulateSignDocument({
        documentKey: doc.key,
        requestSignatureKey: list.requestSignatureKey,
        signerInfo: {
          name: signer.name,
          email: signer.email,
        },
      });

      const mockReq = {
        id: signatureRequestId,
        accountId,
        conversationId,
        creatorId: userId,
        title: 'Contrato Concluído',
        documentName: 'contrato_assinado.pdf',
        provider: 'clicksign',
        externalDocumentKey: doc.key,
        originalSha256: expectedOriginalSha256,
        signedSha256: doc.signedHash,
        status: 'closed',
        autoClose: true,
        closedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      signatureRequestStore.set(signatureRequestId, mockReq);

      const token = app.jwt.sign({
        userId,
        accountId,
        email: 'legal@enterprise.com',
        role: 'owner',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/signatures/${signatureRequestId}/download`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('contrato_assinado_assinado.pdf');
      expect(response.headers['x-document-sha256']).toBeDefined();
    });
  });

  describe('4. Hash Verification Endpoint (POST /api/signatures/:id/verify-hash)', () => {
    it('verifies matching hash against original and signed document', async () => {
      const mockReq = {
        id: signatureRequestId,
        accountId,
        conversationId,
        creatorId: userId,
        title: 'Documento Verificação',
        documentName: 'doc.pdf',
        provider: 'clicksign',
        externalDocumentKey: 'doc_hash_verify',
        originalSha256: expectedOriginalSha256,
        signedSha256: signedSha256Mock,
        status: 'closed',
        autoClose: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      signatureRequestStore.set(signatureRequestId, mockReq);

      const token = app.jwt.sign({
        userId,
        accountId,
        email: 'legal@enterprise.com',
        role: 'owner',
      });

      // 1. Verify original content Base64
      const resBase64 = await app.inject({
        method: 'POST',
        url: `/api/signatures/${signatureRequestId}/verify-hash`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          contentBase64: originalPdfBase64,
        },
      });

      expect(resBase64.statusCode).toBe(200);
      const data1 = JSON.parse(resBase64.body);
      expect(data1.matchesOriginal).toBe(true);
      expect(data1.isValid).toBe(true);
      expect(data1.providedSha256).toBe(expectedOriginalSha256);

      // 2. Verify signed SHA-256 direct string
      const resSigned = await app.inject({
        method: 'POST',
        url: `/api/signatures/${signatureRequestId}/verify-hash`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          sha256: signedSha256Mock,
        },
      });

      expect(resSigned.statusCode).toBe(200);
      const data2 = JSON.parse(resSigned.body);
      expect(data2.matchesSigned).toBe(true);
      expect(data2.isValid).toBe(true);

      // 3. Verify forged / tampered hash
      const resForged = await app.inject({
        method: 'POST',
        url: `/api/signatures/${signatureRequestId}/verify-hash`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      });

      expect(resForged.statusCode).toBe(200);
      const data3 = JSON.parse(resForged.body);
      expect(data3.matchesOriginal).toBe(false);
      expect(data3.matchesSigned).toBe(false);
      expect(data3.isValid).toBe(false);
    });

    it('rejects verification request without sha256 or contentBase64 with 400', async () => {
      const token = app.jwt.sign({
        userId,
        accountId,
        email: 'legal@enterprise.com',
        role: 'owner',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/signatures/${signatureRequestId}/verify-hash`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.message).toContain('Informe o hash SHA-256 ou o conteúdo base64');
    });
  });
});
