import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
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
  messages,
} from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { ClicksignProviderService } from '../services/clicksign.service.js';
import { SignatureService } from '../services/signature.service.js';

describe('Electronic Signature Flow API & Enterprise Access (T-32)', () => {
  let app: FastifyInstance;
  let clicksignService: ClicksignProviderService;
  let signatureService: SignatureService;

  // Mock data IDs
  const enterpriseAccountId = '11111111-1111-1111-1111-111111111111';
  const proAccountId = '22222222-2222-2222-2222-222222222222';
  const freeAccountId = '33333333-3333-3333-3333-333333333333';
  const overQuotaAccountId = '44444444-4444-4444-4444-444444444444';

  const enterpriseUserId = '55555555-5555-5555-5555-555555555555';
  const proUserId = '66666666-6666-6666-6666-666666666666';
  const freeUserId = '77777777-7777-7777-7777-777777777777';
  const outsiderUserId = '88888888-8888-8888-8888-888888888888';

  const conversationId = '99999999-9999-9999-9999-999999999999';

  const samplePdfBase64 = Buffer.from('%PDF-1.4 Mock Electronic Signature Contract for T-32 Integration').toString('base64');

  // In-memory mock DB stores
  const accountStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  const conversationStore = new Map<string, any>();
  const memberStore = new Map<string, any>();
  const signatureRequestStore = new Map<string, any>();
  const signatureSignerStore = new Map<string, any>();
  const signatureEvidenceStore = new Map<string, any>();
  const messageStore = new Map<string, any>();

  const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    accountStore.clear();
    userStore.clear();
    conversationStore.clear();
    memberStore.clear();
    signatureRequestStore.clear();
    signatureSignerStore.clear();
    signatureEvidenceStore.clear();
    messageStore.clear();

    // Setup initial test accounts
    accountStore.set(enterpriseAccountId, {
      id: enterpriseAccountId,
      name: 'Enterprise Corp',
      plan: 'enterprise',
      status: 'active',
      createdAt: new Date(),
    });

    accountStore.set(proAccountId, {
      id: proAccountId,
      name: 'Pro Corp',
      plan: 'pro',
      status: 'active',
      createdAt: new Date(),
    });

    accountStore.set(freeAccountId, {
      id: freeAccountId,
      name: 'Free Corp',
      plan: 'free',
      status: 'active',
      createdAt: new Date(),
    });

    accountStore.set(overQuotaAccountId, {
      id: overQuotaAccountId,
      name: 'OverQuota Enterprise',
      plan: 'enterprise',
      status: 'over_quota',
      createdAt: new Date(),
    });

    // Setup users
    userStore.set(enterpriseUserId, {
      id: enterpriseUserId,
      accountId: enterpriseAccountId,
      name: 'Diretor Enterprise',
      email: 'diretor@enterprise.com',
      role: 'owner',
      status: 'active',
    });

    userStore.set(proUserId, {
      id: proUserId,
      accountId: proAccountId,
      name: 'Admin Pro',
      email: 'admin@pro.com',
      role: 'owner',
      status: 'active',
    });

    userStore.set(freeUserId, {
      id: freeUserId,
      accountId: freeAccountId,
      name: 'User Free',
      email: 'user@free.com',
      role: 'member',
      status: 'active',
    });

    userStore.set(outsiderUserId, {
      id: outsiderUserId,
      accountId: enterpriseAccountId,
      name: 'Outsider User',
      email: 'outsider@enterprise.com',
      role: 'member',
      status: 'active',
    });

    // Setup conversation & membership
    conversationStore.set(conversationId, {
      id: conversationId,
      accountId: enterpriseAccountId,
      type: 'group',
      name: 'Contratos & Jurídico',
    });

    memberStore.set(`${conversationId}:${enterpriseUserId}`, {
      conversationId,
      userId: enterpriseUserId,
      role: 'admin',
    });

    // Mock Drizzle DB operations
    vi.spyOn(db, 'select').mockImplementation((fields?: any) => {
      return {
        from: (table: any) => ({
          where: (condition: any) => {
            let records: any[] = [];
            if (table === accounts) {
              records = Array.from(accountStore.values());
            } else if (table === users) {
              records = Array.from(userStore.values());
            } else if (table === conversations) {
              records = Array.from(conversationStore.values());
            } else if (table === conversationMembers) {
              records = Array.from(memberStore.values());
            } else if (table === signatureRequests) {
              records = Array.from(signatureRequestStore.values());
            } else if (table === signatureSigners) {
              records = Array.from(signatureSignerStore.values());
            } else if (table === signatureEvidence) {
              records = Array.from(signatureEvidenceStore.values());
            }

            return {
              limit: (n: number) => {
                // Approximate filtering
                if (table === accounts) {
                  return records.slice(0, n);
                }
                return records.slice(0, n);
              },
              orderBy: () => records,
              then: (resolve: any) => resolve(records),
            };
          },
        }),
      } as any;
    });

    // Specialized Drizzle mocked calls for predictable service unit tests
    vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
      const mockTx = {
        insert: (table: any) => ({
          values: (val: any) => ({
            returning: () => {
              const id = val.id || crypto.randomUUID();
              const row = { ...val, id, createdAt: new Date(), updatedAt: new Date() };
              if (table === messages) {
                messageStore.set(id, row);
              } else if (table === signatureRequests) {
                signatureRequestStore.set(id, row);
              } else if (table === signatureSigners) {
                signatureSignerStore.set(id, row);
              } else if (table === signatureEvidence) {
                signatureEvidenceStore.set(id, row);
              }
              return [row];
            },
          }),
        }),
      };
      return await callback(mockTx);
    });

    vi.spyOn(db, 'insert').mockImplementation((table: any) => ({
      values: (val: any) => {
        const id = val.id || crypto.randomUUID();
        const row = { ...val, id, createdAt: new Date(), updatedAt: new Date() };
        if (table === signatureEvidence) {
          signatureEvidenceStore.set(id, row);
        }
        return {
          returning: () => [row],
          then: (resolve: any) => resolve([row]),
        };
      },
    }) as any);

    vi.spyOn(db, 'update').mockImplementation((table: any) => ({
      set: (val: any) => ({
        where: (cond: any) => {
          return {
            then: (resolve: any) => resolve([]),
          };
        },
      }),
    }) as any);

    clicksignService = new ClicksignProviderService('mock-clicksign-key');
    signatureService = new SignatureService(clicksignService);

    app = buildServer({
      signatureService,
    });
    await app.ready();
    signatureService.setIoServer(mockIo as any);
  });

  describe('1. Enterprise Feature Gating & Permissions', () => {
    it('blocks Free plan users with 403 Forbidden', async () => {
      // Mock account lookup for free user
      vi.spyOn(db, 'select').mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => [accountStore.get(freeAccountId)],
          }),
        }),
      }) as any);

      const token = app.jwt.sign({
        userId: freeUserId,
        accountId: freeAccountId,
        email: 'user@free.com',
        role: 'member',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/signatures',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId,
          title: 'Acordo Comercial',
          documentName: 'acordo.pdf',
          contentBase64: samplePdfBase64,
          signers: [{ name: 'Carlos', email: 'carlos@empresa.com' }],
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('recurso exclusivo do plano Enterprise');
    });

    it('blocks Pro plan users with 403 Forbidden', async () => {
      vi.spyOn(db, 'select').mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => [accountStore.get(proAccountId)],
          }),
        }),
      }) as any);

      const token = app.jwt.sign({
        userId: proUserId,
        accountId: proAccountId,
        email: 'admin@pro.com',
        role: 'owner',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/signatures',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId,
          title: 'Acordo Comercial',
          documentName: 'acordo.pdf',
          contentBase64: samplePdfBase64,
          signers: [{ name: 'Carlos', email: 'carlos@empresa.com' }],
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('recurso exclusivo do plano Enterprise');
    });

    it('blocks Enterprise users if account is over_quota', async () => {
      vi.spyOn(db, 'select').mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => [accountStore.get(overQuotaAccountId)],
          }),
        }),
      }) as any);

      const token = app.jwt.sign({
        userId: enterpriseUserId,
        accountId: overQuotaAccountId,
        email: 'diretor@enterprise.com',
        role: 'owner',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/signatures',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId,
          title: 'Contrato Parceria',
          documentName: 'contrato.pdf',
          contentBase64: samplePdfBase64,
          signers: [{ name: 'Carlos', email: 'carlos@empresa.com' }],
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('limite de membros excedido');
    });
  });

  describe('2. Creating Signature Requests (Enterprise Plan)', () => {
    it('creates document with SHA-256 hash, registers signers, creates message and emits WebSocket event', async () => {
      // Mock account and membership checks
      vi.spyOn(db, 'select')
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [accountStore.get(enterpriseAccountId)],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [memberStore.get(`${conversationId}:${enterpriseUserId}`)],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [userStore.get(enterpriseUserId)],
            }),
          }),
        }) as any);

      const token = app.jwt.sign({
        userId: enterpriseUserId,
        accountId: enterpriseAccountId,
        email: 'diretor@enterprise.com',
        role: 'owner',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/signatures',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId,
          title: 'Contrato de Prestação de Serviços',
          documentName: 'contrato_prestacao.pdf',
          contentBase64: samplePdfBase64,
          deadlineAt: '2026-12-31T23:59:59.000Z',
          autoClose: true,
          signers: [
            {
              name: 'Marina Silveira',
              email: 'marina@fornecedor.com',
              documentation: '12345678901',
              authType: 'email',
              signAs: 'sign',
              groupOrder: 1,
            },
            {
              name: 'Dr. Lucas Jurídico',
              email: 'lucas@juridico.com',
              authType: 'whatsapp',
              signAs: 'approve',
              groupOrder: 2,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);

      expect(data.id).toBeDefined();
      expect(data.title).toBe('Contrato de Prestação de Serviços');
      expect(data.documentName).toBe('contrato_prestacao.pdf');
      expect(data.provider).toBe('clicksign');
      expect(data.externalDocumentKey).toBeDefined();
      expect(data.originalSha256).toBeDefined();
      expect(data.status).toBe('running');
      expect(data.signersCount).toBe(2);
      expect(data.signedCount).toBe(0);

      expect(data.signers).toHaveLength(2);
      expect(data.signers[0].name).toBe('Marina Silveira');
      expect(data.signers[0].signUrl).toContain('https://sandbox.clicksign.com/sign/');
      expect(data.signers[0].status).toBe('pending');

      expect(data.signers[1].name).toBe('Dr. Lucas Jurídico');
      expect(data.signers[1].authType).toBe('whatsapp');
      expect(data.signers[1].signAs).toBe('approve');

      // Verify real-time WebSocket room broadcast
      expect(mockIo.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('signature:created', expect.anything());
    });
  });

  describe('3. Signature Retrieval & Listing', () => {
    it('returns signature request details by ID and by conversation', async () => {
      const mockReq = {
        id: 'sig-123',
        accountId: enterpriseAccountId,
        conversationId,
        messageId: 'msg-123',
        creatorId: enterpriseUserId,
        title: 'Acordo Confidencialidade',
        documentName: 'nda.pdf',
        provider: 'clicksign',
        externalDocumentKey: 'doc_clicksign_123',
        originalSha256: 'abc123sha256',
        status: 'running',
        autoClose: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSigner = {
        id: 'sig-signer-1',
        signatureRequestId: 'sig-123',
        userId: null,
        name: 'Maria Silva',
        email: 'maria@test.com',
        authType: 'email',
        signAs: 'sign',
        groupOrder: 1,
        signUrl: 'https://sandbox.clicksign.com/sign/req-123',
        status: 'pending',
        createdAt: new Date(),
      };

      vi.spyOn(db, 'select')
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [mockReq],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => Promise.resolve([mockSigner]),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [userStore.get(enterpriseUserId)],
            }),
          }),
        }) as any);

      const token = app.jwt.sign({
        userId: enterpriseUserId,
        accountId: enterpriseAccountId,
        email: 'diretor@enterprise.com',
        role: 'owner',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/signatures/sig-123',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.id).toBe('sig-123');
      expect(data.title).toBe('Acordo Confidencialidade');
      expect(data.signers).toHaveLength(1);
    });
  });

  describe('4. Sandbox Signature Simulation & Status Updates', () => {
    it('simulates signature execution, updates signer status and auto-closes when all signers sign', async () => {
      // 1. Create a signature request through service directly
      vi.spyOn(db, 'select')
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [accountStore.get(enterpriseAccountId)],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [memberStore.get(`${conversationId}:${enterpriseUserId}`)],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [userStore.get(enterpriseUserId)],
            }),
          }),
        }) as any);

      const created = await signatureService.createSignatureRequest(
        enterpriseAccountId,
        enterpriseUserId,
        {
          conversationId,
          title: 'Termo de Encerramento',
          documentName: 'termo.pdf',
          contentBase64: samplePdfBase64,
          signers: [
            {
              name: 'Renata Gerente',
              email: 'renata@empresa.com',
              authType: 'email',
              signAs: 'sign',
              groupOrder: 1,
            },
          ],
        }
      );

      const signerId = created.signers[0].id;

      // Mock database lookup for simulation
      const reqRow = {
        id: created.id,
        accountId: enterpriseAccountId,
        conversationId,
        externalDocumentKey: created.externalDocumentKey,
        title: created.title,
        documentName: created.documentName,
        originalSha256: created.originalSha256,
        status: 'running',
        autoClose: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const signerRow = {
        id: signerId,
        signatureRequestId: created.id,
        externalSignerKey: 'sig_ext_1',
        requestSignatureKey: created.signers[0].signUrl.split('/').pop() || 'req_1',
        name: 'Renata Gerente',
        email: 'renata@empresa.com',
        authType: 'email',
        signAs: 'sign',
        groupOrder: 1,
        signUrl: created.signers[0].signUrl,
        status: 'pending',
        createdAt: new Date(),
      };

      vi.spyOn(db, 'select')
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [reqRow],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [signerRow],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => Promise.resolve([signerRow]),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [{ ...reqRow, status: 'closed' }],
            }),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => Promise.resolve([{ ...signerRow, status: 'signed' }]),
          }),
        }) as any)
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              limit: () => [userStore.get(enterpriseUserId)],
            }),
          }),
        }) as any);

      const token = app.jwt.sign({
        userId: enterpriseUserId,
        accountId: enterpriseAccountId,
        email: 'diretor@enterprise.com',
        role: 'owner',
      });

      const simRes = await app.inject({
        method: 'POST',
        url: `/api/signatures/${created.id}/signers/${signerId}/simulate`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ipAddress: '189.20.10.5',
          userAgent: 'Mozilla/5.0 Android',
        },
      });

      expect(simRes.statusCode).toBe(200);
      const simData = JSON.parse(simRes.body);
      expect(simData.status).toBe('closed');
      expect(simData.signers[0].status).toBe('signed');
    });
  });

  describe('5. Clicksign Webhooks Ingestion & Security', () => {
    const webhookSecret = 'clicksign-webhook-secret';

    it('processes document.signed webhook and updates signer status', async () => {
      const payload = JSON.stringify({
        event: {
          name: 'document.signed',
          data: {
            document: {
              key: 'doc_webhook_test',
              status: 'running',
            },
            signature: {
              requestSignatureKey: 'req_sig_webhook',
              ip: '177.10.20.30',
              userAgent: 'Mobile Chrome',
            },
          },
        },
      });

      const signature = clicksignService.generateTestWebhookSignature(payload, webhookSecret);

      const mockReq = {
        id: 'sig-webhook-1',
        accountId: enterpriseAccountId,
        conversationId,
        creatorId: enterpriseUserId,
        externalDocumentKey: 'doc_webhook_test',
        title: 'Contrato Webhook',
        documentName: 'contrato.pdf',
        provider: 'clicksign',
        originalSha256: 'sha256',
        status: 'running',
        autoClose: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSigner = {
        id: 'signer-webhook-1',
        signatureRequestId: 'sig-webhook-1',
        requestSignatureKey: 'req_sig_webhook',
        name: 'Maria Webhook',
        email: 'maria@webhook.com',
        authType: 'email',
        signAs: 'sign',
        groupOrder: 1,
        signUrl: 'https://sandbox.clicksign.com/sign/req_sig_webhook',
        status: 'pending',
        createdAt: new Date(),
      };

      signatureRequestStore.set('sig-webhook-1', mockReq);
      signatureSignerStore.set('signer-webhook-1', mockSigner);

      const response = await app.inject({
        method: 'POST',
        url: '/api/signatures/webhooks/clicksign',
        headers: {
          'x-clicksign-signature': signature,
          'content-type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.status).toBe('ok');
      expect(data.handled).toBe(true);
      expect(data.event).toBe('document.signed');
    });

    it('rejects webhooks with invalid HMAC signature', async () => {
      const payload = JSON.stringify({
        event: {
          name: 'document.signed',
          data: { document: { key: 'doc_fake' } },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/signatures/webhooks/clicksign',
        headers: {
          'x-clicksign-signature': 'invalid_forged_signature',
          'content-type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.status).toBe('error');
      expect(data.message).toContain('Assinatura de webhook Clicksign inválida');
    });
  });
});
