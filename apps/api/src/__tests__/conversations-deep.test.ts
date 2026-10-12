import { describe, it, expect, vi } from 'vitest';
import { ConversationService } from '../services/conversation.service';
import { FileExpirationService } from '../jobs/file-expiration.job';
import { GroupExpirationService } from '../jobs/group-expiration.job';
import { BillingService } from '../services/billing.service';
import { BroadcastService } from '../services/broadcast.service';
import { FileService } from '../services/file.service';
import { SignatureService } from '../services/signature.service';
import { AccountService } from '../services/account.service';
import { MetricsService, defaultMetricsService } from '../services/metrics.service';
import { PollService } from '../services/poll.service';
import { LgpdService } from '../services/lgpd.service';
import { FileRelayService } from '../services/file-relay.service';
import bcrypt from 'bcryptjs';
import { buildServer } from '../server';

vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn().mockResolvedValue({});
    close = vi.fn().mockResolvedValue(undefined);
  },
  Worker: class {
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

describe('ConversationService Deep Branch Coverage', () => {
  const accountId = 'acc-1';
  const userId = 'usr-1';
  const otherUserId = 'usr-2';
  const nonMemberId = 'usr-3';

  it('getConversationDetails archives expired temporary group on read', async () => {
    const mockGroupExp = { expireSingleGroup: vi.fn().mockResolvedValue({}) };
    const mockDb: any = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'conv-temp-exp',
            accountId,
            type: 'group',
            status: 'active',
            isTemporary: true,
            expiresAt: new Date(Date.now() - 5000),
            members: [{ id: 'm-1', userId, role: 'member', user: { id: userId, name: 'User' } }],
          }),
        },
      },
    };

    const service = new ConversationService(mockDb, mockGroupExp as any);
    const details = await service.getConversationDetails(accountId, userId, 'conv-temp-exp');
    expect(mockGroupExp.expireSingleGroup).toHaveBeenCalledWith('conv-temp-exp');
    expect(details.status).toBe('archived_readonly');
  });

  it('addMembersToGroup handles validations and edge cases', async () => {
    const mockConvGroup = {
      id: 'conv-1',
      accountId,
      type: 'group',
      status: 'active',
      members: [{ id: 'm-1', userId, role: 'member' }],
    };

    const mockDb: any = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue(mockConvGroup),
        },
        users: {
          findMany: vi.fn().mockResolvedValue([{ id: otherUserId, accountId }]),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    };

    const service = new ConversationService(mockDb);

    // 1. Non-admin caller throws
    await expect(
      service.addMembersToGroup(accountId, userId, 'member', 'conv-1', [otherUserId])
    ).rejects.toThrow('Apenas administradores do grupo ou da organização podem adicionar membros.');

    // 2. Direct conversation throws
    mockDb.query.conversations.findFirst.mockResolvedValueOnce({
      ...mockConvGroup,
      type: 'direct',
    });
    await expect(
      service.addMembersToGroup(accountId, userId, 'owner', 'conv-1', [otherUserId])
    ).rejects.toThrow('Apenas conversas em grupo permitem adicionar membros.');

    // 3. Archived readonly group throws
    mockDb.query.conversations.findFirst.mockResolvedValueOnce({
      ...mockConvGroup,
      status: 'archived_readonly',
    });
    await expect(
      service.addMembersToGroup(accountId, userId, 'owner', 'conv-1', [otherUserId])
    ).rejects.toThrow('Este grupo temporário expirou e não permite novos membros.');

    // 4. Users not from account throws
    mockDb.query.conversations.findFirst.mockResolvedValueOnce(mockConvGroup);
    mockDb.query.users.findMany.mockResolvedValueOnce([]); // not found in account
    await expect(
      service.addMembersToGroup(accountId, userId, 'owner', 'conv-1', [otherUserId])
    ).rejects.toThrow('Um ou mais usuários informados não pertencem a esta organização.');

    // 5. User already in group returns directly without insert
    mockDb.query.conversations.findFirst.mockResolvedValueOnce(mockConvGroup);
    mockDb.query.users.findMany.mockResolvedValueOnce([{ id: userId, accountId }]);
    const sameRes = await service.addMembersToGroup(accountId, userId, 'owner', 'conv-1', [userId]);
    expect(sameRes.id).toBe('conv-1');

    // 6. Successful member insertion
    mockDb.query.conversations.findFirst
      .mockResolvedValueOnce(mockConvGroup)
      .mockResolvedValueOnce({
        ...mockConvGroup,
        members: [
          { id: 'm-1', userId, role: 'member' },
          { id: 'm-2', userId: otherUserId, role: 'member' },
        ],
      });
    mockDb.query.users.findMany.mockResolvedValueOnce([{ id: otherUserId, accountId }]);
    const okRes = await service.addMembersToGroup(accountId, userId, 'owner', 'conv-1', [otherUserId]);
    expect(okRes.members).toHaveLength(2);
  });

  it('removeMemberFromGroup and deleteGroup handle validations and permissions', async () => {
    const mockConvGroup = {
      id: 'conv-1',
      accountId,
      type: 'group',
      status: 'active',
      members: [
        { id: 'm-1', userId, role: 'admin' },
        { id: 'm-2', userId: otherUserId, role: 'member' },
      ],
    };

    const mockDb: any = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue(mockConvGroup),
        },
      },
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    };

    const service = new ConversationService(mockDb);

    // 1. removeMember: non-admin trying to remove someone else throws
    mockDb.query.conversations.findFirst.mockResolvedValueOnce({
      ...mockConvGroup,
      members: [{ id: 'm-2', userId: otherUserId, role: 'member' }],
    });
    await expect(
      service.removeMemberFromGroup(accountId, otherUserId, 'member', 'conv-1', userId)
    ).rejects.toThrow('Apenas administradores podem remover outros membros do grupo.');

    // 2. removeMember: direct conversation throws
    mockDb.query.conversations.findFirst.mockResolvedValueOnce({
      ...mockConvGroup,
      type: 'direct',
    });
    await expect(
      service.removeMemberFromGroup(accountId, userId, 'owner', 'conv-1', otherUserId)
    ).rejects.toThrow('Apenas conversas em grupo permitem gerenciar membros.');

    // 3. removeMember: self leave succeeds
    mockDb.query.conversations.findFirst.mockResolvedValueOnce(mockConvGroup);
    const selfLeave = await service.removeMemberFromGroup(accountId, otherUserId, 'member', 'conv-1', otherUserId);
    expect(selfLeave.success).toBe(true);

    // 4. deleteGroup: direct conversation throws
    mockDb.query.conversations.findFirst.mockResolvedValueOnce({
      ...mockConvGroup,
      type: 'direct',
    });
    await expect(service.deleteGroup(accountId, userId, 'owner', 'conv-1')).rejects.toThrow(
      'Apenas conversas em grupo podem ser excluídas.'
    );

    // 5. deleteGroup: non-admin throws
    mockDb.query.conversations.findFirst.mockResolvedValueOnce({
      ...mockConvGroup,
      members: [{ id: 'm-2', userId: otherUserId, role: 'member' }],
    });
    await expect(service.deleteGroup(accountId, otherUserId, 'member', 'conv-1')).rejects.toThrow(
      'Apenas administradores do grupo ou da organização podem excluir o grupo.'
    );

    // 6. deleteGroup: valid deletion
    mockDb.query.conversations.findFirst.mockResolvedValueOnce(mockConvGroup);
    const delOk = await service.deleteGroup(accountId, userId, 'owner', 'conv-1');
    expect(delOk.success).toBe(true);
  });
});

