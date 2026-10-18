import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../services/message.service';
import { buildServer } from '../server';
import { WS_EVENTS } from '../ws/events';

describe('Message Receipts & Typing Indicators (T-10)', () => {
  const accountId = 'acc-receipt-123';
  const senderId = 'usr-sender-1';
  const readerId = 'usr-reader-2';
  const conversationId = 'conv-test-777';

  let mockDb: any;
  let mockPresence: any;
  let mockIo: any;
  let messageService: MessageService;

  beforeEach(() => {
    mockPresence = {
      isUserOnline: vi.fn().mockResolvedValue(true),
      setIoServer: vi.fn(),
    };

    mockIo = {
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
    };

    const mockUnreadReceipts = [
      {
        id: 'rec-1',
        messageId: 'msg-1',
        userId: readerId,
        deliveredAt: new Date(),
        readAt: null,
        message: {
          id: 'msg-1',
          conversationId,
          senderId,
        },
      },
      {
        id: 'rec-2',
        messageId: 'msg-2',
        userId: readerId,
        deliveredAt: null,
        readAt: null,
        message: {
          id: 'msg-2',
          conversationId,
          senderId,
        },
      },
    ];

    mockDb = {
      query: {
        conversationMembers: {
          findFirst: vi.fn().mockResolvedValue({
            conversationId,
            userId: readerId,
            conversation: { id: conversationId, accountId },
          }),
        },
        messageReceipts: {
          findMany: vi.fn().mockResolvedValue(mockUnreadReceipts),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({}),
        })),
      })),
    };

    messageService = new MessageService(mockDb, mockPresence as any, mockIo as any);
  });

  it('should mark unread messages as read and broadcast message:receipt event in real time', async () => {
    const result = await messageService.markConversationAsRead(accountId, readerId, conversationId);

    expect(result.updatedCount).toBe(2);
    expect(result.readAt).toBeDefined();

    // Verify DB update was executed
    expect(mockDb.update).toHaveBeenCalled();

    // Verify broadcast to conversation room
    expect(mockIo.to).toHaveBeenCalledWith(`conv:${conversationId}`);

    // Verify broadcast to sender personal room
    expect(mockIo.to).toHaveBeenCalledWith(`user:${senderId}`);
  });

  it('should return 0 updated if there are no unread messages in conversation', async () => {
    mockDb.query.messageReceipts.findMany.mockResolvedValue([]);

    const result = await messageService.markConversationAsRead(accountId, readerId, conversationId);

    expect(result.updatedCount).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should reject mark as read if user is not a member of the conversation', async () => {
    mockDb.query.conversationMembers.findFirst.mockResolvedValue(null);

    await expect(
      messageService.markConversationAsRead(accountId, 'non-member', conversationId)
    ).rejects.toThrow('Acesso negado a esta conversa.');
  });

  describe('HTTP Message Read Route Integration', () => {
    it('POST /api/messages/read should reject request without auth', async () => {
      const server = buildServer();
      const res = await server.inject({
        method: 'POST',
        url: '/api/messages/read',
        payload: {
          conversationId: '00000000-0000-0000-0000-000000000000',
        },
      });

      expect(res.statusCode).toBe(401);
      await server.close();
    });
  });
});
