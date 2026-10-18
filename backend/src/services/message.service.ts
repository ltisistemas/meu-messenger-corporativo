import { eq, and, desc, inArray, isNull, sql } from 'drizzle-orm';
import { Server, Socket } from 'socket.io';
import { db as defaultDb } from '../db/index';
import {
  messages,
  messageReceipts,
  conversations,
  conversationMembers,
  users,
  accounts,
} from '../db/schema/index';
import { PresenceService } from './presence.service';
import { WS_EVENTS } from '../ws/events';
import { SendTextMessageDto } from '@/shared';

export interface FormattedMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: string;
  content: string | null;
  metadata: any;
  createdAt: Date;
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  receipts?: {
    userId: string;
    deliveredAt: Date | null;
    readAt: Date | null;
  }[];
}

export class MessageService {
  constructor(
    private db = defaultDb,
    private presenceService = new PresenceService(),
    private io?: Server
  ) {}

  setIoServer(io: Server) {
    this.io = io;
    this.presenceService.setIoServer(io);
  }

  /**
   * Sends a text message, persists in DB, delivers to online members, and queues for offline
   */
  async sendMessage(
    accountId: string,
    senderId: string,
    dto: SendTextMessageDto
  ): Promise<FormattedMessage> {
    // 1. Verify account status (over_quota / suspended accounts cannot send messages)
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account || account.status === 'suspended') {
      throw new Error('Esta organização está suspensa.');
    }

    if (account.status === 'over_quota') {
      throw new Error('A organização atingiu o limite do plano e está em modo somente leitura.');
    }

    // 2. Verify conversation belongs to account and user is a member
    const conversation = await this.db.query.conversations.findFirst({
      where: and(eq(conversations.id, dto.conversationId), eq(conversations.accountId, accountId)),
      with: {
        members: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada.');
    }

    if (
      conversation.status === 'archived_readonly' ||
      (conversation.isTemporary &&
        conversation.expiresAt &&
        new Date(conversation.expiresAt) <= new Date())
    ) {
      throw new Error('Esta conversa expirou e está em modo somente leitura.');
    }

    const isMember = (conversation.members as any[]).some((m: any) => m.userId === senderId);
    if (!isMember) {
      throw new Error('Você não é membro desta conversa.');
    }

    // If conversation is a broadcast channel, only admin/owner can post
    if (conversation.type === 'broadcast') {
      const senderUser = await this.db.query.users.findFirst({
        where: eq(users.id, senderId),
      });
      if (!senderUser || (senderUser.role !== 'owner' && senderUser.role !== 'admin')) {
        throw new Error(
          'Destinatários não podem responder em canais de transmissão de comunicados.'
        );
      }
    }

    // 3. Persist message in database
    const [newMessage] = await this.db
      .insert(messages)
      .values({
        conversationId: dto.conversationId,
        senderId,
        type: 'text',
        content: dto.content.trim(),
        metadata: {},
      })
      .returning();

    // 4. Create receipts for all members and deliver
    const now = new Date();
    const otherMembers = (conversation.members as any[]).filter((m: any) => m.userId !== senderId);

    const receiptsToInsert = [];
    const onlineRecipientIds: string[] = [];
    const offlineRecipientIds: string[] = [];

    for (const member of otherMembers) {
      const isOnline = await this.presenceService.isUserOnline(member.userId);
      if (isOnline) {
        receiptsToInsert.push({
          messageId: newMessage.id,
          userId: member.userId,
          deliveredAt: now,
          readAt: null,
        });
        onlineRecipientIds.push(member.userId);
      } else {
        receiptsToInsert.push({
          messageId: newMessage.id,
          userId: member.userId,
          deliveredAt: null,
          readAt: null,
        });
        offlineRecipientIds.push(member.userId);
      }
    }

    if (receiptsToInsert.length > 0) {
      await this.db.insert(messageReceipts).values(receiptsToInsert);
    }

    const senderUser = await this.db.query.users.findFirst({
      where: eq(users.id, senderId),
    });

    const formattedMessage: FormattedMessage = {
      id: newMessage.id,
      conversationId: newMessage.conversationId,
      senderId: newMessage.senderId,
      type: newMessage.type,
      content: newMessage.content,
      metadata: newMessage.metadata,
      createdAt: newMessage.createdAt,
      sender: senderUser
        ? {
            id: senderUser.id,
            name: senderUser.name,
            avatarUrl: senderUser.avatarUrl,
          }
        : undefined,
      receipts: receiptsToInsert,
    };

    // 5. Broadcast to conversation room and online users
    if (this.io) {
      // Emit to conversation room (for users currently inside the chat)
      this.io.to(`conv:${dto.conversationId}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);

      // Emit to online users personal rooms (for badges / unread counts)
      for (const uid of onlineRecipientIds) {
        this.io.to(`user:${uid}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);
      }
    }

    return formattedMessage;
  }

