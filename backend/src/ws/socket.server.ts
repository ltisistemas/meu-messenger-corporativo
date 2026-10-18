import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { WS_EVENTS, SocketUserPayload } from './events';
import { PresenceService } from '../services/presence.service';
import { MessageService } from '../services/message.service';
import { FileRelayService } from '../services/file-relay.service';
import {
  SendTextMessageDtoSchema,
  MarkMessagesReadDtoSchema,
  FileRelayInitDtoSchema,
  FileRelayChunkDtoSchema,
  FileRelayCompleteDtoSchema,
} from '@/shared';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: SocketUserPayload;
  };
}

export function createWebSocketServer(
  httpServer: HttpServer,
  fastify: FastifyInstance,
  presenceService: PresenceService = new PresenceService(),
  messageService: MessageService = new MessageService(),
  fileRelayService: FileRelayService = new FileRelayService()
): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000, // 10s heartbeat
    pingTimeout: 5000, // 5s timeout
    maxHttpBufferSize: 5 * 1024 * 1024, // 5 MB max buffer for Free relay chunks
  });

  presenceService.setIoServer(io);
  messageService.setIoServer(io);
  fileRelayService.setIoServer(io);

  // Authentication Middleware for WebSocket handshakes
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

      const token =
        socket.handshake.auth?.token || bearerToken || (socket.handshake.query?.token as string);

      if (!token) {
        return next(new Error('Authentication error: Token de acesso ausente.'));
      }

      // Verify JWT via Fastify JWT plugin instance
      const decoded = fastify.jwt.verify<SocketUserPayload>(token);

      if (!decoded || !decoded.userId || !decoded.accountId) {
        return next(new Error('Authentication error: Token de acesso inválido.'));
      }

      socket.data.user = {
        userId: decoded.userId,
        accountId: decoded.accountId,
        role: decoded.role,
        email: decoded.email,
      };

      return next();
    } catch (err: any) {
      return next(
        new Error(`Authentication error: ${err.message || 'Token expirado ou inválido.'}`)
      );
    }
  });

  // Connection Handler
  io.on('connection', async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const user = authSocket.data.user;

    // Join organization and personal rooms
    const userRoom = `user:${user.userId}`;
    const accountRoom = `account:${user.accountId}`;

    authSocket.join(userRoom);
    authSocket.join(accountRoom);

    // Register user presence as online
    await presenceService.setUserOnline(user.accountId, user.userId, authSocket.id);

    // Send confirmation of successful authenticated connection
    authSocket.emit(WS_EVENTS.AUTHENTICATED, {
      userId: user.userId,
      accountId: user.accountId,
      socketId: authSocket.id,
      timestamp: new Date().toISOString(),
    });

    // Deliver queued/offline messages upon reconnection
    try {
      await messageService.syncOfflineMessages(user.userId, authSocket);
    } catch {
      // Non-blocking sync
    }

    // Heartbeat listener
    authSocket.on('heartbeat', async () => {
      await presenceService.heartbeat(user.userId);
    });

    // Presence query listener
    authSocket.on(WS_EVENTS.PRESENCE_QUERY, async (data: { userIds?: string[] }, callback) => {
      if (Array.isArray(data?.userIds) && data.userIds.length > 0) {
        const presenceMap = await presenceService.getUsersPresence(data.userIds);
        if (typeof callback === 'function') callback(presenceMap);
        else authSocket.emit(WS_EVENTS.PRESENCE_STATUS, presenceMap);
      } else {
        const onlineUsers = await presenceService.getOnlineUsers(user.accountId);
        if (typeof callback === 'function') callback({ onlineUsers });
        else authSocket.emit(WS_EVENTS.PRESENCE_STATUS, { onlineUsers });
      }
    });

    // Message send listener over WebSocket
    authSocket.on(
      WS_EVENTS.MESSAGE_SEND,
      async (payload: { conversationId: string; content: string }, callback) => {
        const parseResult = SendTextMessageDtoSchema.safeParse(payload);
        if (!parseResult.success) {
          if (typeof callback === 'function') {
            return callback({
              error: parseResult.error.errors[0]?.message || 'Dados inválidos.',
            });
          }
          return;
        }

        try {
          const sentMessage = await messageService.sendMessage(
            user.accountId,
            user.userId,
            parseResult.data
          );
          if (typeof callback === 'function') {
            callback({ success: true, message: sentMessage });
          }
        } catch (err: any) {
          if (typeof callback === 'function') {
            callback({ error: err.message || 'Falha ao enviar mensagem.' });
          }
        }
      }
    );

    // Read receipts listener over WebSocket
    authSocket.on(
      'message:read',
      async (payload: { conversationId: string; messageIds?: string[] }, callback) => {
        const parseResult = MarkMessagesReadDtoSchema.safeParse(payload);
        if (!parseResult.success) return;

        try {
          const result = await messageService.markConversationAsRead(
            user.accountId,
            user.userId,
            parseResult.data.conversationId,
            parseResult.data.messageIds
          );
          if (typeof callback === 'function') callback({ success: true, ...result });
        } catch (err: any) {
          if (typeof callback === 'function') callback({ error: err.message });
        }
      }
    );

    // Typing start indicator
    authSocket.on(WS_EVENTS.TYPING_START, (data: { conversationId: string }) => {
      if (data?.conversationId) {
        authSocket.to(`conv:${data.conversationId}`).emit(WS_EVENTS.TYPING_START, {
          conversationId: data.conversationId,
          userId: user.userId,
          email: user.email,
        });
      }
    });

    // Typing stop indicator
    authSocket.on(WS_EVENTS.TYPING_STOP, (data: { conversationId: string }) => {
      if (data?.conversationId) {
        authSocket.to(`conv:${data.conversationId}`).emit(WS_EVENTS.TYPING_STOP, {
          conversationId: data.conversationId,
          userId: user.userId,
        });
      }
    });

    // Handle joining specific conversation rooms
    authSocket.on(WS_EVENTS.CONVERSATION_JOIN, (conversationId: string) => {
      if (conversationId && typeof conversationId === 'string') {
        authSocket.join(`conv:${conversationId}`);
      }
    });

    // Handle leaving specific conversation rooms
    authSocket.on(WS_EVENTS.CONVERSATION_LEAVE, (conversationId: string) => {
      if (conversationId && typeof conversationId === 'string') {
        authSocket.leave(`conv:${conversationId}`);
      }
    });

    // File Streaming Relay: Initialize session (Free plan online-only)
    authSocket.on(WS_EVENTS.FILE_RELAY_INIT, async (payload: unknown, callback) => {
      const parsed = FileRelayInitDtoSchema.safeParse(payload);
      if (!parsed.success) {
        if (typeof callback === 'function') {
          return callback({
            error:
              parsed.error.issues[0]?.message || 'Dados inválidos para transferência de arquivo.',
          });
        }
        return;
      }

      try {
        const result = await fileRelayService.initRelay(
          user.accountId,
          user.userId,
          authSocket.id,
          parsed.data
        );
        if (typeof callback === 'function') {
          callback(result);
        }
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({
            error: err.message || 'Falha ao iniciar transferência.',
            code: err.code,
            suggestCloudShare: err.suggestCloudShare,
          });
        }
      }
    });

    // File Streaming Relay: Pipe binary chunk with backpressure
    authSocket.on(WS_EVENTS.FILE_RELAY_CHUNK, async (payload: unknown, callback) => {
      const parsed = FileRelayChunkDtoSchema.safeParse(payload);
      if (!parsed.success) {
        if (typeof callback === 'function') {
          return callback({ error: 'Chunk inválido.' });
        }
        return;
      }

      try {
        const result = await fileRelayService.relayChunk(user.userId, parsed.data);
        if (typeof callback === 'function') {
          callback(result);
        }
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({ error: err.message });
        }
      }
    });

    // File Streaming Relay: Finish transfer and save message metadata
    authSocket.on(WS_EVENTS.FILE_RELAY_COMPLETE, async (payload: unknown, callback) => {
      const parsed = FileRelayCompleteDtoSchema.safeParse(payload);
      if (!parsed.success) {
        if (typeof callback === 'function') {
          return callback({ error: 'Payload de conclusão inválido.' });
        }
        return;
      }

      try {
        const result = await fileRelayService.completeRelay(user.userId, parsed.data);
        if (typeof callback === 'function') {
          callback(result);
        }
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({ error: err.message });
        }
      }
    });

    // File Streaming Relay: Cancel or Error
    authSocket.on(
      WS_EVENTS.FILE_RELAY_CANCEL,
      (payload: { transferId?: string; reason?: string }) => {
        if (payload?.transferId) {
          fileRelayService.cancelOrErrorRelay(payload.transferId, user.userId, payload.reason);
        }
      }
    );

    // Handle disconnect

    authSocket.on('disconnect', async () => {
      await presenceService.setUserOffline(user.accountId, user.userId, authSocket.id);
    });
  });

  return io;
}

