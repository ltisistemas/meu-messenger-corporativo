import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WS_EVENTS } from '../ws/events';

let registeredMiddleware: any = null;
let registeredConnectionHandler: any = null;

vi.mock('socket.io', () => {
  return {
    Server: class MockServer {
      constructor() {}
      use(fn: any) {
        registeredMiddleware = fn;
      }
      on(event: string, handler: any) {
        if (event === 'connection') {
          registeredConnectionHandler = handler;
        }
      }
    },
  };
});

import { createWebSocketServer } from '../ws/socket.server';

describe('WebSocket Server Unit & Handlers Deep Coverage', () => {
  const dummyHttpServer: any = {};
  const mockUser = {
    userId: 'a0000000-0000-0000-0000-000000000001',
    accountId: 'a0000000-0000-0000-0000-000000000002',
    role: 'member',
    email: 'user@empresa.com',
  };

  const mockFastify: any = {
    jwt: {
      verify: vi.fn(),
    },
  };

  const mockPresence: any = {
    setIoServer: vi.fn(),
    setUserOnline: vi.fn().mockResolvedValue(undefined),
    setUserOffline: vi.fn().mockResolvedValue(undefined),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    getUsersPresence: vi.fn().mockResolvedValue({ [mockUser.userId]: 'online' }),
    getOnlineUsers: vi.fn().mockResolvedValue([mockUser.userId]),
  };

  const mockMessage: any = {
    setIoServer: vi.fn(),
    syncOfflineMessages: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({ id: 'msg-1', content: 'Olá' }),
    markConversationAsRead: vi.fn().mockResolvedValue({ markedCount: 2 }),
  };

  const mockFileRelay: any = {
    setIoServer: vi.fn(),
    initRelay: vi.fn().mockResolvedValue({ transferId: 'tr-1', status: 'ready' }),
    relayChunk: vi.fn().mockResolvedValue({ ack: true }),
    completeRelay: vi.fn().mockResolvedValue({ success: true }),
    cancelOrErrorRelay: vi.fn(),
  };

  beforeEach(() => {
    registeredMiddleware = null;
    registeredConnectionHandler = null;
    vi.clearAllMocks();
  });

  it('runs authentication middleware and handles token absence, invalidity and validity', async () => {
    createWebSocketServer(
      dummyHttpServer,
      mockFastify,
      mockPresence,
      mockMessage,
      mockFileRelay
    );

    expect(registeredMiddleware).toBeDefined();

    // 1. Missing token
    const socketNoToken: any = { handshake: { headers: {} }, data: {} };
    const next1 = vi.fn();
    await registeredMiddleware(socketNoToken, next1);
    expect(next1).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Token de acesso ausente') }));

    // 2. Invalid token
    const socketBadToken: any = {
      handshake: { headers: { authorization: 'Bearer bad.token' } },
      data: {},
    };
    mockFastify.jwt.verify.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });
    const next2 = vi.fn();
    await registeredMiddleware(socketBadToken, next2);
    expect(next2).toHaveBeenCalledWith(expect.any(Error));

    // 3. Valid token
    const socketValidToken: any = {
      handshake: { headers: {}, auth: { token: 'valid.token' } },
      data: {},
    };
    mockFastify.jwt.verify.mockReturnValueOnce(mockUser);
    const next3 = vi.fn();
    await registeredMiddleware(socketValidToken, next3);
    expect(next3).toHaveBeenCalledWith();
    expect(socketValidToken.data.user).toEqual(mockUser);
  });

  it('handles connection lifecycle, all socket listeners and error branches', async () => {
    createWebSocketServer(
      dummyHttpServer,
      mockFastify,
      mockPresence,
      mockMessage,
      mockFileRelay
    );

    expect(registeredConnectionHandler).toBeDefined();

    const listeners: Record<string, (...args: any[]) => any> = {};
    const mockSocket: any = {
      id: 'sock-123',
      data: { user: mockUser },
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      on: vi.fn((event, handler) => {
        listeners[event] = handler;
      }),
    };

    await registeredConnectionHandler(mockSocket);

    expect(mockSocket.join).toHaveBeenCalledWith(`user:${mockUser.userId}`);
    expect(mockSocket.join).toHaveBeenCalledWith(`account:${mockUser.accountId}`);
    expect(mockPresence.setUserOnline).toHaveBeenCalledWith(mockUser.accountId, mockUser.userId, 'sock-123');
    expect(mockSocket.emit).toHaveBeenCalledWith(WS_EVENTS.AUTHENTICATED, expect.objectContaining({ userId: mockUser.userId }));

    // 1. heartbeat
    await listeners['heartbeat']();
    expect(mockPresence.heartbeat).toHaveBeenCalledWith(mockUser.userId);

    // 2. presence query
    const presCb1 = vi.fn();
    await listeners[WS_EVENTS.PRESENCE_QUERY]({ userIds: [mockUser.userId] }, presCb1);
    expect(presCb1).toHaveBeenCalled();

    const presCb2 = vi.fn();
    await listeners[WS_EVENTS.PRESENCE_QUERY]({}, presCb2);
    expect(presCb2).toHaveBeenCalled();

    await listeners[WS_EVENTS.PRESENCE_QUERY]({}, undefined);
    expect(mockSocket.emit).toHaveBeenCalledWith(WS_EVENTS.PRESENCE_STATUS, expect.any(Object));

    // 3. message:send
    const sendBadCb = vi.fn();
    await listeners[WS_EVENTS.MESSAGE_SEND]({ conversationId: 'invalid', content: '' }, sendBadCb);
    expect(sendBadCb).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));

    const uuid = 'a0000000-0000-0000-0000-000000000001';
    const sendGoodCb = vi.fn();
    await listeners[WS_EVENTS.MESSAGE_SEND]({ conversationId: uuid, content: 'Oi' }, sendGoodCb);
    expect(sendGoodCb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

    // message:send failure branch
    mockMessage.sendMessage.mockRejectedValueOnce(new Error('Quota excedida'));
    const sendErrCb = vi.fn();
    await listeners[WS_EVENTS.MESSAGE_SEND]({ conversationId: uuid, content: 'Oi' }, sendErrCb);
    expect(sendErrCb).toHaveBeenCalledWith(expect.objectContaining({ error: 'Quota excedida' }));

    // 4. message:read
    await listeners['message:read']({ conversationId: 'invalid' });
    const readCb = vi.fn();
    await listeners['message:read']({ conversationId: uuid, messageIds: [uuid] }, readCb);
    expect(readCb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

    mockMessage.markConversationAsRead.mockRejectedValueOnce(new Error('DB read error'));
    const readErrCb = vi.fn();
    await listeners['message:read']({ conversationId: uuid }, readErrCb);
    expect(readErrCb).toHaveBeenCalledWith(expect.objectContaining({ error: 'DB read error' }));

    // 5. typing start and stop
    listeners[WS_EVENTS.TYPING_START]({ conversationId: uuid });
    listeners[WS_EVENTS.TYPING_STOP]({ conversationId: uuid });
    listeners[WS_EVENTS.TYPING_START]({});
    listeners[WS_EVENTS.TYPING_STOP]({});

    // 6. conversation join & leave
    listeners[WS_EVENTS.CONVERSATION_JOIN](uuid);
    expect(mockSocket.join).toHaveBeenCalledWith(`conv:${uuid}`);
    listeners[WS_EVENTS.CONVERSATION_LEAVE](uuid);
    expect(mockSocket.leave).toHaveBeenCalledWith(`conv:${uuid}`);

    // 7. file relay init
    const relayInitBadCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_INIT]({ fileName: '' }, relayInitBadCb);
    expect(relayInitBadCb).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));

    const validRelayInit = {
      transferId: uuid,
      conversationId: uuid,
      fileName: 'doc.pdf',
      fileSize: 1024,
      totalChunks: 2,
    };
    const relayInitGoodCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_INIT](validRelayInit, relayInitGoodCb);
    expect(relayInitGoodCb).toHaveBeenCalledWith(expect.objectContaining({ transferId: 'tr-1' }));

    mockFileRelay.initRelay.mockRejectedValueOnce(new Error('Tamanho excede plano'));
    const relayInitErrCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_INIT](validRelayInit, relayInitErrCb);
    expect(relayInitErrCb).toHaveBeenCalledWith(expect.objectContaining({ error: 'Tamanho excede plano' }));

    // 8. file relay chunk
    const chunkBadCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_CHUNK]({ transferId: 'bad' }, chunkBadCb);
    expect(chunkBadCb).toHaveBeenCalledWith(expect.objectContaining({ error: 'Chunk inválido.' }));

    const validChunk = { transferId: uuid, chunkIndex: 0, data: 'chunk-data' };
    const chunkGoodCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_CHUNK](validChunk, chunkGoodCb);
    expect(chunkGoodCb).toHaveBeenCalledWith({ ack: true });

    mockFileRelay.relayChunk.mockRejectedValueOnce(new Error('Sessão expirada'));
    const chunkErrCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_CHUNK](validChunk, chunkErrCb);
    expect(chunkErrCb).toHaveBeenCalledWith({ error: 'Sessão expirada' });

    // 9. file relay complete
    const compBadCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_COMPLETE]({ transferId: 'bad' }, compBadCb);
    expect(compBadCb).toHaveBeenCalledWith(expect.objectContaining({ error: 'Payload de conclusão inválido.' }));

    const compGoodCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_COMPLETE]({ transferId: uuid }, compGoodCb);
    expect(compGoodCb).toHaveBeenCalledWith({ success: true });

    mockFileRelay.completeRelay.mockRejectedValueOnce(new Error('Hash mismatch'));
    const compErrCb = vi.fn();
    await listeners[WS_EVENTS.FILE_RELAY_COMPLETE]({ transferId: uuid }, compErrCb);
    expect(compErrCb).toHaveBeenCalledWith({ error: 'Hash mismatch' });

    // 10. file relay cancel
    listeners[WS_EVENTS.FILE_RELAY_CANCEL]({ transferId: uuid, reason: 'cancelado' });
    expect(mockFileRelay.cancelOrErrorRelay).toHaveBeenCalledWith(uuid, mockUser.userId, 'cancelado');

    // 11. disconnect
    await listeners['disconnect']();
    expect(mockPresence.setUserOffline).toHaveBeenCalledWith(mockUser.accountId, mockUser.userId, 'sock-123');
  });
});
