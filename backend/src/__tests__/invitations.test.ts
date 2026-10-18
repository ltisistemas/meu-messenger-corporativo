import { describe, it, expect, vi } from 'vitest';
import { InvitationService } from '../services/invitation.service';
import { AuthService } from '../services/auth.service';
import { buildServer } from '../server';

describe('Member Invitations & Plan Limits (T-05)', () => {
  describe('InvitationService Plan Limits & Quota Enforcement', () => {
    it('Free plan should block the 13th user (limit 12 active users)', async () => {
      const mockAccount = {
        id: 'acc-free',
        name: 'Free Org',
        plan: 'free',
        status: 'active',
      };

      const mockDb: any = {
        query: {
          accounts: {
            findFirst: vi.fn().mockResolvedValue(mockAccount),
          },
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 12 }]), // Already 12 active members
          })),
        })),
      };

      const service = new InvitationService(mockDb);

      await expect(
        service.createInvitation('acc-free', 'user-owner', 'owner', {
          email: 'user13@free.com',
          role: 'member',
        })
      ).rejects.toThrow('Limite de 12 usuários atingido para o plano Free.');
    });

    it('Pro plan should block the 81st user (limit 80 active users)', async () => {
      const mockAccount = {
        id: 'acc-pro',
        name: 'Pro Org',
        plan: 'pro',
        status: 'active',
      };

      const mockDb: any = {
        query: {
          accounts: {
            findFirst: vi.fn().mockResolvedValue(mockAccount),
          },
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 80 }]), // Already 80 active members
          })),
        })),
      };

      const service = new InvitationService(mockDb);

      await expect(
        service.createInvitation('acc-pro', 'user-owner', 'owner', {
          email: 'user81@pro.com',
          role: 'member',
        })
      ).rejects.toThrow('Limite de 80 usuários atingido para o plano Pro.');
    });

    it('should reject invitation creation by regular member (non-admin/non-owner)', async () => {
      const service = new InvitationService({} as any);

      await expect(
        service.createInvitation('acc-1', 'user-member', 'member', {
          email: 'novo@empresa.com',
          role: 'member',
        })
      ).rejects.toThrow('Apenas Administradores e o Proprietário podem convidar novos membros.');
    });

    it('should create invitation when under limits and caller is admin', async () => {
      const mockAccount = {
        id: 'acc-free',
        name: 'Free Org',
        plan: 'free',
        status: 'active',
      };

      const mockCreatedInvitation = {
        id: 'inv-123',
        accountId: 'acc-free',
        email: 'novo@empresa.com',
        role: 'member',
        token: 'mock-token-hex',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const mockDb: any = {
        query: {
          accounts: {
            findFirst: vi.fn().mockResolvedValue(mockAccount),
          },
          users: {
            findFirst: vi.fn().mockResolvedValue(null), // Email not in account
          },
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 5 }]), // 5 active members < 12
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockCreatedInvitation]),
          })),
        })),
      };

      const service = new InvitationService(mockDb);
      const result = await service.createInvitation('acc-free', 'user-admin', 'admin', {
        email: 'novo@empresa.com',
        role: 'member',
      });

      expect(result.invitation.id).toBe('inv-123');
      expect(result.inviteUrl).toContain('/invite/');
    });
  });

  describe('Invitation HTTP Routes Integration', () => {
    it('POST /api/invitations should reject request without auth', async () => {
      const server = buildServer();
      const res = await server.inject({
        method: 'POST',
        url: '/api/invitations',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(res.statusCode).toBe(401);
      await server.close();
    });

    it('GET /api/invitations/:token should return 404 for non-existent invitation', async () => {
      const server = buildServer();
      const res = await server.inject({
        method: 'GET',
        url: '/api/invitations/non-existent-token-123',
      });

      expect(res.statusCode).toBe(404);
      await server.close();
    });

    it('POST /api/invitations validates body and creates invitation for admin', async () => {
      const server = buildServer();
      await server.ready();

      const adminToken = server.jwt.sign({
        userId: '11111111-1111-1111-1111-111111111111',
        accountId: '22222222-2222-2222-2222-222222222222',
        role: 'admin',
        email: 'admin@corp.com',
      });

      // 400 Bad payload
      const bad = await server.inject({
        method: 'POST',
        url: '/api/invitations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { email: 'not-an-email' },
      });
      expect(bad.statusCode).toBe(400);

      // Spy on InvitationService
      vi.spyOn(InvitationService.prototype, 'createInvitation').mockResolvedValueOnce({
        invitation: { id: 'inv-1', email: 'novo@corp.com', role: 'member' } as any,
        inviteUrl: 'http://localhost/invite/tok-1',
      });

      const ok = await server.inject({
        method: 'POST',
        url: '/api/invitations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { email: 'novo@corp.com' },
      });
      expect(ok.statusCode).toBe(201);
      expect(JSON.parse(ok.payload).inviteUrl).toBeDefined();

      // Service error
      vi.spyOn(InvitationService.prototype, 'createInvitation').mockRejectedValueOnce(
        new Error('Apenas Administradores podem enviar convites.')
      );
      const err = await server.inject({
        method: 'POST',
        url: '/api/invitations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { email: 'outro@corp.com' },
      });
      expect(err.statusCode).toBe(400);

      await server.close();
    });

    it('GET and DELETE /api/invitations manage invitations list and revocation', async () => {
      const server = buildServer();
      await server.ready();

      const adminToken = server.jwt.sign({
        userId: '11111111-1111-1111-1111-111111111111',
        accountId: '22222222-2222-2222-2222-222222222222',
        role: 'admin',
        email: 'admin@corp.com',
      });

      vi.spyOn(InvitationService.prototype, 'listInvitations').mockResolvedValueOnce([
        { id: 'inv-1', email: 'pendente@corp.com' } as any,
      ]);

      const listRes = await server.inject({
        method: 'GET',
        url: '/api/invitations',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(JSON.parse(listRes.payload).invitations).toHaveLength(1);

      vi.spyOn(InvitationService.prototype, 'revokeInvitation').mockResolvedValueOnce({
        success: true,
      });
      const delRes = await server.inject({
        method: 'DELETE',
        url: '/api/invitations/inv-1',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(200);

      vi.spyOn(InvitationService.prototype, 'revokeInvitation').mockRejectedValueOnce(
        new Error('Convite não encontrado.')
      );
      const delErr = await server.inject({
        method: 'DELETE',
        url: '/api/invitations/inv-bad',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delErr.statusCode).toBe(400);

      await server.close();
    });

    it('GET and POST /api/invitations/:token handles token inspection and acceptance', async () => {
      const server = buildServer();
      await server.ready();

      vi.spyOn(InvitationService.prototype, 'getInvitationByToken').mockResolvedValueOnce({
        id: 'inv-1',
        email: 'novo@corp.com',
        role: 'member',
        account: { name: 'Acme', plan: 'pro' },
        expiresAt: new Date(),
      } as any);

      const inspectRes = await server.inject({
        method: 'GET',
        url: '/api/invitations/tok-valid',
      });
      expect(inspectRes.statusCode).toBe(200);

      // Accept with invalid body
      const badAccept = await server.inject({
        method: 'POST',
        url: '/api/invitations/tok-valid/accept',
        payload: { name: '' },
      });
      expect(badAccept.statusCode).toBe(400);

      // Accept with valid body
      vi.spyOn(InvitationService.prototype, 'acceptInvitation').mockResolvedValueOnce({
        user: { id: 'usr-new', name: 'Novo User' } as any,
        rawUser: { id: 'usr-new', email: 'novo@corp.com', role: 'member' } as any,
        account: { id: 'acc-1', name: 'Acme' } as any,
      });
      vi.spyOn(AuthService.prototype, 'createRefreshToken').mockResolvedValueOnce(
        'mock-refresh-tok'
      );

      const goodAccept = await server.inject({
        method: 'POST',
        url: '/api/invitations/tok-valid/accept',
        payload: { name: 'Novo User', password: 'senhaSegura123' },
      });
      expect(goodAccept.statusCode).toBe(200);
      expect(JSON.parse(goodAccept.payload).accessToken).toBeDefined();

      // Accept service error
      vi.spyOn(InvitationService.prototype, 'acceptInvitation').mockRejectedValueOnce(
        new Error('Convite já utilizado.')
      );
      const errAccept = await server.inject({
        method: 'POST',
        url: '/api/invitations/tok-valid/accept',
        payload: { name: 'Novo User', password: 'senhaSegura123' },
      });
      expect(errAccept.statusCode).toBe(400);

      await server.close();
    });

    it('listInvitations and revokeInvitation service methods enforce role checks and query', async () => {
      const mockDb: any = {
        query: {
          invitations: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ id: 'inv-1', email: 'inv1@corp.com', status: 'pending' }]),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };

      const service = new InvitationService(mockDb);

      // listInvitations returns items
      const list = await service.listInvitations('acc-1');
      expect(list).toHaveLength(1);

      // revokeInvitation rejects member role
      await expect(service.revokeInvitation('acc-1', 'inv-1', 'member')).rejects.toThrow(
        'Apenas Administradores e o Proprietário podem revogar convites.'
      );

      // revokeInvitation allows admin role
      const resAdmin = await service.revokeInvitation('acc-1', 'inv-1', 'admin');
      expect(resAdmin.success).toBe(true);

      // revokeInvitation allows owner role
      const resOwner = await service.revokeInvitation('acc-1', 'inv-1', 'owner');
      expect(resOwner.success).toBe(true);
    });

    it('getInvitationByToken and acceptInvitation cover missing, revoked, expired and full acceptance', async () => {
      const mockDb: any = {
        query: {
          invitations: {
            findFirst: vi.fn(),
          },
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue([
                { id: 'usr-accepted', email: 'acc@corp.com', role: 'member', passwordHash: 'hash' },
              ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };

      const service = new InvitationService(mockDb);

      // 1. Not found
      mockDb.query.invitations.findFirst.mockResolvedValueOnce(null);
      await expect(service.getInvitationByToken('unknown')).rejects.toThrow(
        'Convite não encontrado.'
      );

      // 2. Already accepted
      mockDb.query.invitations.findFirst.mockResolvedValueOnce({
        id: 'i-1',
        status: 'accepted',
        expiresAt: new Date(Date.now() + 100000),
      });
      await expect(service.getInvitationByToken('tok')).rejects.toThrow(
        'Este convite já foi aceito.'
      );

      // 3. Expired
      mockDb.query.invitations.findFirst.mockResolvedValueOnce({
        id: 'i-1',
        status: 'pending',
        expiresAt: new Date(Date.now() - 100000),
      });
      await expect(service.getInvitationByToken('tok')).rejects.toThrow('Este convite expirou.');

      // 4. Accept with exceeded user limit
      mockDb.query.invitations.findFirst.mockResolvedValueOnce({
        id: 'i-1',
        accountId: 'acc-free',
        token: 'tok-valid',
        status: 'pending',
        role: 'member',
        email: 'acc@corp.com',
        expiresAt: new Date(Date.now() + 100000),
        account: { id: 'acc-free', plan: 'free' },
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 12 }]), // at limit
        })),
      });
      await expect(
        service.acceptInvitation({ token: 'tok-valid', name: 'User', password: 'password123' })
      ).rejects.toThrow('Limite de 12 usuários atingido para o plano Free.');

      // 5. Successful acceptance
      mockDb.query.invitations.findFirst.mockResolvedValueOnce({
        id: 'i-1',
        accountId: 'acc-free',
        token: 'tok-valid',
        status: 'pending',
        role: 'member',
        email: 'acc@corp.com',
        expiresAt: new Date(Date.now() + 100000),
        account: { id: 'acc-free', plan: 'free' },
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        })),
      });

      const accepted = await service.acceptInvitation({
        token: 'tok-valid',
        name: 'User Accepted',
        password: 'password123',
      });
      expect(accepted.user.id).toBe('usr-accepted');
      expect(accepted.user.email).toBe('acc@corp.com');
    });
  });
});
