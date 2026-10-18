import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { WS_EVENTS, SocketUserPayload } from '../../ws/events';
import { PresenceService } from '../../services/presence.service';
import { MessageService } from '../../services/message.service';
import { FileRelayService } from '../../services/file-relay.service';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 5 * 1024 * 1024,
})
@Injectable()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly presenceService: PresenceService,
    private readonly messageService: MessageService,
    private readonly fileRelayService: FileRelayService
  ) {}

  afterInit(server: Server) {
    this.presenceService.setIoServer(server);
    this.messageService.setIoServer(server);
    this.fileRelayService.setIoServer(server);
  }

  async handleConnection(socket: Socket) {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const token =
        socket.handshake.auth?.token || bearerToken || (socket.handshake.query?.token as string);

      if (!token) {
        socket.disconnect(true);
        return;
      }

      const secret = process.env.JWT_SECRET || 'supersecret_corporate_messenger_key_change_in_production';
      const decoded = jwt.verify(token, secret) as SocketUserPayload;
      if (!decoded || !decoded.userId || !decoded.accountId) {
        socket.disconnect(true);
        return;
      }

      socket.data = { user: decoded };
      socket.join(`user:${decoded.userId}`);
      socket.join(`account:${decoded.accountId}`);

      await this.presenceService.setUserOnline(decoded.accountId, decoded.userId, socket.id);

      socket.emit(WS_EVENTS.AUTHENTICATED, {
        userId: decoded.userId,
        accountId: decoded.accountId,
      });
    } catch {
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data?.user as SocketUserPayload | undefined;
    if (user?.userId && user?.accountId) {
      await this.presenceService.setUserOffline(user.accountId, user.userId, socket.id);
    }
  }

  @SubscribeMessage(WS_EVENTS.CONVERSATION_JOIN)
  handleJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    if (data?.conversationId) {
      socket.join(`conv:${data.conversationId}`);
      return { success: true, conversationId: data.conversationId };
    }
  }

  @SubscribeMessage(WS_EVENTS.CONVERSATION_LEAVE)
  handleLeaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    if (data?.conversationId) {
      socket.leave(`conv:${data.conversationId}`);
      return { success: true, conversationId: data.conversationId };
    }
  }

  @SubscribeMessage(WS_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    const user = socket.data?.user;
    if (user && data?.conversationId) {
      socket.broadcast.to(`conv:${data.conversationId}`).emit(WS_EVENTS.TYPING_START, {
        conversationId: data.conversationId,
        userId: user.userId,
      });
    }
  }

  @SubscribeMessage(WS_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    const user = socket.data?.user;
    if (user && data?.conversationId) {
      socket.broadcast.to(`conv:${data.conversationId}`).emit(WS_EVENTS.TYPING_STOP, {
        conversationId: data.conversationId,
        userId: user.userId,
      });
    }
  }
}
