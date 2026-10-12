import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server';
import { FastifyInstance } from 'fastify';

describe('HTTP Routes Deep Coverage (T-04, T-08, T-26, T-29)', () => {
  let app: FastifyInstance;
  const uuid = 'a0000000-0000-0000-0000-000000000001';
  const accountId = 'a0000000-0000-0000-0000-000000000002';
  const adminId = 'a0000000-0000-0000-0000-000000000003';
  const memberId = 'a0000000-0000-0000-0000-000000000004';

  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;

  const mockConversationService: any = {
    setIoServer: vi.fn(),
    listUserConversations: vi.fn().mockResolvedValue([{ id: uuid, title: 'Geral' }]),
    getOrCreateDirectConversation: vi.fn().mockResolvedValue({ id: uuid, type: 'direct' }),
    createGroup: vi.fn().mockResolvedValue({ id: uuid, title: 'Devs', type: 'group' }),
    getConversationDetails: vi.fn().mockResolvedValue({ id: uuid, title: 'Devs' }),
    addMembersToGroup: vi.fn().mockResolvedValue({ added: 1 }),
    removeMemberFromGroup: vi.fn().mockResolvedValue({ removed: true }),
    deleteGroup: vi.fn().mockResolvedValue({ deleted: true }),
  };

  const mockAccountService: any = {
    getAccountDetails: vi.fn().mockResolvedValue({ id: accountId, name: 'Acme Corp', plan: 'pro' }),
    listMembers: vi.fn().mockResolvedValue([{ id: memberId, name: 'Lucas' }]),
    updateMemberStatus: vi.fn().mockResolvedValue({ id: memberId, status: 'inactive' }),
    updateMemberRole: vi.fn().mockResolvedValue({ id: memberId, role: 'admin' }),
    changePlan: vi.fn().mockResolvedValue({ id: accountId, plan: 'enterprise' }),
    checkAndEnforceQuota: vi.fn().mockResolvedValue({ isOverQuota: false }),
    processTrialExpirations: vi.fn().mockResolvedValue({ processed: 2 }),
    processOverdueInvoices: vi.fn().mockResolvedValue({ suspended: 1 }),
  };

  const mockPollService: any = {
    setIoServer: vi.fn(),
    createPoll: vi.fn().mockResolvedValue({ id: uuid, question: 'Aprovado?' }),
    votePoll: vi.fn().mockResolvedValue({ success: true }),
    getPollDetails: vi.fn().mockResolvedValue({ id: uuid, question: 'Aprovado?' }),
    closePoll: vi.fn().mockResolvedValue({ id: uuid, isClosed: true }),
  };

  const mockFileService: any = {
    setIoServer: vi.fn(),
    validateFiles: vi.fn().mockResolvedValue({ valid: true, allowedCount: 1 }),
    getTransferStatus: vi.fn().mockResolvedValue({ status: 'available', pendingCount: 1 }),
  };

  const mockGroupExpirationService: any = {
    setIoServer: vi.fn(),
    expireSingleGroup: vi.fn().mockResolvedValue({ success: true }),
    sweepExpiredGroups: vi.fn().mockResolvedValue({ expiredCount: 0 }),
  };

  const mockLgpdService: any = {
    setIoServer: vi.fn(),
    exportUserData: vi.fn().mockResolvedValue({ user: { id: uuid } }),
  };

  const mockBackupService: any = {
    createBackup: vi.fn().mockResolvedValue({ backupId: 'b-1' }),
  };

  beforeAll(async () => {
    app = buildServer({
      conversationService: mockConversationService,
      accountService: mockAccountService,
      pollService: mockPollService,
      fileService: mockFileService,
      groupExpirationService: mockGroupExpirationService,
      lgpdService: mockLgpdService,
      backupService: mockBackupService,
    });
    await app.ready();

    ownerToken = app.jwt.sign({
      userId: uuid,
      accountId,
      role: 'owner',
      email: 'owner@acme.com',
    });

    adminToken = app.jwt.sign({
      userId: adminId,
      accountId,
      role: 'admin',
      email: 'admin@acme.com',
    });

    memberToken = app.jwt.sign({
      userId: memberId,
      accountId,
      role: 'member',
      email: 'member@acme.com',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Conversation Routes (/api/conversations)', () => {
    it('GET /api/conversations lists conversations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/conversations',
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).conversations).toHaveLength(1);
    });

    it('POST /api/conversations/direct validates input and handles success & errors', async () => {
      // 400 validation
      const bad = await app.inject({
        method: 'POST',
        url: '/api/conversations/direct',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { targetUserId: 'not-a-uuid' },
      });
      expect(bad.statusCode).toBe(400);

      // 200 success
      const ok = await app.inject({
        method: 'POST',
        url: '/api/conversations/direct',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { targetUserId: uuid },
      });
      expect(ok.statusCode).toBe(200);

      // 400 service rejection
      mockConversationService.getOrCreateDirectConversation.mockRejectedValueOnce(
        new Error('Mesmo usuário')
      );
      const err = await app.inject({
        method: 'POST',
        url: '/api/conversations/direct',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { targetUserId: uuid },
      });
      expect(err.statusCode).toBe(400);
    });

    it('POST /api/conversations/group validates input and handles success & errors', async () => {
      // 400 validation
      const bad = await app.inject({
        method: 'POST',
        url: '/api/conversations/group',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { title: '' },
      });
      expect(bad.statusCode).toBe(400);

      // 201 success
      const ok = await app.inject({
        method: 'POST',
        url: '/api/conversations/group',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { title: 'Time Backend', memberUserIds: [uuid] },
      });
      expect(ok.statusCode).toBe(201);

      // 400 error
      mockConversationService.createGroup.mockRejectedValueOnce(new Error('Membro de outra org'));
      const err = await app.inject({
        method: 'POST',
        url: '/api/conversations/group',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { title: 'Time Backend', memberUserIds: [uuid] },
      });
      expect(err.statusCode).toBe(400);
    });

    it('GET /api/conversations/:id handles found and 404', async () => {
      const ok = await app.inject({
        method: 'GET',
        url: `/api/conversations/${uuid}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(ok.statusCode).toBe(200);

      mockConversationService.getConversationDetails.mockRejectedValueOnce(
        new Error('Conversa inexistente')
      );
      const notFound = await app.inject({
        method: 'GET',
        url: `/api/conversations/${uuid}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(notFound.statusCode).toBe(404);
    });

    it('POST /api/conversations/:id/members validates input and adds members', async () => {
      const bad = await app.inject({
        method: 'POST',
        url: `/api/conversations/${uuid}/members`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { userIds: [] },
      });
      expect(bad.statusCode).toBe(400);

      const ok = await app.inject({
        method: 'POST',
        url: `/api/conversations/${uuid}/members`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { userIds: [uuid] },
      });
      expect(ok.statusCode).toBe(200);

      mockConversationService.addMembersToGroup.mockRejectedValueOnce(
        new Error('Apenas admin pode adicionar')
      );
      const err = await app.inject({
        method: 'POST',
        url: `/api/conversations/${uuid}/members`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { userIds: [uuid] },
      });
      expect(err.statusCode).toBe(400);
    });

    it('DELETE /api/conversations/:id/members/:memberId removes member', async () => {
      const ok = await app.inject({
        method: 'DELETE',
        url: `/api/conversations/${uuid}/members/${memberId}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(ok.statusCode).toBe(200);

      mockConversationService.removeMemberFromGroup.mockRejectedValueOnce(
        new Error('Permissão negada')
      );
      const err = await app.inject({
        method: 'DELETE',
        url: `/api/conversations/${uuid}/members/${memberId}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(err.statusCode).toBe(400);
    });

    it('DELETE /api/conversations/:id deletes conversation', async () => {
      const ok = await app.inject({
        method: 'DELETE',
        url: `/api/conversations/${uuid}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(ok.statusCode).toBe(200);

      mockConversationService.deleteGroup.mockRejectedValueOnce(new Error('Não é admin'));
      const err = await app.inject({
        method: 'DELETE',
        url: `/api/conversations/${uuid}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(err.statusCode).toBe(400);
    });
  });

  describe('Account Routes (/api/accounts)', () => {
    it('GET /api/accounts/me returns details and handles error', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts/me',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).toBe(200);

      mockAccountService.getAccountDetails.mockRejectedValueOnce(new Error('DB error'));
      const err = await app.inject({
        method: 'GET',
        url: '/api/accounts/me',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(err.statusCode).toBe(400);
    });

    it('GET /api/accounts/members returns members list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts/members',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);

      mockAccountService.listMembers.mockRejectedValueOnce(new Error('DB error'));
      const err = await app.inject({
        method: 'GET',
        url: '/api/accounts/members',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(err.statusCode).toBe(400);
    });

    it('PATCH /api/accounts/members/:id/status respects roles and validates body', async () => {
      // Forbidden when service denies permission
      mockAccountService.updateMemberStatus.mockRejectedValueOnce(
        new Error('Apenas Administradores podem gerenciar membros.')
      );
      const forbidden = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/status`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { status: 'inactive' },
      });
      expect(forbidden.statusCode).toBe(403);

      // Bad body 400
      const bad = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/status`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { status: 'invalid' },
      });
      expect(bad.statusCode).toBe(400);

      // Owner 200
      const ok = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/status`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { status: 'inactive' },
      });
      expect(ok.statusCode).toBe(200);

      // General error 400
      mockAccountService.updateMemberStatus.mockRejectedValueOnce(
        new Error('Não é possível desativar owner')
      );
      const err = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/status`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { status: 'inactive' },
      });
      expect(err.statusCode).toBe(400);
    });

    it('PATCH /api/accounts/members/:id/role respects roles and validates body', async () => {
      mockAccountService.updateMemberRole.mockRejectedValueOnce(
        new Error('Apenas Administradores podem alterar papéis.')
      );
      const forbidden = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/role`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { role: 'admin' },
      });
      expect(forbidden.statusCode).toBe(403);

      const bad = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/role`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { role: 'superadmin' },
      });
      expect(bad.statusCode).toBe(400);

      const ok = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/role`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { role: 'admin' },
      });
      expect(ok.statusCode).toBe(200);
    });

    it('POST /api/accounts/downgrade handles validation, roles and errors', async () => {
      mockAccountService.changePlan.mockRejectedValueOnce(
        new Error('Apenas Administradores podem alterar planos.')
      );
      const forbidden = await app.inject({
        method: 'POST',
        url: '/api/accounts/downgrade',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { plan: 'pro' },
      });
      expect(forbidden.statusCode).toBe(403);

      const bad = await app.inject({
        method: 'POST',
        url: '/api/accounts/downgrade',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { plan: 'gold' },
      });
      expect(bad.statusCode).toBe(400);

      const ok = await app.inject({
        method: 'POST',
        url: '/api/accounts/downgrade',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { plan: 'enterprise' },
      });
      expect(ok.statusCode).toBe(200);

      mockAccountService.changePlan.mockRejectedValueOnce(
        new Error('Downgrade excede limite de usuários')
      );
      const err = await app.inject({
        method: 'POST',
        url: '/api/accounts/downgrade',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { plan: 'free' },
      });
      expect(err.statusCode).toBe(400);
    });

    it('POST /api/accounts/check-quota, cron/process-trials, cron/process-overdue', async () => {
      const quota = await app.inject({
        method: 'POST',
        url: '/api/accounts/check-quota',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(quota.statusCode).toBe(200);

      // Quota 401 without token
      const noTokenQuota = await app.inject({
        method: 'POST',
        url: '/api/accounts/check-quota',
      });
      expect(noTokenQuota.statusCode).toBe(401);

      // Quota 400 error
      mockAccountService.checkAndEnforceQuota.mockRejectedValueOnce(new Error('Quota check failed'));
      const errQuota = await app.inject({
        method: 'POST',
        url: '/api/accounts/check-quota',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(errQuota.statusCode).toBe(400);

      const trials = await app.inject({
        method: 'POST',
        url: '/api/accounts/cron/process-trials',
      });
      expect(trials.statusCode).toBe(200);

      const overdue = await app.inject({
        method: 'POST',
        url: '/api/accounts/cron/process-overdue',
      });
      expect(overdue.statusCode).toBe(200);

      // Error paths -> 500
      mockAccountService.processTrialExpirations.mockRejectedValueOnce(new Error('Crash in trials'));
      const trialsErr = await app.inject({
        method: 'POST',
        url: '/api/accounts/cron/process-trials',
      });
      expect(trialsErr.statusCode).toBe(500);

      mockAccountService.processOverdueInvoices.mockRejectedValueOnce(new Error('Crash in overdue'));
      const overdueErr = await app.inject({
        method: 'POST',
        url: '/api/accounts/cron/process-overdue',
      });
      expect(overdueErr.statusCode).toBe(500);
    });
  });

  describe('Poll Routes (/api/polls)', () => {
    it('POST /api/polls handles validation, success and errors', async () => {
      const bad = await app.inject({
        method: 'POST',
        url: '/api/polls',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { question: '' },
      });
      expect(bad.statusCode).toBe(400);

      const ok = await app.inject({
        method: 'POST',
        url: '/api/polls',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: {
          conversationId: uuid,
          question: 'Aprovado?',
          options: ['Sim', 'Não'],
        },
      });
      expect(ok.statusCode).toBe(201);

      mockPollService.createPoll.mockRejectedValueOnce(new Error('plano Free não suporta enquetes'));
      const err = await app.inject({
        method: 'POST',
        url: '/api/polls',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: {
          conversationId: uuid,
          question: 'Aprovado?',
          options: ['Sim', 'Não'],
        },
      });
      expect(err.statusCode).toBe(403);
    });

    it('POST /api/polls/:id/vote handles voting and errors', async () => {
      const bad = await app.inject({
        method: 'POST',
        url: `/api/polls/${uuid}/vote`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { optionIds: [] },
      });
      expect(bad.statusCode).toBe(400);

      const ok = await app.inject({
        method: 'POST',
        url: `/api/polls/${uuid}/vote`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { optionIds: [uuid] },
      });
      expect(ok.statusCode).toBe(200);

      mockPollService.votePoll.mockRejectedValueOnce(new Error('Enquete já expirada'));
      const err = await app.inject({
        method: 'POST',
        url: `/api/polls/${uuid}/vote`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { optionIds: [uuid] },
      });
      expect(err.statusCode).toBe(400);
    });

    it('GET /api/polls/:id handles found and 404', async () => {
      const ok = await app.inject({
        method: 'GET',
        url: `/api/polls/${uuid}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(ok.statusCode).toBe(200);

      mockPollService.getPollDetails.mockRejectedValueOnce(new Error('Enquete inexistente'));
      const notFound = await app.inject({
        method: 'GET',
        url: `/api/polls/${uuid}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(notFound.statusCode).toBe(404);
    });

    it('POST /api/polls/:id/close handles closing and errors', async () => {
      const ok = await app.inject({
        method: 'POST',
        url: `/api/polls/${uuid}/close`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(ok.statusCode).toBe(200);

      mockPollService.closePoll.mockRejectedValueOnce(new Error('Apenas criador ou admin pode encerrar'));
      const forbidden = await app.inject({
        method: 'POST',
        url: `/api/polls/${uuid}/close`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(forbidden.statusCode).toBe(403);
    });
  });

  describe('Additional Route Edge Cases Coverage', () => {
    it('PATCH /api/accounts/members/:id/role and POST /api/accounts/downgrade require JWT', async () => {
      const resRole = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${memberId}/role`,
        payload: { role: 'admin' },
      });
      expect(resRole.statusCode).toBe(401);

      const resDowngrade = await app.inject({
        method: 'POST',
        url: '/api/accounts/downgrade',
        payload: { plan: 'free' },
      });
      expect(resDowngrade.statusCode).toBe(401);
    });

    it('POST /api/files/validate handles auth, schema validation, success and forbidden codes', async () => {
      const noAuth = await app.inject({
        method: 'POST',
        url: '/api/files/validate',
        payload: { files: [] },
      });
      expect(noAuth.statusCode).toBe(401);

      // Invalid schema (no files array)
      const invalidSchema = await app.inject({
        method: 'POST',
        url: '/api/files/validate',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: {},
      });
      expect(invalidSchema.statusCode).toBe(400);

      // Valid files
      const validRes = await app.inject({
        method: 'POST',
        url: '/api/files/validate',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: {
          files: [{ name: 'test.pdf', size: 1024, mimeType: 'application/pdf' }],
        },
      });
      expect(validRes.statusCode).toBe(200);

      // Offline recipient not allowed (403)
      mockFileService.validateFiles.mockResolvedValueOnce({
        valid: false,
        code: 'OFFLINE_RECIPIENT_NOT_ALLOWED',
        message: 'Destinatário offline.',
      });
      const forbiddenRes = await app.inject({
        method: 'POST',
        url: '/api/files/validate',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: {
          files: [{ name: 'test.pdf', size: 1024, mimeType: 'application/pdf' }],
          recipientUserId: uuid,
          isRecipientOnline: false,
        },
      });
      expect(forbiddenRes.statusCode).toBe(403);
    });

    it('GET /api/files/:transferId/status handles service error', async () => {
      mockFileService.getTransferStatus.mockRejectedValueOnce(new Error('Transferência indisponível'));
      const errRes = await app.inject({
        method: 'GET',
        url: `/api/files/${uuid}/status`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(errRes.statusCode).toBe(400);
    });

    it('Observability routes handle backup service error (500)', async () => {
      mockBackupService.createBackup.mockRejectedValueOnce(new Error('Falha no disco'));
      const errBackup = await app.inject({
        method: 'POST',
        url: '/api/backup',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(errBackup.statusCode).toBe(500);
    });

    it('Temporary group routes handle expire and sweep errors', async () => {
      // POST /api/conversations/:id/expire success
      const okExpire = await app.inject({
        method: 'POST',
        url: `/api/conversations/${uuid}/expire`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(okExpire.statusCode).toBe(200);

      // POST /api/conversations/:id/expire error
      mockGroupExpirationService.expireSingleGroup.mockRejectedValueOnce(new Error('Falha ao expirar'));
      const errExpire = await app.inject({
        method: 'POST',
        url: `/api/conversations/${uuid}/expire`,
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(errExpire.statusCode).toBe(400);

      // POST /api/conversations/sweep-expired error
      mockGroupExpirationService.sweepExpiredGroups.mockRejectedValueOnce(new Error('Erro na varredura'));
      const errSweep = await app.inject({
        method: 'POST',
        url: '/api/conversations/sweep-expired',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(errSweep.statusCode).toBe(500);
    });

    it('POST /api/broadcasts rejects invalid schema and GET /api/lgpd/export handles service error', async () => {
      const badBroadcast = await app.inject({
        method: 'POST',
        url: '/api/broadcasts',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(badBroadcast.statusCode).toBe(400);

      mockLgpdService.exportUserData.mockRejectedValueOnce(new Error('Erro na exportação LGPD'));
      const badLgpd = await app.inject({
        method: 'GET',
        url: '/api/lgpd/export',
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(badLgpd.statusCode).toBe(400);
    });
  });
});
