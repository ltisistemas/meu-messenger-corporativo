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
  });
});
