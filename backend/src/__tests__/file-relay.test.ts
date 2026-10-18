import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileRelayService } from '../services/file-relay.service';
import { WS_EVENTS } from '../ws/events';
import { BYTES_IN_MB } from '@/shared';

describe('In-Memory WebSocket File Streaming Relay (T-16)', () => {
  const MB = BYTES_IN_MB;
  const accountId = 'acc-free-123';
  const senderId = 'usr-sender-1';
  const onlineRecipientId = 'usr-online-2';
  const offlineRecipientId = 'usr-offline-3';
  const directConvId = 'conv-direct-101';
  const groupConvId = 'conv-group-202';
  const transferId = '11111111-2222-3333-4444-555555555555';

  const mockAccountFree = {
    id: accountId,
    name: 'Free Workspace',
    plan: 'free',
    status: 'active',
  };

  const mockSenderUser = {
    id: senderId,
    name: 'Sender Alice',
  };

  const mockDirectConversation = {
    id: directConvId,
    accountId,
    type: 'direct',
    status: 'active',
    members: [
      { userId: senderId, user: { id: senderId, name: 'Sender Alice' } },
      { userId: onlineRecipientId, user: { id: onlineRecipientId, name: 'Recipient Bob' } },
    ],
  };

  const mockDirectConvWithOffline = {
    id: directConvId,
    accountId,
    type: 'direct',
    status: 'active',
    members: [
      { userId: senderId, user: { id: senderId, name: 'Sender Alice' } },
      { userId: offlineRecipientId, user: { id: offlineRecipientId, name: 'Recipient Offline' } },
    ],
  };

  let mockDb: any;
  let mockPresence: any;
  let mockIo: any;
  let fileRelayService: FileRelayService;

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
          findFirst: vi.fn().mockResolvedValue(mockAccountFree),
        },
        conversations: {
          findFirst: vi.fn().mockResolvedValue(mockDirectConversation),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue(mockSenderUser),
        },
      },
      insert: vi.fn((table) => ({
        values: vi.fn((vals) => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'msg-file-001',
              conversationId: directConvId,
              senderId,
              type: 'file',
              content: 'relatorio.pdf',
              metadata: {
                fileName: 'relatorio.pdf',
                fileSize: 3 * MB,
                transferMethod: 'relay_memory',
              },
              createdAt: new Date(),
            },
          ]),
        })),
      })),
    };

    fileRelayService = new FileRelayService(mockDb, mockPresence as any, mockIo as any);
  });

  describe('Relay Initialization (file:relay:init)', () => {
    it('initializes streaming relay session for online recipient in Free plan', async () => {
      const result = await fileRelayService.initRelay(accountId, senderId, 'socket-sender-1', {
        transferId,
        conversationId: directConvId,
        fileName: 'planilha.xlsx',
        fileSize: 3.5 * MB,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        totalChunks: 56,
        chunkSize: 64 * 1024,
      });

      expect(result.success).toBe(true);
      expect(result.transferId).toBe(transferId);
      expect(result.recipientCount).toBe(1);
      expect(result.recipientUserIds).toEqual([onlineRecipientId]);

      // Verifies notification is piped directly to online recipient personal room
      expect(mockIo.to).toHaveBeenCalledWith(`user:${onlineRecipientId}`);
      expect(fileRelayService.getActiveSessionsCount()).toBe(1);
    });

    it('rejects relay initialization if recipient is offline on Free plan', async () => {
      mockDb.query.conversations.findFirst.mockResolvedValueOnce(mockDirectConvWithOffline);

      await expect(
        fileRelayService.initRelay(accountId, senderId, 'socket-sender-1', {
          transferId,
          conversationId: directConvId,
          fileName: 'documento.pdf',
          fileSize: 2 * MB,
          mimeType: 'application/pdf',
          totalChunks: 32,
          chunkSize: 64 * 1024,
        })
      ).rejects.toThrow(
        'Recipient Offline está offline. No plano Free, arquivos só são enviados para quem está online.'
      );

      expect(fileRelayService.getActiveSessionsCount()).toBe(0);
    });

    it('rejects relay initialization if file exceeds 5 MB on Free plan', async () => {
      await expect(
        fileRelayService.initRelay(accountId, senderId, 'socket-sender-1', {
          transferId,
          conversationId: directConvId,
          fileName: 'video_grande.mp4',
          fileSize: 6 * MB,
          mimeType: 'video/mp4',
          totalChunks: 96,
          chunkSize: 64 * 1024,
        })
      ).rejects.toThrow('excede o limite de 5 MB do plano Free');

      expect(fileRelayService.getActiveSessionsCount()).toBe(0);
    });

    it('rejects relay initialization if sender is not member of conversation', async () => {
      mockDb.query.conversations.findFirst.mockResolvedValueOnce({
        ...mockDirectConversation,
        members: [{ userId: 'other-user', user: { id: 'other-user' } }],
      });

      await expect(
        fileRelayService.initRelay(accountId, senderId, 'socket-sender-1', {
          transferId,
          conversationId: directConvId,
          fileName: 'doc.pdf',
          fileSize: 1 * MB,
          mimeType: 'application/pdf',
          totalChunks: 16,
          chunkSize: 64 * 1024,
        })
      ).rejects.toThrow('Você não é membro desta conversa.');
    });
  });

  describe('Relay Chunk Piping (file:relay:chunk)', () => {
    beforeEach(async () => {
      await fileRelayService.initRelay(accountId, senderId, 'socket-sender-1', {
        transferId,
        conversationId: directConvId,
        fileName: 'dados.bin',
        fileSize: 128 * 1024,
        mimeType: 'application/octet-stream',
        totalChunks: 2,
        chunkSize: 64 * 1024,
      });
    });

    it('forwards binary chunk directly to online recipient socket with zero heap persistence', async () => {
      const chunkData = new Uint8Array([1, 2, 3, 4, 5]);

      const res = await fileRelayService.relayChunk(senderId, {
        transferId,
        chunkIndex: 0,
        data: chunkData,
      });

      expect(res.success).toBe(true);
      expect(res.chunkIndex).toBe(0);
      expect(mockIo.to).toHaveBeenCalledWith(`user:${onlineRecipientId}`);
    });

    it('rejects chunk if transferId does not exist', async () => {
      await expect(
        fileRelayService.relayChunk(senderId, {
          transferId: '00000000-0000-0000-0000-000000000000',
          chunkIndex: 0,
          data: new Uint8Array([]),
        })
      ).rejects.toThrow('Sessão de transferência de arquivo não encontrada ou expirada.');
    });

    it('rejects chunk if sent by unauthorized user', async () => {
      await expect(
        fileRelayService.relayChunk('attacker-user-id', {
          transferId,
          chunkIndex: 0,
          data: new Uint8Array([]),
        })
      ).rejects.toThrow('Acesso negado à sessão de transferência.');
    });
  });

  describe('Relay Completion (file:relay:complete)', () => {
    beforeEach(async () => {
      await fileRelayService.initRelay(accountId, senderId, 'socket-sender-1', {
        transferId,
        conversationId: directConvId,
        fileName: 'relatorio.pdf',
        fileSize: 3 * MB,
        mimeType: 'application/pdf',
        totalChunks: 48,
        chunkSize: 64 * 1024,
      });
    });

    it('completes transfer, persists message in database, emits message:new, and frees session', async () => {
      const res = await fileRelayService.completeRelay(senderId, { transferId });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-file-001');

      // Verifies notification is sent to conversation and recipient
      expect(mockIo.to).toHaveBeenCalledWith(`conv:${directConvId}`);
      expect(mockIo.to).toHaveBeenCalledWith(`user:${onlineRecipientId}`);

      // Verifies DB insert for message and receipts
      expect(mockDb.insert).toHaveBeenCalled();

      // Verifies session memory is freed immediately
      expect(fileRelayService.getActiveSessionsCount()).toBe(0);
    });
  });

  describe('Group Partial Delivery - "Entregue a X de Y" (T-17)', () => {
    it('delivers streaming relay only to online members and records "Entregue a 4 de 7"', async () => {
      const groupMembers = [
        { userId: senderId, user: { id: senderId, name: 'Sender Alice' } },
        { userId: 'u1', user: { id: 'u1', name: 'User 1' } },
        { userId: 'u2', user: { id: 'u2', name: 'User 2' } },
        { userId: 'u3', user: { id: 'u3', name: 'User 3' } },
        { userId: 'u4', user: { id: 'u4', name: 'User 4' } },
        { userId: 'u5', user: { id: 'u5', name: 'User 5' } },
        { userId: 'u6', user: { id: 'u6', name: 'User 6' } },
        { userId: 'u7', user: { id: 'u7', name: 'User 7' } },
      ]; // 1 sender + 7 recipients

      mockDb.query.conversations.findFirst.mockResolvedValueOnce({
        id: groupConvId,
        accountId,
        type: 'group',
        status: 'active',
        members: groupMembers,
      });

      // 4 users online: u1, u2, u3, u4
      const onlineSet = new Set(['u1', 'u2', 'u3', 'u4']);
      mockPresence.isUserOnline.mockImplementation(async (uid: string) => onlineSet.has(uid));

      // 1. Initialize relay
      const initRes = await fileRelayService.initRelay(accountId, senderId, 'socket-sender-1', {
        transferId: 'group-transfer-777',
        conversationId: groupConvId,
        fileName: 'pauta_reuniao.pdf',
        fileSize: 2 * MB,
        mimeType: 'application/pdf',
        totalChunks: 32,
        chunkSize: 64 * 1024,
      });

      expect(initRes.success).toBe(true);
      expect(initRes.recipientCount).toBe(4);
      expect(initRes.totalRecipientsCount).toBe(7);
      expect(initRes.deliverySummary).toBe('Entregue a 4 de 7');
      expect(initRes.recipientUserIds).toEqual(['u1', 'u2', 'u3', 'u4']);

      // Verifies notification is sent ONLY to the 4 online members
      expect(mockIo.to).toHaveBeenCalledWith('user:u1');
      expect(mockIo.to).toHaveBeenCalledWith('user:u2');
      expect(mockIo.to).toHaveBeenCalledWith('user:u3');
      expect(mockIo.to).toHaveBeenCalledWith('user:u4');
      expect(mockIo.to).not.toHaveBeenCalledWith('user:u5');
      expect(mockIo.to).not.toHaveBeenCalledWith('user:u6');
      expect(mockIo.to).not.toHaveBeenCalledWith('user:u7');

      // 2. Relay chunk
      const chunkRes = await fileRelayService.relayChunk(senderId, {
        transferId: 'group-transfer-777',
        chunkIndex: 0,
        data: new Uint8Array([1, 2, 3]),
      });
      expect(chunkRes.success).toBe(true);

      // 3. Complete relay
      let insertedReceipts: any[] = [];
      let insertedMessage: any = null;

      mockDb.insert = vi.fn((table) => ({
        values: vi.fn((vals) => {
          if (Array.isArray(vals)) {
            insertedReceipts = vals;
          } else {
            insertedMessage = vals;
          }
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: 'msg-group-file-001',
                conversationId: groupConvId,
                senderId,
                type: 'file',
                content: 'pauta_reuniao.pdf',
                metadata: insertedMessage?.metadata || {},
                createdAt: new Date(),
              },
            ]),
          };
        }),
      }));

      const completeRes = await fileRelayService.completeRelay(senderId, {
        transferId: 'group-transfer-777',
      });

      expect(completeRes.success).toBe(true);
      expect(completeRes.deliverySummary).toBe('Entregue a 4 de 7');

      // Verifies message metadata has deliveredToCount = 4, totalRecipientsCount = 7, deliverySummary = "Entregue a 4 de 7"
      expect(insertedMessage.metadata.deliveredToCount).toBe(4);
      expect(insertedMessage.metadata.totalRecipientsCount).toBe(7);
      expect(insertedMessage.metadata.deliverySummary).toBe('Entregue a 4 de 7');
      expect(insertedMessage.metadata.isGroup).toBe(true);

      // Verifies receipts were created ONLY for the 4 online recipients
      expect(insertedReceipts.length).toBe(4);
      expect(insertedReceipts.map((r) => r.userId).sort()).toEqual(['u1', 'u2', 'u3', 'u4']);
    });

    it('cancelOrErrorRelay, getSession and getActiveSessionsCount handle session lifecycle and errors', async () => {
      // 1. cancel non-existent session
      fileRelayService.cancelOrErrorRelay('non-existent');

      // 2. initialize session
      (fileRelayService as any).sessions.set('sess-cancel-1', {
        transferId: 'sess-cancel-1',
        senderSocketId: 'socket-snd',
        recipientUserIds: [onlineRecipientId],
      });

      expect(fileRelayService.getActiveSessionsCount()).toBeGreaterThanOrEqual(1);
      expect(fileRelayService.getSession('sess-cancel-1')).toBeDefined();

      // 3. cancel existing session
      fileRelayService.cancelOrErrorRelay('sess-cancel-1', senderId, 'User cancelled');
      expect(fileRelayService.getSession('sess-cancel-1')).toBeUndefined();
      expect(mockIo.to).toHaveBeenCalledWith('socket-snd');
      expect(mockIo.to).toHaveBeenCalledWith(`user:${onlineRecipientId}`);
    });
  });
});

