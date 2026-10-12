import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../services/message.service';
import { PresenceService } from '../services/presence.service';
import { buildServer } from '../server';
import { WS_EVENTS } from '../ws/events';

describe('Real-time Messaging & Offline Delivery (T-09)', () => {
  const accountId = 'acc-msg-123';
  const senderId = 'usr-sender-1';
  const onlineRecipientId = 'usr-online-2';
  const offlineRecipientId = 'usr-offline-3';
  const conversationId = 'conv-test-999';

  const mockAccount = {
    id: accountId,
    name: 'Corp Account',
    status: 'active',
  };

  const mockConversation = {
    id: conversationId,
    accountId,
    type: 'group',
    status: 'active',
    members: [
      { userId: senderId },
      { userId: onlineRecipientId },
      { userId: offlineRecipientId },
    ],
  };

  let mockDb: any;
  let mockPresence: any;
  let mockIo: any;
  let messageService: MessageService;

  beforeEach(() => {
    mockPresence = {
      isUserOnline: vi.fn(async (uid: string) => uid === onlineRecipientId),
      setIoServer: vi.fn(),
    };

    mockIo = {
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
    };

    mockDb = {
      query: {
        accounts: {
          findFirst: vi.fn().mockResolvedValue(mockAccount),
        },
        conversations: {
          findFirst: vi.fn().mockResolvedValue(mockConversation),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({ id: senderId, name: 'Sender Name', avatarUrl: null }),
        },
        messageReceipts: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      insert: vi.fn((table) => ({
        values: vi.fn((vals) => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'msg-new-001',
              conversationId,
              senderId,
              type: 'text',
              content: 'Olá equipe!',
              metadata: {},
              createdAt: new Date(),
            },
          ]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({}),
        })),
      })),
    };

    messageService = new MessageService(mockDb, mockPresence as any, mockIo as any);
  });

  it('should deliver message immediately to online recipient and set deliveredAt for them', async () => {
    const result = await messageService.sendMessage(accountId, senderId, {
      conversationId,
      content: 'Olá equipe!',
    });

    expect(result.id).toBe('msg-new-001');
    expect(result.content).toBe('Olá equipe!');
    expect(mockIo.to).toHaveBeenCalledWith(`conv:${conversationId}`);
    expect(mockIo.to).toHaveBeenCalledWith(`user:${onlineRecipientId}`);

    // Verify online recipient received non-null deliveredAt and offline recipient received null
    const onlineReceipt = result.receipts?.find((r) => r.userId === onlineRecipientId);
    const offlineReceipt = result.receipts?.find((r) => r.userId === offlineRecipientId);

    expect(onlineReceipt?.deliveredAt).toBeDefined();
    expect(onlineReceipt?.deliveredAt).not.toBeNull();
    expect(offlineReceipt?.deliveredAt).toBeNull();
  });

  it('should deliver offline messages and update deliveredAt when offline user reconnects', async () => {
    const offlineMessage = {
      id: 'msg-offline-101',
      conversationId,
      senderId,
      type: 'text',
      content: 'Mensagem enquanto você estava fora',
      metadata: {},
      createdAt: new Date(),
      sender: { id: senderId, name: 'Sender Name', avatarUrl: null },
    };

    const mockPendingReceipts = [
      {
        id: 'rec-1',
        messageId: offlineMessage.id,
        userId: offlineRecipientId,
        deliveredAt: null,
        readAt: null,
        message: offlineMessage,
      },
    ];

    mockDb.query.messageReceipts.findMany.mockResolvedValue(mockPendingReceipts);

    const synced = await messageService.syncOfflineMessages(offlineRecipientId);

    expect(synced.length).toBe(1);
    expect(synced[0].id).toBe('msg-offline-101');
    expect(synced[0].receipts?.[0].deliveredAt).not.toBeNull();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockIo.to).toHaveBeenCalledWith(`user:${offlineRecipientId}`);
  });

  it('should reject sending message if conversation is archived_readonly', async () => {
    mockDb.query.conversations.findFirst.mockResolvedValue({
      ...mockConversation,
      status: 'archived_readonly',
    });

    await expect(
      messageService.sendMessage(accountId, senderId, {
        conversationId,
        content: 'Mensagem bloqueada',
      })
    ).rejects.toThrow('Esta conversa expirou e está em modo somente leitura.');
  });

  it('should reject sending message if account is over_quota', async () => {
    mockDb.query.accounts.findFirst.mockResolvedValue({
      ...mockAccount,
      status: 'over_quota',
    });

    await expect(
      messageService.sendMessage(accountId, senderId, {
        conversationId,
        content: 'Mensagem bloqueada',
      })
    ).rejects.toThrow('A organização atingiu o limite do plano e está em modo somente leitura.');
  });

  it('should reject sending message if sender is not a member of conversation', async () => {
    mockDb.query.conversations.findFirst.mockResolvedValue({
      ...mockConversation,
      members: [{ userId: onlineRecipientId }], // sender is not in list
    });

    await expect(
      messageService.sendMessage(accountId, senderId, {
        conversationId,
        content: 'Tentativa não autorizada',
      })
    ).rejects.toThrow('Você não é membro desta conversa.');
  });

  describe('HTTP Message Routes Integration', () => {
    it('POST /api/messages should require authentication', async () => {
      const server = buildServer();
      const res = await server.inject({
        method: 'POST',
        url: '/api/messages',
        payload: {
          conversationId: '00000000-0000-0000-0000-000000000000',
          content: 'Hello',
        },
      });

      expect(res.statusCode).toBe(401);
      await server.close();
    });

    it('POST, GET, and sync message routes operate correctly with auth token', async () => {
      const server = buildServer();
      await server.ready();

      const token = server.jwt.sign({
        userId: senderId,
        accountId,
        role: 'member',
        email: 'sender@corp.com',
      });

      // 1. POST /api/messages bad payload -> 400
      const bad = await server.inject({
        method: 'POST',
        url: '/api/messages',
        headers: { authorization: `Bearer ${token}` },
        payload: { conversationId: 'bad', content: '' },
      });
      expect(bad.statusCode).toBe(400);

      // 2. POST /api/messages success -> 201
      vi.spyOn(MessageService.prototype, 'sendMessage').mockResolvedValueOnce({
        id: 'msg-created-1',
        conversationId,
        senderId,
        content: 'Olá equipe',
      } as any);

      const ok = await server.inject({
        method: 'POST',
        url: '/api/messages',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId: 'a0000000-0000-0000-0000-000000000001',
          content: 'Olá equipe',
        },
      });
      expect(ok.statusCode).toBe(201);

      // 3. POST /api/messages service error -> 400
      vi.spyOn(MessageService.prototype, 'sendMessage').mockRejectedValueOnce(
        new Error('Organização over_quota')
      );
      const err = await server.inject({
        method: 'POST',
        url: '/api/messages',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId: 'a0000000-0000-0000-0000-000000000001',
          content: 'Tentativa',
        },
      });
      expect(err.statusCode).toBe(400);

      // 4. GET /api/messages/conversation/:conversationId -> 200
      vi.spyOn(MessageService.prototype, 'listMessages').mockResolvedValueOnce([
        { id: 'msg-1', content: 'Histórico' } as any,
      ]);
      const listRes = await server.inject({
        method: 'GET',
        url: '/api/messages/conversation/a0000000-0000-0000-0000-000000000001?limit=10&offset=0',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listRes.statusCode).toBe(200);

      // 5. GET /api/messages/conversation/:conversationId error -> 403
      vi.spyOn(MessageService.prototype, 'listMessages').mockRejectedValueOnce(
        new Error('Não é membro')
      );
      const listErr = await server.inject({
        method: 'GET',
        url: '/api/messages/conversation/a0000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listErr.statusCode).toBe(403);

      // 6. POST /api/messages/read invalid body -> 400
      const readBad = await server.inject({
        method: 'POST',
        url: '/api/messages/read',
        headers: { authorization: `Bearer ${token}` },
        payload: { conversationId: 'bad' },
      });
      expect(readBad.statusCode).toBe(400);

      // 7. POST /api/messages/read success -> 200
      vi.spyOn(MessageService.prototype, 'markConversationAsRead').mockResolvedValueOnce({
        markedCount: 3,
      } as any);
      const readOk = await server.inject({
        method: 'POST',
        url: '/api/messages/read',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId: 'a0000000-0000-0000-0000-000000000001',
        },
      });
      expect(readOk.statusCode).toBe(200);

      // 8. POST /api/messages/read error -> 400
      vi.spyOn(MessageService.prototype, 'markConversationAsRead').mockRejectedValueOnce(
        new Error('DB error')
      );
      const readErr = await server.inject({
        method: 'POST',
        url: '/api/messages/read',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId: 'a0000000-0000-0000-0000-000000000001',
        },
      });
      expect(readErr.statusCode).toBe(400);

      // 9. POST /api/messages/sync -> 200
      vi.spyOn(MessageService.prototype, 'syncOfflineMessages').mockResolvedValueOnce([]);
      const syncRes = await server.inject({
        method: 'POST',
        url: '/api/messages/sync',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(syncRes.statusCode).toBe(200);

      await server.close();
    });

    it('listMessages and deliverPendingMessages with direct socket handle permissions and delivery', async () => {
      // 1. listMessages access denied
      mockDb.query.conversationMembers = {
        findFirst: vi.fn().mockResolvedValue(null),
      };
      await expect(
        messageService.listMessages(accountId, senderId, conversationId)
      ).rejects.toThrow('Acesso negado às mensagens desta conversa.');

      // 2. listMessages success
      mockDb.query.conversationMembers.findFirst.mockResolvedValue({
        conversationId,
        userId: senderId,
        conversation: { accountId },
      });
      mockDb.query.messages = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'm-1',
            conversationId,
            senderId,
            type: 'text',
            content: 'Hello',
            metadata: null,
            createdAt: new Date(),
            sender: { id: senderId, name: 'Sender', avatarUrl: null },
            receipts: [{ userId: onlineRecipientId, deliveredAt: new Date(), readAt: null }],
          },
        ]),
      };

      const messagesList = await messageService.listMessages(accountId, senderId, conversationId);
      expect(messagesList).toHaveLength(1);
      expect(messagesList[0].content).toBe('Hello');

      // 3. syncOfflineMessages with direct socket
      const mockSocket: any = { emit: vi.fn() };
      mockDb.query.messageReceipts.findMany = vi.fn().mockResolvedValue([
        {
          messageId: 'm-1',
          userId: onlineRecipientId,
          deliveredAt: null,
          readAt: null,
          message: {
            id: 'm-1',
            conversationId,
            senderId,
            type: 'text',
            content: 'Offline msg',
            metadata: null,
            createdAt: new Date(),
          },
        },
      ]);
      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      const delivered = await messageService.syncOfflineMessages(onlineRecipientId, mockSocket);
      expect(delivered).toHaveLength(1);
      expect(mockSocket.emit).toHaveBeenCalledWith(WS_EVENTS.MESSAGE_NEW, expect.any(Object));
    });
  });
});