  /**
   * Syncs and delivers all pending/offline messages when a user reconnects
   */
  async syncOfflineMessages(userId: string, socket?: Socket): Promise<FormattedMessage[]> {
    // 1. Find all undelivered receipts for this user
    const pendingReceipts = await this.db.query.messageReceipts.findMany({
      where: and(eq(messageReceipts.userId, userId), isNull(messageReceipts.deliveredAt)),
      with: {
        message: {
          with: {
            sender: true,
          },
        },
      },
    });

    if (pendingReceipts.length === 0) {
      return [];
    }

    const now = new Date();
    const messageIds = pendingReceipts.map((r) => r.messageId);

    // 2. Mark all as delivered
    await this.db
      .update(messageReceipts)
      .set({ deliveredAt: now })
      .where(
        and(eq(messageReceipts.userId, userId), inArray(messageReceipts.messageId, messageIds))
      );

    const formattedList: FormattedMessage[] = pendingReceipts.map((r) => ({
      id: r.message.id,
      conversationId: r.message.conversationId,
      senderId: r.message.senderId,
      type: r.message.type,
      content: r.message.content,
      metadata: r.message.metadata,
      createdAt: r.message.createdAt,
      sender: r.message.sender
        ? {
            id: r.message.sender.id,
            name: r.message.sender.name,
            avatarUrl: r.message.sender.avatarUrl,
          }
        : undefined,
      receipts: [
        {
          userId,
          deliveredAt: now,
          readAt: r.readAt,
        },
      ],
    }));

    // 3. Deliver pending messages to the user's socket
    if (socket) {
      for (const msg of formattedList) {
        socket.emit(WS_EVENTS.MESSAGE_NEW, msg);
      }
    } else if (this.io) {
      for (const msg of formattedList) {
        this.io.to(`user:${userId}`).emit(WS_EVENTS.MESSAGE_NEW, msg);
      }
    }

    // 4. Notify senders that messages have been delivered
    if (this.io) {
      for (const msg of formattedList) {
        if (msg.senderId) {
          this.io.to(`user:${msg.senderId}`).emit(WS_EVENTS.MESSAGE_RECEIPT, {
            messageId: msg.id,
            conversationId: msg.conversationId,
            userId,
            status: 'delivered',
            deliveredAt: now.toISOString(),
          });
        }
      }
    }

    return formattedList;
  }

  /**
   * Marks unread messages in a conversation as read by a user and broadcasts receipts in real time
   */
  async markConversationAsRead(
    accountId: string,
    userId: string,
    conversationId: string,
    messageIds?: string[]
  ): Promise<{ updatedCount: number; readAt: Date }> {
    // 1. Verify membership and account
    const membership = await this.db.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      ),
      with: {
        conversation: true,
      },
    });

    if (!membership || membership.conversation.accountId !== accountId) {
      throw new Error('Acesso negado a esta conversa.');
    }

    const now = new Date();

    // 2. Find target receipts in this conversation for this user that are unread
    let unreadReceipts = await this.db.query.messageReceipts.findMany({
      where: and(eq(messageReceipts.userId, userId), isNull(messageReceipts.readAt)),
      with: {
        message: true,
      },
    });

    // Filter by conversationId (and optional messageIds)
    unreadReceipts = unreadReceipts.filter(
      (r) =>
        r.message.conversationId === conversationId &&
        (!messageIds || messageIds.includes(r.messageId))
    );

    if (unreadReceipts.length === 0) {
      return { updatedCount: 0, readAt: now };
    }

    const targetMessageIds = unreadReceipts.map((r) => r.messageId);

    // 3. Update receipts: set deliveredAt (if null) and readAt
    await this.db
      .update(messageReceipts)
      .set({
        readAt: now,
        deliveredAt: sql`COALESCE(${messageReceipts.deliveredAt}, ${now})`,
      })
      .where(
        and(
          eq(messageReceipts.userId, userId),
          inArray(messageReceipts.messageId, targetMessageIds)
        )
      );

    // 4. Broadcast read receipts in real-time
    if (this.io) {
      const receiptPayload = {
        conversationId,
        userId,
        messageIds: targetMessageIds,
        status: 'read' as const,
        readAt: now.toISOString(),
      };

      // Broadcast to the conversation room (for open chats)
      this.io.to(`conv:${conversationId}`).emit(WS_EVENTS.MESSAGE_RECEIPT, receiptPayload);

      // Notify senders individually
      const senders = new Set(
        unreadReceipts.map((r) => r.message.senderId).filter((id): id is string => Boolean(id))
      );

      for (const senderId of senders) {
        this.io.to(`user:${senderId}`).emit(WS_EVENTS.MESSAGE_RECEIPT, receiptPayload);
      }
    }

    return { updatedCount: targetMessageIds.length, readAt: now };
  }

  /**
   * Retrieves paginated messages for a conversation ensuring member access
   */
  async listMessages(
    accountId: string,
    userId: string,
    conversationId: string,
    limit = 50,
    offset = 0
  ): Promise<FormattedMessage[]> {
    // Verify membership
    const membership = await this.db.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      ),
      with: {
        conversation: true,
      },
    });

    if (!membership || membership.conversation.accountId !== accountId) {
      throw new Error('Acesso negado às mensagens desta conversa.');
    }

    const rows = await this.db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      limit: Math.min(limit, 100),
      offset,
      orderBy: [desc(messages.createdAt)],
      with: {
        sender: true,
        receipts: true,
      },
    });

    return rows.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt,
      sender: m.sender
        ? {
            id: m.sender.id,
            name: m.sender.name,
            avatarUrl: m.sender.avatarUrl,
          }
        : undefined,
      receipts: m.receipts.map((r) => ({
        userId: r.userId,
        deliveredAt: r.deliveredAt,
        readAt: r.readAt,
      })),
    }));
  }
}

