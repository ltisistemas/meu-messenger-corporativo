import { describe, it, expect, vi } from 'vitest';
import { ConversationService } from '../services/conversation.service';
import { buildServer } from '../server';

describe('Conversations & Multi-tenant Isolation (T-08)', () => {
  const accountIdA = 'acc-alpha-111';
  const accountIdB = 'acc-beta-222';

  const userA1 = {
    id: 'usr-a1',
    accountId: accountIdA,
    name: 'Alice',
    email: 'alice@alpha.com',
    status: 'active',
  };

  const userA2 = {
    id: 'usr-a2',
    accountId: accountIdA,
    name: 'Bob',
    email: 'bob@alpha.com',
    status: 'active',
  };

  const userB1 = {
    id: 'usr-b1',
    accountId: accountIdB,
    name: 'Charlie',
    email: 'charlie@beta.com',
    status: 'active',
  };

  describe('Multi-tenant Account Isolation', () => {
    it('should reject creating direct chat with user from another account', async () => {
      const mockDb: any = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(null), // User B1 not in Account A
          },
        },
      };

      const service = new ConversationService(mockDb);

      await expect(
        service.getOrCreateDirectConversation(accountIdA, userA1.id, userB1.id)
      ).rejects.toThrow('Usuário destinatário não encontrado ou inativo nesta organização.');
    });

    it('should reject creating direct chat with oneself', async () => {
      const service = new ConversationService({} as any);

      await expect(
        service.getOrCreateDirectConversation(accountIdA, userA1.id, userA1.id)
      ).rejects.toThrow('Não é possível criar uma conversa direta consigo mesmo.');
    });

    it('should create 1:1 conversation between members of the same account', async () => {
      const mockCreatedConv = {
        id: 'conv-123',
        accountId: accountIdA,
        type: 'direct',
        title: null,
        isTemporary: false,
        expiresAt: null,
        status: 'active',
        createdAt: new Date(),
        members: [
          { id: 'm1', userId: userA1.id, role: 'member', joinedAt: new Date(), user: userA1 },
          { id: 'm2', userId: userA2.id, role: 'member', joinedAt: new Date(), user: userA2 },
        ],
      };

      const mockDb: any = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(userA2),
          },
          conversationMembers: {
            findMany: vi.fn().mockResolvedValue([]), // No existing direct conv
          },
          conversations: {
            findFirst: vi.fn().mockResolvedValue(mockCreatedConv),
          },
        },
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockCreatedConv]),
          })),
        })),
      };

      const service = new ConversationService(mockDb);
      const result = await service.getOrCreateDirectConversation(accountIdA, userA1.id, userA2.id);

      expect(result.id).toBe('conv-123');
      expect(result.type).toBe('direct');
      expect(result.title).toBe('Bob'); // Dynamic title for Alice
    });

    it('should create a group and assign creator as admin', async () => {
      const mockGroup = {
        id: 'grp-123',
        accountId: accountIdA,
        type: 'group',
        title: 'Time de Vendas',
        isTemporary: false,
        expiresAt: null,
        status: 'active',
        createdAt: new Date(),
        members: [
          { id: 'm1', userId: userA1.id, role: 'admin', joinedAt: new Date(), user: userA1 },
          { id: 'm2', userId: userA2.id, role: 'member', joinedAt: new Date(), user: userA2 },
        ],
      };

      const mockDb: any = {
        query: {
          users: {
            findMany: vi.fn().mockResolvedValue([userA1, userA2]),
          },
          conversations: {
            findFirst: vi.fn().mockResolvedValue(mockGroup),
          },
        },
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockGroup]),
          })),
        })),
      };

      const service = new ConversationService(mockDb);
      const result = await service.createGroup(accountIdA, userA1.id, {
        title: 'Time de Vendas',
        memberUserIds: [userA2.id],
      });

      expect(result.id).toBe('grp-123');
      expect(result.title).toBe('Time de Vendas');
      expect(result.type).toBe('group');
      expect(result.members.find((m: any) => m.userId === userA1.id)?.role).toBe('admin');
    });

    it('should reject creating group if any member belongs to another account', async () => {
      const mockDb: any = {
        query: {
          users: {
            findMany: vi.fn().mockResolvedValue([userA1]), // userB1 is filtered out by accountId
          },
        },
      };

      const service = new ConversationService(mockDb);

      await expect(
        service.createGroup(accountIdA, userA1.id, {
          title: 'Projeto Secreto',
          memberUserIds: [userB1.id],
        })
      ).rejects.toThrow('Um ou mais membros selecionados não pertencem a esta organização.');
    });
  });

  describe('HTTP Routes Integration', () => {
    it('GET /api/conversations should require authentication', async () => {
      const server = buildServer();
      const res = await server.inject({
        method: 'GET',
        url: '/api/conversations',
      });

      expect(res.statusCode).toBe(401);
      await server.close();
    });

    it('POST /api/conversations/direct should require authentication', async () => {
      const server = buildServer();
      const res = await server.inject({
        method: 'POST',
        url: '/api/conversations/direct',
        payload: { targetUserId: '00000000-0000-0000-0000-000000000000' },
      });

      expect(res.statusCode).toBe(401);
      await server.close();
    });
  });
});
