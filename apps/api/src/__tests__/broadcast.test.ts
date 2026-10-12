import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BroadcastService } from '../services/broadcast.service';
import { MessageService } from '../services/message.service';
import { buildServer } from '../server';

// Helper to safely extract string values from Drizzle AST objects without circular errors
function getStringsFrom(obj: any, visited = new Set<any>()): string[] {
  if (!obj || visited.has(obj)) return [];
  visited.add(obj);
  const results: string[] = [];
  if (typeof obj === 'string') {
    results.push(obj);
    return results;
  }
  if (typeof obj === 'object') {
    for (const key of Object.getOwnPropertyNames(obj)) {
      try {
        results.push(...getStringsFrom(obj[key], visited));
      } catch (_) {}
    }
    for (const sym of Object.getOwnPropertySymbols(obj)) {
      try {
        results.push(...getStringsFrom((obj as any)[sym], visited));
      } catch (_) {}
    }
  }
  return results;
}

describe('Broadcast Lists & Delivery Reports (T-25)', () => {
  const proAccountId = '11111111-1111-1111-1111-111111111111';
  const freeAccountId = '22222222-2222-2222-2222-222222222222';
  const entAccountId = '33333333-3333-3333-3333-333333333333';

  const adminUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const memberUser1Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const memberUser2Id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  let mockConversationsData: any[] = [];
  let mockMembersData: any[] = [];
  let mockMessagesData: any[] = [];
  let mockReceiptsData: any[] = [];
  let mockIo: any;
  let mockPresenceService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationsData = [];
    mockMembersData = [];
    mockMessagesData = [];
    mockReceiptsData = [];

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    mockPresenceService = {
      isUserOnline: vi.fn(async (userId: string) => userId === memberUser1Id), // member1 online, member2 offline
      setIoServer: vi.fn(),
    };
  });

  const createMockDb = () => {
    const mockAccounts: Record<string, any> = {
      [proAccountId]: { id: proAccountId, name: 'Pro Corp', plan: 'pro', status: 'active' },
      [freeAccountId]: { id: freeAccountId, name: 'Free Startup', plan: 'free', status: 'active' },
      [entAccountId]: { id: entAccountId, name: 'Big Enterprise', plan: 'enterprise', status: 'active' },
    };

    const mockUsersList = [
      { id: adminUserId, accountId: proAccountId, name: 'Admin Pro', email: 'admin@pro.com', role: 'admin', status: 'active' },
      { id: memberUser1Id, accountId: proAccountId, name: 'Member Online', email: 'm1@pro.com', role: 'member', status: 'active' },
      { id: memberUser2Id, accountId: proAccountId, name: 'Member Offline', email: 'm2@pro.com', role: 'member', status: 'active' },
    ];

    return {
      query: {
        accounts: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            for (const accId of Object.keys(mockAccounts)) {
              if (strings.includes(accId)) return mockAccounts[accId];
            }
            return mockAccounts[proAccountId];
          }),
        },
        users: {
          findMany: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return mockUsersList.filter((u) => strings.includes(u.accountId) || strings.includes(u.id));
          }),
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return mockUsersList.find((u) => strings.includes(u.id)) || mockUsersList[0];
          }),
        },
        conversations: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const conv = mockConversationsData.find((c) => strings.includes(c.id) || (strings.includes(c.accountId) && c.type === 'broadcast'));
            if (!conv) return null;
            return {
              ...conv,
              members: mockMembersData.filter((m) => m.conversationId === conv.id),
            };
          }),
          findMany: vi.fn(async () => mockConversationsData),
        },
        messages: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const msg = mockMessagesData.find((m) => strings.includes(m.id));
            if (!msg) return null;
            const conv = mockConversationsData.find((c) => c.id === msg.conversationId);
            const sender = mockUsersList.find((u) => u.id === msg.senderId);
            return {
              ...msg,
              conversation: conv,
              sender,
            };
          }),
        },
        messageReceipts: {
          findMany: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const targetReceipts = mockReceiptsData.filter((r) => strings.includes(r.messageId));
            return targetReceipts.map((r) => ({
              ...r,
              user: mockUsersList.find((u) => u.id === r.userId),
            }));
          }),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
          let returnedVal: any = [val];
          if (Array.isArray(val)) {
            val.forEach((item) => {
              if (item.messageId) {
                mockReceiptsData.push({ id: `rcpt-${Date.now()}-${Math.random()}`, ...item });
              } else if (item.conversationId) {
                mockMembersData.push({ id: `mem-${Date.now()}-${Math.random()}`, ...item });
              }
            });
            returnedVal = val;
          } else if (val.type === 'broadcast' || val.title === 'Comunicados') {
            const record = { id: `conv-broadcast-${Date.now()}`, ...val, createdAt: new Date() };
            mockConversationsData.push(record);
            returnedVal = [record];
          } else if (val.content !== undefined) {
            const record = { id: `msg-${Date.now()}`, ...val, createdAt: new Date() };
            mockMessagesData.push(record);
            returnedVal = [record];
          }
          return {
            returning: () => returnedVal,
            then: (resolve: any) => Promise.resolve(returnedVal).then(resolve),
          };
        }),
      })),
    };
  };

  describe('Plan Restrictions (T-25)', () => {
    it('blocks Free plan accounts from accessing or creating broadcast lists', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);

      await expect(
        broadcastService.getOrCreateBroadcastConversation(freeAccountId, adminUserId)
      ).rejects.toThrow('O recurso de lista de transmissão não está disponível no plano Free.');
    });

    it('blocks Free plan accounts from sending broadcast messages', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);

      await expect(
        broadcastService.sendBroadcast(freeAccountId, adminUserId, 'admin', {
          content: 'Comunicado de teste',
        })
      ).rejects.toThrow('O recurso de lista de transmissão não está disponível no plano Free.');
    });
  });

  describe('Permissions & Role Restrictions (T-25)', () => {
    it('blocks regular members (non-admin) from sending broadcast messages', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);

      await expect(
        broadcastService.sendBroadcast(proAccountId, memberUser1Id, 'member', {
          content: 'Tentativa de envio por membro comum',
        })
      ).rejects.toThrow('Apenas administradores podem enviar comunicados via lista de transmissão.');
    });

    it('blocks regular members from posting in the Comunicados broadcast conversation', async () => {
      const mockDb = createMockDb() as any;
      const convId = 'broadcast-channel-1';

      mockConversationsData.push({
        id: convId,
        accountId: proAccountId,
        type: 'broadcast',
        title: 'Comunicados',
        status: 'active',
      });

      mockMembersData.push({
        id: 'm1',
        conversationId: convId,
        userId: memberUser1Id,
        role: 'member',
      });

      const messageService = new MessageService(mockDb);

      await expect(
        messageService.sendMessage(proAccountId, memberUser1Id, {
          conversationId: convId,
          content: 'Tentando responder ao comunicado',
        })
      ).rejects.toThrow('Destinatários não podem responder em canais de transmissão de comunicados.');
    });
  });

  describe('Broadcast Sending & Receipts (T-25)', () => {
    it('sends broadcast to all account members, creating immediate online delivery and offline receipts', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);

      const result = await broadcastService.sendBroadcast(proAccountId, adminUserId, 'admin', {
        title: 'Aviso Importante de Fim de Ano',
        content: 'Plantão de recesso inicia na próxima sexta-feira.',
      });

      expect(result.message.content).toBe('Plantão de recesso inicia na próxima sexta-feira.');
      expect((result.message.metadata as any).title).toBe('Aviso Importante de Fim de Ano');
      expect(result.summary.totalRecipients).toBe(2); // memberUser1 and memberUser2
      expect(result.summary.onlineDeliveredCount).toBe(1); // memberUser1 online
      expect(result.summary.offlineQueuedCount).toBe(1); // memberUser2 offline

      // Verify receipts inserted
      expect(mockReceiptsData).toHaveLength(2);
      const onlineReceipt = mockReceiptsData.find((r) => r.userId === memberUser1Id);
      const offlineReceipt = mockReceiptsData.find((r) => r.userId === memberUser2Id);

      expect(onlineReceipt.deliveredAt).not.toBeNull();
      expect(offlineReceipt.deliveredAt).toBeNull();

      // Verify WebSocket broadcasts
      expect(mockIo.to).toHaveBeenCalledWith(`account:${proAccountId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('message:new', expect.any(Object));
    });
  });

  describe('Delivery & Read Report (T-25)', () => {
    it('generates accurate delivery and read rate metrics for admin', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);

      const convId = 'broadcast-channel-1';
      const msgId = 'msg-broadcast-99';

      mockConversationsData.push({
        id: convId,
        accountId: proAccountId,
        type: 'broadcast',
        title: 'Comunicados',
      });

      mockMessagesData.push({
        id: msgId,
        conversationId: convId,
        senderId: adminUserId,
        content: 'Comunicado Geral',
        createdAt: new Date(),
      });

      // 1 read, 1 delivered (unread), 1 pending
      mockReceiptsData.push(
        {
          id: 'r1',
          messageId: msgId,
          userId: memberUser1Id,
          deliveredAt: new Date(),
          readAt: new Date(),
        },
        {
          id: 'r2',
          messageId: msgId,
          userId: memberUser2Id,
          deliveredAt: new Date(),
          readAt: null,
        }
      );

      const report = await broadcastService.getBroadcastReport(proAccountId, adminUserId, 'admin', msgId);

      expect(report.summary.totalRecipients).toBe(2);
      expect(report.summary.deliveredCount).toBe(2);
      expect(report.summary.readCount).toBe(1);
      expect(report.summary.pendingCount).toBe(0);
      expect(report.summary.deliveryRatePercent).toBe(100);
      expect(report.summary.readRatePercent).toBe(50);
      expect(report.recipients).toHaveLength(2);
      expect(report.recipients.find((r) => r.userId === memberUser1Id)?.status).toBe('read');
      expect(report.recipients.find((r) => r.userId === memberUser2Id)?.status).toBe('delivered');
    });

    it('rejects report access for non-admin members', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);

      await expect(
        broadcastService.getBroadcastReport(proAccountId, memberUser1Id, 'member', 'msg-123')
      ).rejects.toThrow('Apenas administradores podem visualizar o relatório de transmissão.');
    });
  });

  describe('Fastify Broadcast Routes (/api/broadcasts)', () => {
    it('POST /api/broadcasts creates broadcast and returns 201 for Admin on Pro plan', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);
      const app = buildServer({ broadcastService });
      await app.ready();

      const token = app.jwt.sign({
        userId: adminUserId,
        accountId: proAccountId,
        role: 'admin',
        email: 'admin@pro.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/broadcasts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Comunicado Urgente',
          content: 'Manutenção programada dos servidores hoje às 22h.',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.payload);
      expect(json.message.content).toBe('Manutenção programada dos servidores hoje às 22h.');
      expect(json.summary.totalRecipients).toBe(2);

      await app.close();
    });

    it('POST /api/broadcasts returns 403 Forbidden for Admin on Free plan', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);
      const app = buildServer({ broadcastService });
      await app.ready();

      const token = app.jwt.sign({
        userId: adminUserId,
        accountId: freeAccountId,
        role: 'admin',
        email: 'admin@free.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/broadcasts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          content: 'Tentativa no Free',
        },
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.payload);
      expect(json.message).toContain('plano Free');

      await app.close();
    });

    it('GET /api/broadcasts/:messageId/report returns 200 with delivery breakdown', async () => {
      const mockDb = createMockDb() as any;
      const broadcastService = new BroadcastService(mockDb, mockPresenceService, mockIo);

      vi.spyOn(broadcastService, 'getBroadcastReport').mockResolvedValueOnce({
        messageId: 'msg-abc',
        conversationId: 'conv-abc',
        content: 'Comunicado de teste',
        sentAt: new Date().toISOString(),
        sender: { id: adminUserId, name: 'Admin', email: 'admin@pro.com' },
        summary: {
          totalRecipients: 50,
          deliveredCount: 45,
          readCount: 30,
          pendingCount: 5,
          deliveryRatePercent: 90,
          readRatePercent: 60,
        },
        recipients: [],
      });

      const app = buildServer({ broadcastService });
      await app.ready();

      const token = app.jwt.sign({
        userId: adminUserId,
        accountId: proAccountId,
        role: 'admin',
        email: 'admin@pro.com',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/broadcasts/msg-abc/report',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.summary.totalRecipients).toBe(50);
      expect(json.summary.deliveryRatePercent).toBe(90);
      expect(json.summary.readRatePercent).toBe(60);

      await app.close();
    });

    it('getBroadcastReport rejects missing messages or non-broadcast conversations', async () => {
      const mockDb: any = {
        query: {
          messages: {
            findFirst: vi.fn(),
          },
        },
      };

      const broadcastService = new BroadcastService(mockDb);

      // 1. Message not found
      mockDb.query.messages.findFirst.mockResolvedValueOnce(null);
      await expect(
        broadcastService.getBroadcastReport(proAccountId, adminUserId, 'admin', 'missing-msg')
      ).rejects.toThrow('Mensagem de transmissão não encontrada.');

      // 2. Not a broadcast conversation
      mockDb.query.messages.findFirst.mockResolvedValueOnce({
        id: 'msg-direct',
        conversation: { accountId: proAccountId, type: 'direct' },
      });
      await expect(
        broadcastService.getBroadcastReport(proAccountId, adminUserId, 'admin', 'msg-direct')
      ).rejects.toThrow('Esta mensagem não é um comunicado de transmissão desta organização.');
    });
  });
});
