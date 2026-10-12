import { describe, it, expect, vi } from 'vitest';
import { InvitationService } from '../services/invitation.service';
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
  });
});