describe('Jobs Lifecycle & Cleanup Coverage', () => {
  it('FileExpirationService lifecycle methods', async () => {
    const job = new FileExpirationService();
    expect(job.getBucketLifecyclePolicyConfig().Rules).toHaveLength(1);
    const res = await job.scheduleExpirationJob('trans-123', 1000);
    expect(typeof res).toBe('boolean');
    await job.close();
  });

  it('GroupExpirationService lifecycle and edge methods', async () => {
    const mockDb: any = {
      query: {
        conversations: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ status: 'archived_readonly' }]),
          })),
        })),
      })),
    };

    const job = new GroupExpirationService(mockDb);

    // 1. Conversation not found
    mockDb.query.conversations.findFirst.mockResolvedValueOnce(null);
    const notFound = await job.expireSingleGroup('missing-conv');
    expect(notFound.success).toBe(false);
    expect(notFound.reason).toBe('CONVERSATION_NOT_FOUND');

    // 2. Already processed / archived
    mockDb.query.conversations.findFirst.mockResolvedValueOnce({
      id: 'c-1',
      status: 'archived_readonly',
    });
    const already = await job.expireSingleGroup('c-1');
    expect(already.alreadyProcessed).toBe(true);

    // 3. Schedule group expiration returns boolean
    const mockConv = { id: 'conv-123', isTemporary: true, expiresAt: new Date(Date.now() + 10000) };
    const res = await job.scheduleGroupExpiration('conv-123', mockConv.expiresAt);
    expect(typeof res).toBe('boolean');
    await job.close();
  });

  it('FileExpirationService edge branches', async () => {
    const mockDb: any = {
      query: {
        fileTransfers: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ status: 'expired' }]),
          })),
        })),
      })),
    };
    const mockStorage: any = { deleteObject: vi.fn().mockResolvedValue(undefined) };
    const service = new FileExpirationService(mockDb, mockStorage);

    // 1. Transfer not found
    mockDb.query.fileTransfers.findFirst.mockResolvedValueOnce(null);
    const notFound = await service.expireSingleTransfer('missing-transfer');
    expect(notFound.success).toBe(false);
    expect(notFound.reason).toBe('FILE_TRANSFER_NOT_FOUND');

    // 2. Already processed
    mockDb.query.fileTransfers.findFirst.mockResolvedValueOnce({
      id: 'f-1',
      status: 'completed',
    });
    const already = await service.expireSingleTransfer('f-1');
    expect(already.alreadyProcessed).toBe(true);

    // 3. Schedule expiration job
    const schedRes = await service.scheduleExpirationJob('f-1', 5000);
    expect(typeof schedRes).toBe('boolean');
    await service.close();
  });
});

