import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationService } from '../services/conversation.service';
import { GroupExpirationService } from '../jobs/group-expiration.job';
import { MessageService } from '../services/message.service';
import { buildServer } from '../server';

// Helper to safely extract string values from Drizzle AST objects without circular errors
function getStringsFrom(obj: any, visited = new Set<any>()): string[] {
  if (!obj || typeof obj !== 'object' || visited.has(obj)) return [];
  visited.add(obj);
  const results: string[] = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      results.push(val);
    } else if (typeof val === 'object' && val !== null) {
      results.push(...getStringsFrom(val, visited));
    }
  }
  return results;
}

describe('Temporary Groups & Expiration Job (T-24)', () => {
  const mockAccountId = '11111111-1111-1111-1111-111111111111';
  const mockCreatorId = '22222222-2222-2222-2222-222222222222';
  const mockMemberId = '33333333-3333-3333-3333-333333333333';
  const mockOtherId = '44444444-4444-4444-4444-444444444444';

  let mockConversationsData: any[] = [];
  let mockMembersData: any[] = [];
  let mockMessagesData: any[] = [];
  let mockIo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationsData = [];
    mockMembersData = [];
    mockMessagesData = [];

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
  });

  const createMockDb = () => {
    return {
      query: {
        users: {
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const userList = [
              { id: mockCreatorId, accountId: mockAccountId, name: 'Admin', email: 'admin@corp.com', status: 'active' },
              { id: mockMemberId, accountId: mockAccountId, name: 'Member 1', email: 'm1@corp.com', status: 'active' },
              { id: mockOtherId, accountId: mockAccountId, name: 'Member 2', email: 'm2@corp.com', status: 'active' },
            ];
            return userList.filter((u) => strings.includes(u.id));
          }),
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            if (strings.includes(mockMemberId)) {
              return { id: mockMemberId, accountId: mockAccountId, name: 'Member 1', status: 'active' };
            }
            return { id: mockCreatorId, accountId: mockAccountId, name: 'Admin', status: 'active' };
          }),
        },
        accounts: {
          findFirst: vi.fn().mockResolvedValue({
            id: mockAccountId,
            name: 'Corp Corp',
            status: 'active',
            plan: 'pro',
          }),
        },
        conversations: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const conv = mockConversationsData.find((c) => strings.includes(c.id));
            if (!conv) return null;
            const members = mockMembersData.filter((m) => m.conversationId === conv.id);
            return {
              ...conv,
              members: members.map((m) => ({
                ...m,
                user: { id: m.userId, name: 'User Name', email: 'user@corp.com' },
              })),
            };
          }),
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockConversationsData.map((conv) => ({
              ...conv,
              members: mockMembersData
                .filter((m) => m.conversationId === conv.id)
                .map((m) => ({ ...m, user: { id: m.userId, name: 'User Name' } })),
            }));
          }),
        },
        conversationMembers: {
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const foundMembers = mockMembersData.filter((m) => strings.includes(m.userId));
            return foundMembers.map((m) => {
              const conv = mockConversationsData.find((c) => c.id === m.conversationId);
              return {
                ...m,
                conversation: {
                  ...conv,
                  members: mockMembersData.filter((subM) => subM.conversationId === conv?.id),
                },
              };
            });
          }),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          if (Array.isArray(val)) {
            val.forEach((item) => {
              mockMembersData.push({ id: `m-${Date.now()}-${Math.random()}`, ...item, joinedAt: new Date() });
            });
            return { returning: () => val };
          }
          const newId = val.id || `conv-${Date.now()}`;
          const record = { id: newId, ...val, createdAt: new Date(), updatedAt: new Date() };
          mockConversationsData.push(record);
          return {
            returning: () => [record],
          };
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((setValues) => ({
          where: vi.fn().mockImplementation((whereClause) => {
            const strings = getStringsFrom(whereClause);
            const target = mockConversationsData.find((c) => strings.includes(c.id));
            if (target) {
              Object.assign(target, setValues);
            }
            return {
              returning: () => (target ? [target] : []),
            };
          }),
        })),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((whereClause) => {
          const strings = getStringsFrom(whereClause);
          mockConversationsData = mockConversationsData.filter((c) => !strings.includes(c.id));
          mockMembersData = mockMembersData.filter((m) => !strings.includes(m.conversationId));
          return { rowCount: 1 };
        }),
      }),
    };
  };

  describe('Group Creation with Expiration (T-24)', () => {
    it('creates a temporary group with explicit expiresAt date in future and schedules delayed job', async () => {
      const mockDb = createMockDb() as any;
      const groupExpirationService = new GroupExpirationService(mockDb, mockIo, false);
      const scheduleSpy = vi.spyOn(groupExpirationService, 'scheduleGroupExpiration').mockResolvedValue(true);

      const conversationService = new ConversationService(mockDb, groupExpirationService, mockIo);

      const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const group = await conversationService.createGroup(mockAccountId, mockCreatorId, {
        title: 'Squad Temporário Alpha',
        memberUserIds: [mockMemberId],
        isTemporary: true,
        expiresAt: futureDate,
      });

      expect(group.title).toBe('Squad Temporário Alpha');
      expect(group.isTemporary).toBe(true);
      expect(group.status).toBe('active');
      expect(group.expiresAt).toEqual(new Date(futureDate));
      expect(scheduleSpy).toHaveBeenCalledWith(group.id, new Date(futureDate));
    });

    it('creates a temporary group using retentionHours (e.g. 24 hours)', async () => {
      const mockDb = createMockDb() as any;
      const groupExpirationService = new GroupExpirationService(mockDb, mockIo, false);
      const scheduleSpy = vi.spyOn(groupExpirationService, 'scheduleGroupExpiration').mockResolvedValue(true);

      const conversationService = new ConversationService(mockDb, groupExpirationService, mockIo);

      const beforeCreation = Date.now();
      const group = await conversationService.createGroup(mockAccountId, mockCreatorId, {
        title: 'Comitê de Crise 24h',
        memberUserIds: [mockMemberId],
        isTemporary: true,
        retentionHours: 24,
      });

      expect(group.isTemporary).toBe(true);
      expect(group.expiresAt).toBeDefined();
      const expiresTime = new Date(group.expiresAt!).getTime();
      expect(expiresTime).toBeGreaterThanOrEqual(beforeCreation + 23 * 3600 * 1000);
      expect(scheduleSpy).toHaveBeenCalled();
    });

    it('rejects creation of temporary group with expiration in the past', async () => {
      const mockDb = createMockDb() as any;
      const conversationService = new ConversationService(mockDb);

      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();

      await expect(
        conversationService.createGroup(mockAccountId, mockCreatorId, {
          title: 'Grupo Inválido',
          memberUserIds: [mockMemberId],
          isTemporary: true,
          expiresAt: pastDate,
        })
      ).rejects.toThrow('A data de expiração do grupo temporário deve ser no futuro.');
    });
  });

  describe('GroupExpirationService: Expiration & Sweep (T-24)', () => {
    it('expires single group and marks status as archived_readonly with WebSocket notification', async () => {
      const mockDb = createMockDb() as any;
      const convId = 'temp-group-1';

      mockConversationsData.push({
        id: convId,
        accountId: mockAccountId,
        type: 'group',
        title: 'Projeto Sprint Q4',
        isTemporary: true,
        expiresAt: new Date(Date.now() - 1000),
        status: 'active',
      });

      const service = new GroupExpirationService(mockDb, mockIo, false);
      const result = await service.expireSingleGroup(convId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('archived_readonly');

      const updated = mockConversationsData.find((c) => c.id === convId);
      expect(updated.status).toBe('archived_readonly');

      expect(mockIo.to).toHaveBeenCalledWith(`conversation:${convId}`);
      expect(mockIo.to).toHaveBeenCalledWith(`account:${mockAccountId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'conversation:archived',
        expect.objectContaining({
          conversationId: convId,
          status: 'archived_readonly',
        })
      );
    });

    it('sweepExpiredGroups finds and archives all past-due temporary groups', async () => {
      const mockDb = createMockDb() as any;
      const now = new Date();

      mockConversationsData.push(
        {
          id: 'temp-expired-1',
          accountId: mockAccountId,
          type: 'group',
          isTemporary: true,
          expiresAt: new Date(now.getTime() - 10000),
          status: 'active',
        },
        {
          id: 'temp-expired-2',
          accountId: mockAccountId,
          type: 'group',
          isTemporary: true,
          expiresAt: new Date(now.getTime() - 5000),
          status: 'active',
        },
        {
          id: 'temp-future-3',
          accountId: mockAccountId,
          type: 'group',
          isTemporary: true,
          expiresAt: new Date(now.getTime() + 100000),
          status: 'active',
        },
        {
          id: 'fixed-group-4',
          accountId: mockAccountId,
          type: 'group',
          isTemporary: false,
          expiresAt: null,
          status: 'active',
        }
      );

      // Mock query filter to return only active temporary groups with expiresAt <= now
      mockDb.query.conversations.findMany = vi.fn().mockImplementation(async () => {
        return mockConversationsData.filter(
          (c) => c.isTemporary && c.status === 'active' && c.expiresAt && c.expiresAt <= now
        );
      });

      const service = new GroupExpirationService(mockDb, mockIo, false);
      const sweepResult = await service.sweepExpiredGroups(now);

      expect(sweepResult.processedCount).toBe(2);
      expect(sweepResult.expiredGroupIds).toEqual(['temp-expired-1', 'temp-expired-2']);

      expect(mockConversationsData.find((c) => c.id === 'temp-expired-1').status).toBe('archived_readonly');
      expect(mockConversationsData.find((c) => c.id === 'temp-expired-2').status).toBe('archived_readonly');
      expect(mockConversationsData.find((c) => c.id === 'temp-future-3').status).toBe('active');
    });
  });

  describe('Message Restrictions on Expired Groups (T-24)', () => {
    it('blocks sending new messages to an archived_readonly group', async () => {
      const mockDb = createMockDb() as any;
      const convId = 'archived-group-1';

      mockConversationsData.push({
        id: convId,
        accountId: mockAccountId,
        type: 'group',
        title: 'Grupo Finalizado',
        isTemporary: true,
        expiresAt: new Date(Date.now() - 10000),
        status: 'archived_readonly',
      });

      mockMembersData.push({
        id: 'm1',
        conversationId: convId,
        userId: mockCreatorId,
        role: 'admin',
      });

      const messageService = new MessageService(mockDb);

      await expect(
        messageService.sendMessage(mockAccountId, mockCreatorId, {
          conversationId: convId,
          content: 'Nova mensagem após expiração',
        })
      ).rejects.toThrow('Esta conversa expirou e está em modo somente leitura.');
    });

    it('blocks sending messages to a temporary group that reached its expiration date even before sweep job ran', async () => {
      const mockDb = createMockDb() as any;
      const convId = 'past-due-group-2';

      mockConversationsData.push({
        id: convId,
        accountId: mockAccountId,
        type: 'group',
        title: 'Grupo com prazo vencido',
        isTemporary: true,
        expiresAt: new Date(Date.now() - 5000), // 5 seconds ago
        status: 'active', // Job hasn't run yet
      });

      mockMembersData.push({
        id: 'm1',
        conversationId: convId,
        userId: mockCreatorId,
        role: 'admin',
      });

      const messageService = new MessageService(mockDb);

      await expect(
        messageService.sendMessage(mockAccountId, mockCreatorId, {
          conversationId: convId,
          content: 'Tentando enviar em grupo expirado',
        })
      ).rejects.toThrow('Esta conversa expirou e está em modo somente leitura.');
    });
  });

  describe('Group Deletion (T-24)', () => {
    it('allows admin to delete an expired or active group permanently', async () => {
      const mockDb = createMockDb() as any;
      const convId = 'group-to-delete';

      mockConversationsData.push({
        id: convId,
        accountId: mockAccountId,
        type: 'group',
        title: 'Grupo para exclusão',
        isTemporary: true,
        status: 'archived_readonly',
      });

      mockMembersData.push({
        id: 'm1',
        conversationId: convId,
        userId: mockCreatorId,
        role: 'admin',
      });

      const conversationService = new ConversationService(mockDb, undefined, mockIo);
      const res = await conversationService.deleteGroup(mockAccountId, mockCreatorId, 'admin', convId);

      expect(res.success).toBe(true);
      expect(mockConversationsData.find((c) => c.id === convId)).toBeUndefined();
      expect(mockIo.to).toHaveBeenCalledWith(`conversation:${convId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'conversation:deleted',
        expect.objectContaining({ conversationId: convId })
      );
    });
  });

  describe('Fastify Routes Integration: /api/conversations (T-24)', () => {
    it('creates temporary group via POST /api/conversations/group', async () => {
      const mockDb = createMockDb() as any;
      const groupExpirationService = new GroupExpirationService(mockDb, mockIo, false);
      const conversationService = new ConversationService(mockDb, groupExpirationService, mockIo);

      const app = buildServer({ conversationService, groupExpirationService });
      await app.ready();

      const token = app.jwt.sign({
        userId: mockCreatorId,
        accountId: mockAccountId,
        role: 'admin',
        email: 'admin@corp.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/conversations/group',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          title: 'Squad Temp HTTP',
          memberUserIds: [mockMemberId],
          isTemporary: true,
          retentionHours: 12,
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.payload);
      expect(json.title).toBe('Squad Temp HTTP');
      expect(json.isTemporary).toBe(true);
      expect(json.expiresAt).toBeDefined();

      await app.close();
    });

    it('sweeps expired groups via POST /api/conversations/sweep-expired', async () => {
      const mockDb = createMockDb() as any;
      const groupExpirationService = new GroupExpirationService(mockDb, mockIo, false);
      vi.spyOn(groupExpirationService, 'sweepExpiredGroups').mockResolvedValue({
        processedCount: 3,
        expiredGroupIds: ['g1', 'g2', 'g3'],
      });

      const conversationService = new ConversationService(mockDb, groupExpirationService, mockIo);
      const app = buildServer({ conversationService, groupExpirationService });
      await app.ready();

      const token = app.jwt.sign({
        userId: mockCreatorId,
        accountId: mockAccountId,
        role: 'admin',
        email: 'admin@corp.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/conversations/sweep-expired',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.processedCount).toBe(3);
      expect(json.expiredGroupIds).toEqual(['g1', 'g2', 'g3']);

      await app.close();
    });
  });
});