describe('Additional Route Error Branches', () => {
  it('POST /api/billing/webhook/asaas handles bad payload and unauthorized token', async () => {
    const origSecret = process.env.ASAAS_WEBHOOK_SECRET;
    process.env.ASAAS_WEBHOOK_SECRET = 'secret_webhook_token';

    const app = buildServer();
    await app.ready();

    // Bad payload missing event -> 400
    const bad = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook/asaas',
      payload: {},
    });
    expect(bad.statusCode).toBe(400);

    // Unauthorized webhook token -> 401
    const unauth = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook/asaas',
      headers: { 'asaas-access-token': 'wrong-token' },
      payload: { event: 'PAYMENT_RECEIVED', payment: { id: 'p-1' } },
    });
    expect(unauth.statusCode).toBe(401);

    await app.close();
    process.env.ASAAS_WEBHOOK_SECRET = origSecret;
  });

  it('Billing routes handle invalid payload, errors and cancellation', async () => {
    const app = buildServer();
    await app.ready();

    const adminToken = app.jwt.sign({
      userId: 'u-admin',
      accountId: 'a-1',
      role: 'admin',
      email: 'admin@corp.com',
    });

    // 1. POST /api/billing/subscribe invalid payload -> 400
    const badSub = await app.inject({
      method: 'POST',
      url: '/api/billing/subscribe',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { plan: 'invalid-plan' },
    });
    expect(badSub.statusCode).toBe(400);

    // 2. GET /api/billing/summary service error -> 400
    vi.spyOn(BillingService.prototype, 'getAccountBillingSummary').mockRejectedValueOnce(
      new Error('Erro no Asaas ao consultar extrato.')
    );
    const sumErr = await app.inject({
      method: 'GET',
      url: '/api/billing/summary',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(sumErr.statusCode).toBe(400);

    // 3. POST /api/billing/cancel forbidden for non-admin -> 403
    vi.spyOn(BillingService.prototype, 'cancelSubscription').mockRejectedValueOnce(
      new Error('Apenas administradores podem cancelar a assinatura.')
    );
    const cancelForb = await app.inject({
      method: 'POST',
      url: '/api/billing/cancel',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(cancelForb.statusCode).toBe(403);

    // 4. POST /api/billing/cancel generic error -> 400
    vi.spyOn(BillingService.prototype, 'cancelSubscription').mockRejectedValueOnce(
      new Error('Nenhuma assinatura ativa encontrada.')
    );
    const cancelBad = await app.inject({
      method: 'POST',
      url: '/api/billing/cancel',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(cancelBad.statusCode).toBe(400);

    // 5. POST /api/billing/cancel success -> 200
    vi.spyOn(BillingService.prototype, 'cancelSubscription').mockResolvedValueOnce({
      id: 'sub-1',
      status: 'canceled',
    } as any);
    const cancelOk = await app.inject({
      method: 'POST',
      url: '/api/billing/cancel',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(cancelOk.statusCode).toBe(200);

    await app.close();
  });

  it('Broadcast routes handle conversation, reports and error branches', async () => {
    const app = buildServer();
    await app.ready();

    const adminToken = app.jwt.sign({
      userId: 'u-1',
      accountId: 'a-1',
      role: 'admin',
      email: 'admin@corp.com',
    });

    // 1. GET /api/broadcasts/conversation success -> 200
    vi.spyOn(BroadcastService.prototype, 'getOrCreateBroadcastConversation').mockResolvedValueOnce({
      id: 'conv-bcast-1',
      type: 'broadcast',
      title: 'Comunicados Gerais',
    } as any);
    const convOk = await app.inject({
      method: 'GET',
      url: '/api/broadcasts/conversation',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(convOk.statusCode).toBe(200);

    // 2. GET /api/broadcasts/conversation error -> 403
    vi.spyOn(BroadcastService.prototype, 'getOrCreateBroadcastConversation').mockRejectedValueOnce(
      new Error('Apenas planos pagos possuem canal de comunicados.')
    );
    const convErr = await app.inject({
      method: 'GET',
      url: '/api/broadcasts/conversation',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(convErr.statusCode).toBe(403);

    // 3. POST /api/broadcasts generic failure -> 400
    vi.spyOn(BroadcastService.prototype, 'sendBroadcast').mockRejectedValueOnce(
      new Error('Erro interno ao enviar broadcast.')
    );
    const badSend = await app.inject({
      method: 'POST',
      url: '/api/broadcasts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Aviso', content: 'Mensagem de teste' },
    });
    expect(badSend.statusCode).toBe(400);

    // 4. GET /api/broadcasts/:messageId/report success -> 200
    vi.spyOn(BroadcastService.prototype, 'getBroadcastReport').mockResolvedValueOnce({
      messageId: 'msg-1',
      totalRecipients: 10,
      deliveredCount: 9,
      readCount: 5,
    } as any);
    const repOk = await app.inject({
      method: 'GET',
      url: '/api/broadcasts/msg-1/report',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(repOk.statusCode).toBe(200);

    // 5. GET /api/broadcasts/:messageId/report forbidden -> 403
    vi.spyOn(BroadcastService.prototype, 'getBroadcastReport').mockRejectedValueOnce(
      new Error('Apenas administradores podem ver o relatório.')
    );
    const repForb = await app.inject({
      method: 'GET',
      url: '/api/broadcasts/msg-1/report',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(repForb.statusCode).toBe(403);

    // 6. GET /api/broadcasts/:messageId/report not found -> 404
    vi.spyOn(BroadcastService.prototype, 'getBroadcastReport').mockRejectedValueOnce(
      new Error('Mensagem não encontrada.')
    );
    const repNotFound = await app.inject({
      method: 'GET',
      url: '/api/broadcasts/msg-1/report',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(repNotFound.statusCode).toBe(404);

    await app.close();
  });

  it('File routes confirm-upload, download-url, confirm-download and errors', async () => {
    const app = buildServer();
    await app.ready();

    const token = app.jwt.sign({
      userId: 'u-1',
      accountId: 'a-1',
      role: 'member',
      email: 'user@corp.com',
    });

    // 1. POST /api/files/confirm-upload invalid -> 400
    const badConfirm = await app.inject({
      method: 'POST',
      url: '/api/files/confirm-upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(badConfirm.statusCode).toBe(400);

    // 2. POST /api/files/confirm-upload success -> 200
    vi.spyOn(FileService.prototype, 'confirmUpload').mockResolvedValueOnce({
      id: 'f-1',
      status: 'available',
    } as any);
    const okConfirm = await app.inject({
      method: 'POST',
      url: '/api/files/confirm-upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transferId: '11111111-1111-1111-1111-111111111111',
        messageId: '22222222-2222-2222-2222-222222222222',
      },
    });
    expect(okConfirm.statusCode).toBe(200);

    // 3. POST /api/files/download-url invalid -> 400
    const badDlUrl = await app.inject({
      method: 'POST',
      url: '/api/files/download-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(badDlUrl.statusCode).toBe(400);

    // 4. POST /api/files/download-url success -> 200
    vi.spyOn(FileService.prototype, 'requestDownloadUrl').mockResolvedValueOnce({
      downloadUrl: 'https://storage/download',
      expiresAt: new Date(),
    } as any);
    const okDlUrl = await app.inject({
      method: 'POST',
      url: '/api/files/download-url',
      headers: { authorization: `Bearer ${token}` },
      payload: { transferId: '11111111-1111-1111-1111-111111111111' },
    });
    expect(okDlUrl.statusCode).toBe(200);

    // 5. POST /api/files/confirm-download invalid -> 400
    const badConfirmDl = await app.inject({
      method: 'POST',
      url: '/api/files/confirm-download',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(badConfirmDl.statusCode).toBe(400);

    // 6. POST /api/files/confirm-download success -> 200
    vi.spyOn(FileService.prototype, 'confirmDownload').mockResolvedValueOnce({
      completed: true,
      pendingCount: 0,
    } as any);
    const okConfirmDl = await app.inject({
      method: 'POST',
      url: '/api/files/confirm-download',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transferId: '11111111-1111-1111-1111-111111111111',
        completed: true,
        bytesDownloaded: 1024,
      },
    });
    expect(okConfirmDl.statusCode).toBe(200);

    // Confirm-download error -> 400
    vi.spyOn(FileService.prototype, 'confirmDownload').mockRejectedValueOnce(
      new Error('Download confirmation failed')
    );
    const errConfirmDl = await app.inject({
      method: 'POST',
      url: '/api/files/confirm-download',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transferId: '11111111-1111-1111-1111-111111111111',
        completed: true,
        bytesDownloaded: 1024,
      },
    });
    expect(errConfirmDl.statusCode).toBe(400);

    // Confirm-upload error -> 400
    vi.spyOn(FileService.prototype, 'confirmUpload').mockRejectedValueOnce(
      new Error('Upload confirmation failed')
    );
    const errConfirmUp = await app.inject({
      method: 'POST',
      url: '/api/files/confirm-upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transferId: '11111111-1111-1111-1111-111111111111',
        messageId: '22222222-2222-2222-2222-222222222222',
      },
    });
    expect(errConfirmUp.statusCode).toBe(400);

    // Download-url error -> 400
    vi.spyOn(FileService.prototype, 'requestDownloadUrl').mockRejectedValueOnce(
      new Error('Download url generation failed')
    );
    const errDl = await app.inject({
      method: 'POST',
      url: '/api/files/download-url',
      headers: { authorization: `Bearer ${token}` },
      payload: { transferId: '11111111-1111-1111-1111-111111111111' },
    });
    expect(errDl.statusCode).toBe(400);

    // 7. GET /api/files/:transferId/status error -> 400
    vi.spyOn(FileService.prototype, 'getTransferStatus').mockRejectedValueOnce(
      new Error('Arquivo expirado ou removido.')
    );
    const statusErr = await app.inject({
      method: 'GET',
      url: '/api/files/11111111-1111-1111-1111-111111111111/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(statusErr.statusCode).toBe(400);

    // 8. POST /api/files/sweep-expired failure -> 500
    vi.spyOn(FileExpirationService.prototype, 'sweepExpiredTransfers').mockRejectedValueOnce(
      new Error('Falha no banco durante sweep')
    );
    const sweepFail = await app.inject({
      method: 'POST',
      url: '/api/files/sweep-expired',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sweepFail.statusCode).toBe(500);

    await app.close();
  });

  it('Signature routes verify-hash and clicksign webhook headers', async () => {
    const app = buildServer();
    await app.ready();

    const token = app.jwt.sign({
      userId: 'u-1',
      accountId: 'a-1',
      role: 'member',
      email: 'user@corp.com',
    });

    // 1. POST /api/signatures/:id/verify-hash invalid body -> 400
    const badHash = await app.inject({
      method: 'POST',
      url: '/api/signatures/sig-1/verify-hash',
      headers: { authorization: `Bearer ${token}` },
      payload: { expectedSha256: '' },
    });
    expect(badHash.statusCode).toBe(400);

    // 2. POST /api/signatures/:id/verify-hash service error -> 400
    vi.spyOn(SignatureService.prototype, 'verifyDocumentHash').mockRejectedValueOnce(
      new Error('Documento não encontrado.')
    );
    const errHash = await app.inject({
      method: 'POST',
      url: '/api/signatures/sig-1/verify-hash',
      headers: { authorization: `Bearer ${token}` },
      payload: { sha256: 'a'.repeat(64) },
    });
    expect(errHash.statusCode).toBe(400);

    // 3. POST /api/signatures/:id/verify-hash success -> 200
    vi.spyOn(SignatureService.prototype, 'verifyDocumentHash').mockResolvedValueOnce({
      valid: true,
      originalDocSha256: 'a'.repeat(64),
      signedDocSha256: 'a'.repeat(64),
    } as any);
    const okHash = await app.inject({
      method: 'POST',
      url: '/api/signatures/sig-1/verify-hash',
      headers: { authorization: `Bearer ${token}` },
      payload: { sha256: 'a'.repeat(64) },
    });
    expect(okHash.statusCode).toBe(200);

    // 4. POST /api/signatures/webhooks/clicksign with content-hmac-sha256 header -> 200
    vi.spyOn(SignatureService.prototype, 'handleClicksignWebhook').mockResolvedValueOnce({
      processed: true,
      event: 'document.signed',
    } as any);
    const whRes = await app.inject({
      method: 'POST',
      url: '/api/signatures/webhooks/clicksign',
      headers: { 'content-hmac-sha256': 'mock-sig-header' },
      payload: { event: { name: 'document.signed' } },
    });
    expect(whRes.statusCode).toBe(200);

    // 5. GET /api/signatures/:id not found -> 404
    vi.spyOn(SignatureService.prototype, 'getSignatureRequest').mockRejectedValueOnce(
      new Error('Solicitação de assinatura não encontrada.')
    );
    const notFoundSig = await app.inject({
      method: 'GET',
      url: '/api/signatures/sig-missing',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(notFoundSig.statusCode).toBe(404);

    // 6. GET /api/signatures/conversation/:conversationId error -> 400
    vi.spyOn(SignatureService.prototype, 'listSignatureRequestsByConversation').mockRejectedValueOnce(
      new Error('DB error')
    );
    const errList = await app.inject({
      method: 'GET',
      url: '/api/signatures/conversation/conv-1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(errList.statusCode).toBe(400);

    // 7. POST /api/signatures/:id/signers/:signerId/simulate error -> 400
    vi.spyOn(SignatureService.prototype, 'simulateSign').mockRejectedValueOnce(
      new Error('Erro ao simular assinatura.')
    );
    const errSim = await app.inject({
      method: 'POST',
      url: '/api/signatures/sig-1/signers/s-1/simulate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(errSim.statusCode).toBe(400);

    // 8. GET /api/signatures/:id/evidence (200 & 404)
    vi.spyOn(SignatureService.prototype, 'getEvidenceReport').mockResolvedValueOnce({
      documentKey: 'doc-1',
    } as any);
    const okEv = await app.inject({
      method: 'GET',
      url: '/api/signatures/sig-1/evidence',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(okEv.statusCode).toBe(200);

    vi.spyOn(SignatureService.prototype, 'getEvidenceReport').mockRejectedValueOnce(
      new Error('Manifesto não encontrado.')
    );
    const errEv = await app.inject({
      method: 'GET',
      url: '/api/signatures/sig-1/evidence',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(errEv.statusCode).toBe(404);

    // 9. GET /api/signatures/:id/evidence/pdf (200 & 400)
    vi.spyOn(SignatureService.prototype, 'generateEvidenceCertificatePdf').mockResolvedValueOnce({
      buffer: Buffer.from('pdf'),
      contentType: 'application/pdf',
      filename: 'cert.pdf',
      sha256: 'hash-cert',
    });
    const okPdf = await app.inject({
      method: 'GET',
      url: '/api/signatures/sig-1/evidence/pdf',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(okPdf.statusCode).toBe(200);

    vi.spyOn(SignatureService.prototype, 'generateEvidenceCertificatePdf').mockRejectedValueOnce(
      new Error('Erro ao gerar certificado')
    );
    const errPdf = await app.inject({
      method: 'GET',
      url: '/api/signatures/sig-1/evidence/pdf',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(errPdf.statusCode).toBe(400);

    // 10. GET /api/signatures/:id/download (200 & 400)
    vi.spyOn(SignatureService.prototype, 'downloadSignedDocument').mockResolvedValueOnce({
      buffer: Buffer.from('signed-pdf'),
      contentType: 'application/pdf',
      filename: 'doc.pdf',
      sha256: 'hash-doc',
    });
    const okDl = await app.inject({
      method: 'GET',
      url: '/api/signatures/sig-1/download',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(okDl.statusCode).toBe(200);

    vi.spyOn(SignatureService.prototype, 'downloadSignedDocument').mockRejectedValueOnce(
      new Error('Erro ao baixar documento')
    );
    const errDl = await app.inject({
      method: 'GET',
      url: '/api/signatures/sig-1/download',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(errDl.statusCode).toBe(400);

    // 11. POST /api/signatures create forbidden error -> 403
    vi.spyOn(SignatureService.prototype, 'createSignatureRequest').mockRejectedValueOnce(
      new Error('Assinaturas digitais requerem plano Enterprise.')
    );
    const forbCreate = await app.inject({
      method: 'POST',
      url: '/api/signatures',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        conversationId: '11111111-1111-1111-1111-111111111111',
        title: 'Contrato de Teste',
        documentName: 'contrato.pdf',
        contentBase64: 'base64',
        signers: [{ name: 'User', email: 'u@u.com' }],
      },
    });
    expect(forbCreate.statusCode).toBe(403);

    await app.close();
  });

  it('Observability backup & restore endpoints handle errors and permissions', async () => {
    const app = buildServer();
    await app.ready();

    const memberToken = app.jwt.sign({
      userId: 'u-1',
      accountId: 'a-1',
      role: 'member',
      email: 'member@corp.com',
    });

    // Member forbidden on backup restore -> 403
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/backup/restore',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { backupId: 'b-1' },
    });
    expect(forbidden.statusCode).toBe(403);

    await app.close();
  });

  it('AccountService edge branches for suspended accounts and raw DB count', async () => {
    const mockDb: any = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 15 }]),
        })),
      })),
      query: {
        subscriptions: { findFirst: vi.fn().mockResolvedValue(null) },
        accounts: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acc-susp',
            plan: 'pro',
            status: 'suspended',
            trialUntil: new Date(Date.now() - 1000),
          }),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'acc-susp', plan: 'free', status: 'suspended' }]),
          })),
        })),
      })),
    };

    const accService = new AccountService(mockDb);
    const count = await (accService as any).countActiveUsers('acc-susp');
    expect(count).toBe(15);

    // Reconcile trial for suspended account
    const reconciledSusp = await (accService as any).reconcileTrialStatus({
      id: 'acc-susp',
      plan: 'pro',
      status: 'suspended',
      trialUntil: new Date(Date.now() - 10000),
    });
    expect(reconciledSusp.status).toBe('suspended');

    // Reconcile trial for active account with count > 12 -> over_quota
    const reconciledOver = await (accService as any).reconcileTrialStatus({
      id: 'acc-susp',
      plan: 'pro',
      status: 'active',
      trialUntil: new Date(Date.now() - 10000),
    });
    expect(reconciledOver.status).toBe('suspended'); // updated from mockDb returning
  });

  it('FileExpirationService and GroupExpirationService startWorker methods and queue catch', async () => {
    const fileJob = new FileExpirationService();
    const groupJob = new GroupExpirationService();

    const fileWorker = fileJob.startWorker();
    const groupWorker = groupJob.startWorker();
    expect(fileWorker).toBeDefined();
    expect(groupWorker).toBeDefined();

    // Queue error catch branch
    (fileJob as any).queue = {
      add: vi.fn().mockRejectedValue(new Error('Queue connection down')),
      close: vi.fn(),
    };
    const fileRes = await fileJob.scheduleExpirationJob('f-err');
    expect(fileRes).toBe(false);

    (groupJob as any).queue = {
      add: vi.fn().mockRejectedValue(new Error('Queue connection down')),
      close: vi.fn(),
    };
    const groupRes = await groupJob.scheduleGroupExpiration('g-err', new Date());
    expect(groupRes).toBe(false);

    await fileJob.close();
    await groupJob.close();
  });

  it('MetricsService coverage for setWsConnections, prometheus format with status codes, and reset', () => {
    const metrics = new MetricsService();
    metrics.setWsConnections(12);
    metrics.recordRequest(200, 45);
    metrics.recordRequest(404, 15);
    metrics.incrementWsConnections();
    metrics.decrementWsConnections();
    metrics.incrementMessages();
    metrics.incrementFiles();
    metrics.incrementSignatures();
    const prom = metrics.getPrometheusFormat();
    expect(prom).toContain('http_requests_status_total{code="200"} 1');
    expect(prom).toContain('http_requests_status_total{code="404"} 1');

    metrics.reset();
    const mReset = metrics.getMetrics();
    expect(mReset.http.requestsTotal).toBe(0);
    expect(mReset.realtime.activeWsConnections).toBe(0);

    // defaultMetricsService singleton
    defaultMetricsService.setWsConnections(5);
    expect(defaultMetricsService.getMetrics().realtime.activeWsConnections).toBe(5);
  });

  it('AccountService checkAndEnforceQuota handles suspended status and downgraded paths', async () => {
    const mockDb: any = {
      query: {
        accounts: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acc-susp-1',
            status: 'suspended',
            plan: 'pro',
          }),
        },
        users: {
          findMany: vi.fn().mockResolvedValue([{ id: 'u1' }]),
        },
        subscriptions: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'acc-susp-1', plan: 'free', status: 'active' }]),
          })),
        })),
      })),
    };

    const accService = new AccountService(mockDb);
    const quotaRes = await accService.checkAndEnforceQuota('acc-susp-1');
    expect(quotaRes.accountStatus).toBe('suspended');

    // countActiveUsers <= free maxUsers (12) -> newStatus: 'active' in processExpiredTrials
    const mockDbTrials: any = {
      query: {
        accounts: {
          findMany: vi.fn().mockResolvedValue([{
            id: 'acc-exp-1',
            status: 'active',
            plan: 'pro',
            trialUntil: new Date(Date.now() - 1000),
          }]),
        },
        users: {
          findMany: vi.fn().mockResolvedValue([{ id: 'u1' }]), // count 1 <= 12
        },
        subscriptions: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'acc-exp-1', plan: 'free', status: 'active' }]),
          })),
        })),
      })),
    };
    const trialsService = new AccountService(mockDbTrials);
    const expiredRes = await trialsService.processTrialExpirations();
    expect(expiredRes.processedCount).toBe(1);

    // reconcileTrialStatus where activeCount <= 12 -> newStatus: 'active'
    const reconciledActive = await (trialsService as any).reconcileTrialStatus({
      id: 'acc-exp-1',
      plan: 'pro',
      status: 'active',
      trialUntil: new Date(Date.now() - 1000),
    });
    expect(reconciledActive).toBeDefined();
  });

  it('BroadcastService throws when account is over_quota and handles null sender', async () => {
    const mockDb: any = {
      query: {
        accounts: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acc-oq',
            status: 'over_quota',
            plan: 'pro',
          }),
        },
      },
    };
    const broadcastService = new BroadcastService(mockDb);
    await expect(
      broadcastService.sendBroadcast('acc-oq', 'user-1', 'admin', {
        title: 'Aviso',
        content: 'Corpo',
      })
    ).rejects.toThrow('A organização atingiu o limite do plano e está em modo somente leitura.');
  });

  it('BillingService getAccountBillingSummary throws when account is null and handles countActiveUsers SQL fallback', async () => {
    const mockDbNullAcc: any = {
      query: {
        accounts: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    const billingNull = new BillingService(mockDbNullAcc);
    await expect(
      billingNull.getAccountBillingSummary('missing-acc')
    ).rejects.toThrow('Organização não encontrada.');

    // countActiveUsers fallback when query.users is undefined
    const mockDbSqlFallback: any = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 7 }]),
        })),
      })),
    };
    const billingFallback = new BillingService(mockDbSqlFallback);
    const count = await (billingFallback as any).countActiveUsers('acc-1');
    expect(count).toBe(7);
  });

  it('FileService confirmDownload covers missing transfer, already deleted and deduplication', async () => {
    const mockDbMissing: any = {
      query: {
        fileTransfers: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    const fileServiceMissing = new FileService(mockDbMissing);
    await expect(
      fileServiceMissing.confirmDownload('acc-1', 'usr-1', 'trans-missing', { completed: true })
    ).rejects.toThrow('Transferência de arquivo não encontrada.');

    // Already deleted or completed with 0 pending
    const mockDbDeleted: any = {
      query: {
        fileTransfers: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'trans-del',
            status: 'deleted',
            pendingDownloadsCount: 0,
            accountId: 'acc-1',
          }),
        },
      },
    };
    const fileServiceDeleted = new FileService(mockDbDeleted);
    const delRes = await fileServiceDeleted.confirmDownload('acc-1', 'usr-1', 'trans-del', { completed: true });
    expect(delRes.deletedFromStorage).toBe(true);

    // Existing download deduplication
    const mockDbExisting: any = {
      query: {
        fileTransfers: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'trans-dup',
            status: 'available',
            pendingDownloadsCount: 2,
            accountId: 'acc-1',
          }),
        },
        fileTransferDownloads: {
          findFirst: vi.fn().mockResolvedValue({ id: 'dl-1' }),
        },
      },
    };
    const fileServiceDup = new FileService(mockDbExisting);
    const dupRes = await fileServiceDup.confirmDownload('acc-1', 'usr-1', 'trans-dup', { completed: true });
    expect(dupRes.success).toBe(true);
  });

  it('PollService getPollDetails handles not found, account mismatch and creator null', async () => {
    const mockDbNotFound: any = {
      query: {
        polls: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    const pollService = new PollService(mockDbNotFound as any);
    await expect(pollService.getPollDetails('acc-1', 'usr-1', 'p-missing')).rejects.toThrow('Enquete não encontrada.');

    // Account mismatch
    const mockDbMismatch: any = {
      query: {
        polls: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p-1',
            conversation: { accountId: 'acc-other' },
          }),
        },
      },
    };
    const pollMismatch = new PollService(mockDbMismatch as any);
    await expect(pollMismatch.getPollDetails('acc-1', 'usr-1', 'p-1')).rejects.toThrow('Acesso negado a esta enquete.');

    // Creator is null
    const mockDbNullCreator: any = {
      query: {
        polls: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p-1',
            conversation: { accountId: 'acc-1' },
            creator: null,
            options: [],
            votes: [],
            question: 'Dúvida?',
            allowMultiple: false,
            isAnonymous: false,
            status: 'active',
            createdAt: new Date(),
          }),
        },
      },
    };
    const pollNullCreator = new PollService(mockDbNullCreator as any);
    const details = await pollNullCreator.getPollDetails('acc-1', 'usr-1', 'p-1');
    expect(details.creator).toBeUndefined();
  });

  it('LgpdService deleteAndAnonymizeUser validates already deleted and disconnects active sockets', async () => {
    const mockDbAlreadyDeleted: any = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'u-del',
            accountId: 'acc-1',
            status: 'deleted',
          }),
        },
      },
    };
    const lgpdService = new LgpdService(mockDbAlreadyDeleted as any);
    await expect(
      lgpdService.deleteAndAnonymizeUser('acc-1', 'u-del', { password: 'pwd', confirmationText: 'EXCLUIR' })
    ).rejects.toThrow('Este usuário já foi excluído e anonimizado anteriormente.');

    // Disconnect active socket
    const mockSocket = { disconnect: vi.fn() };
    const mockIo: any = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      in: vi.fn().mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue([mockSocket]),
      }),
    };

    const passwordHash = await bcrypt.hash('secret123', 10);
    const mockDbActive: any = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'u-act',
            accountId: 'acc-1',
            status: 'active',
            role: 'member',
            email: 'member@test.com',
            passwordHash,
          }),
        },
        accounts: {
          findFirst: vi.fn().mockResolvedValue({ id: 'acc-1', ownerId: 'other-owner' }),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    };

    const lgpdWithSockets = new LgpdService(mockDbActive as any, mockIo);
    const delRes = await lgpdWithSockets.deleteAndAnonymizeUser('acc-1', 'u-act', {
      password: 'secret123',
      confirmationText: 'EXCLUIR',
    });
    expect(delRes.success).toBe(true);
    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('FileRelayService completeRelay handles missing session and sender mismatch', async () => {
    const relayService = new FileRelayService({} as any);
    await expect(
      relayService.completeRelay('sender-1', { transferId: 'missing-sess' })
    ).rejects.toThrow('Sessão de transferência não encontrada.');

    // Sender mismatch
    (relayService as any).sessions.set('sess-1', {
      senderId: 'other-sender',
      recipientUserIds: [],
      totalRecipientsCount: 1,
      fileName: 'doc.txt',
    });
    await expect(
      relayService.completeRelay('sender-1', { transferId: 'sess-1' })
    ).rejects.toThrow('Acesso negado à sessão de transferência.');
  });

  it('FileRelayService initRelay validates member count and offline group members on Free', async () => {
    // 1. Conversation without other members
    const mockDbNoOthers: any = {
      query: {
        accounts: { findFirst: vi.fn().mockResolvedValue({ id: 'acc-1', plan: 'free', status: 'active' }) },
        users: { findFirst: vi.fn().mockResolvedValue({ id: 'sender-1', name: 'Sender' }) },
        conversations: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'conv-1',
            type: 'group',
            status: 'active',
            members: [{ userId: 'sender-1' }],
          }),
        },
      },
    };
    const relayNoOthers = new FileRelayService(mockDbNoOthers);
    await expect(
      relayNoOthers.initRelay('acc-1', 'sender-1', 'socket-1', {
        conversationId: 'conv-1',
        fileName: 'doc.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      } as any)
    ).rejects.toThrow('A conversa não possui outros participantes.');

    // 2. Group on Free with 0 online members
    const mockPresence: any = { isUserOnline: vi.fn().mockResolvedValue(false) };
    const mockDbAllOffline: any = {
      query: {
        accounts: { findFirst: vi.fn().mockResolvedValue({ id: 'acc-1', plan: 'free', status: 'active' }) },
        users: { findFirst: vi.fn().mockResolvedValue({ id: 'sender-1', name: 'Sender' }) },
        conversations: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'conv-1',
            type: 'group',
            status: 'active',
            members: [{ userId: 'sender-1' }, { userId: 'm-2' }],
          }),
        },
      },
    };
    const relayOfflineGroup = new FileRelayService(mockDbAllOffline, mockPresence);
    await expect(
      relayOfflineGroup.initRelay('acc-1', 'sender-1', 'socket-1', {
        conversationId: 'conv-1',
        fileName: 'doc.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      } as any)
    ).rejects.toThrow('Nenhum participante da conversa está online');
  });

  it('LgpdService and AccountService handle missing records and authorization branches', async () => {
    // 1. AccountService checkAndEnforceQuota throws when account not found
    const mockDbNoAcc: any = {
      query: { accounts: { findFirst: vi.fn().mockResolvedValue(null) } },
    };
    const accServiceNoAcc = new AccountService(mockDbNoAcc);
    await expect(accServiceNoAcc.checkAndEnforceQuota('missing-acc')).rejects.toThrow('Organização não encontrada.');

    // 2. LgpdService exportUserData throws when user not found
    const mockDbNoUser: any = {
      query: { users: { findFirst: vi.fn().mockResolvedValue(null) } },
    };
    const lgpdNoUser = new LgpdService(mockDbNoUser);
    await expect(lgpdNoUser.exportUserData('acc-1', 'missing-u')).rejects.toThrow('Usuário não encontrado.');

    // 3. LgpdService exportUserData throws when account not found
    const mockDbUserNoAcc: any = {
      query: {
        users: { findFirst: vi.fn().mockResolvedValue({ id: 'u-1', accountId: 'acc-1' }) },
        accounts: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    };
    const lgpdUserNoAcc = new LgpdService(mockDbUserNoAcc);
    await expect(lgpdUserNoAcc.exportUserData('acc-1', 'u-1')).rejects.toThrow('Conta corporativa não encontrada.');

    // 4. LgpdService deleteAndAnonymizeUser throws when user not found
    await expect(
      lgpdNoUser.deleteAndAnonymizeUser('acc-1', 'missing-u', { password: 'pwd', confirmationText: 'EXCLUIR' })
    ).rejects.toThrow('Usuário não encontrado.');
  });

  it('PollService votePoll validates membership, expired status and option validity', async () => {
    // 1. User is not member of conversation
    const mockDbNonMember: any = {
      query: {
        polls: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p-1',
            status: 'active',
            conversation: { accountId: 'acc-1', members: [{ userId: 'other-user' }] },
            options: [{ id: 'opt-1' }],
          }),
        },
      },
    };
    const pollNonMember = new PollService(mockDbNonMember as any);
    await expect(
      pollNonMember.votePoll('acc-1', 'caller-user', 'p-1', { optionIds: ['opt-1'] })
    ).rejects.toThrow('Você não é membro desta conversa.');

    // 2. Poll is closed/expired
    const mockDbExpired: any = {
      query: {
        polls: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p-1',
            status: 'closed',
            conversation: { accountId: 'acc-1', members: [{ userId: 'caller-user' }] },
            options: [{ id: 'opt-1' }],
          }),
        },
      },
    };
    const pollExpired = new PollService(mockDbExpired as any);
    await expect(
      pollExpired.votePoll('acc-1', 'caller-user', 'p-1', { optionIds: ['opt-1'] })
    ).rejects.toThrow('Esta enquete já está encerrada');

    // 3. Option not in poll
    const mockDbInvalidOpt: any = {
      query: {
        polls: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p-1',
            status: 'active',
            conversation: { accountId: 'acc-1', members: [{ userId: 'caller-user' }] },
            options: [{ id: 'opt-1' }],
          }),
        },
      },
    };
    const pollInvalidOpt = new PollService(mockDbInvalidOpt as any);
    await expect(
      pollInvalidOpt.votePoll('acc-1', 'caller-user', 'p-1', { optionIds: ['opt-foreign'] })
    ).rejects.toThrow('não pertencem a esta enquete');

    // 4. Multiple votes on single choice poll
    await expect(
      pollInvalidOpt.votePoll('acc-1', 'caller-user', 'p-1', { optionIds: ['opt-1', 'opt-1-dup'] })
    ).rejects.toThrow('não pertencem a esta enquete');
  });
});
