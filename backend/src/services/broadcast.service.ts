import { eq, and, inArray, desc } from 'drizzle-orm';
import { Server } from 'socket.io';
import { db as defaultDb } from '../db/index';
import {
  conversations,
  conversationMembers,
  messages,
  messageReceipts,
  users,
  accounts,
} from '../db/schema/index';
import { can, PlanType, SendBroadcastDto, BroadcastReportResponse } from '@/shared';
import { PresenceService } from './presence.service';
import { WS_EVENTS } from '../ws/events';

export class BroadcastService {
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
   * Retrieves or initializes the account-wide "Comunicados" broadcast channel (T-25)
   */
  async getOrCreateBroadcastConversation(accountId: string, requesterId: string) {
    // 1. Verify account and plan capabilities (Pro/Enterprise only)
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    const plan = (account.plan || 'free') as PlanType;
    if (!can(plan, 'broadcast_list')) {
      throw new Error(
        'O recurso de lista de transmissão não está disponível no plano Free. Faça upgrade para o plano Pro ou Enterprise.'
      );
    }

    // 2. Find existing broadcast channel for this account
    let broadcastConv = await this.db.query.conversations.findFirst({
      where: and(eq(conversations.accountId, accountId), eq(conversations.type, 'broadcast')),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    // 3. Fetch all active users in the account
    const allActiveUsers = await this.db.query.users.findMany({
      where: and(eq(users.accountId, accountId), eq(users.status, 'active')),
    });

    if (!broadcastConv) {
      // Create dedicated "Comunicados" channel
      const [newConv] = await this.db
        .insert(conversations)
        .values({
          accountId,
          type: 'broadcast',
          title: 'Comunicados',
          isTemporary: false,
          status: 'active',
        })
        .returning();

      // Enroll all active account users
      if (allActiveUsers.length > 0) {
        await this.db.insert(conversationMembers).values(
          allActiveUsers.map((u) => ({
            conversationId: newConv.id,
            userId: u.id,
            role: u.id === requesterId ? 'admin' : 'member',
          }))
        );
      }

      broadcastConv = await this.db.query.conversations.findFirst({
        where: eq(conversations.id, newConv.id),
        with: {
          members: {
            with: {
              user: true,
            },
          },
        },
      });
    } else {
      // Sync any new active users who joined after channel creation
      const existingUserIds = new Set((broadcastConv.members as any[]).map((m: any) => m.userId));
      const missingUsers = allActiveUsers.filter((u) => !existingUserIds.has(u.id));

      if (missingUsers.length > 0) {
        await this.db.insert(conversationMembers).values(
          missingUsers.map((u) => ({
            conversationId: broadcastConv!.id,
            userId: u.id,
            role: 'member',
          }))
        );

        broadcastConv = await this.db.query.conversations.findFirst({
          where: eq(conversations.id, broadcastConv.id),
          with: {
            members: {
              with: {
                user: true,
              },
            },
          },
        });
      }
    }

    return broadcastConv!;
  }

  /**
   * Broadcasts a message to all active users in the organization (Admin/Owner Pro/Enterprise - T-25)
   */
  async sendBroadcast(
    accountId: string,
    senderId: string,
    senderRole: string,
    dto: SendBroadcastDto
  ) {
    // 1. Verify caller permissions (must be admin or owner)
    if (senderRole !== 'owner' && senderRole !== 'admin') {
      throw new Error('Apenas administradores podem enviar comunicados via lista de transmissão.');
    }

    // 2. Verify account and plan feature
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account || account.status === 'suspended') {
      throw new Error('Esta organização está suspensa.');
    }

    if (account.status === 'over_quota') {
      throw new Error('A organização atingiu o limite do plano e está em modo somente leitura.');
    }

    const plan = (account.plan || 'free') as PlanType;
    if (!can(plan, 'broadcast_list')) {
      throw new Error(
        'O recurso de lista de transmissão não está disponível no plano Free. Faça upgrade para o plano Pro ou Enterprise.'
      );
    }

    // 3. Get or initialize "Comunicados" channel
    const broadcastConv = await this.getOrCreateBroadcastConversation(accountId, senderId);

    // 4. Insert broadcast message
    const [newMessage] = await this.db
      .insert(messages)
      .values({
        conversationId: broadcastConv.id,
        senderId,
        type: dto.attachmentUrl ? 'file' : 'text',
        content: dto.content.trim(),
        metadata: {
          title: dto.title || 'Comunicado Geral',
          isBroadcast: true,
          attachmentUrl: dto.attachmentUrl || null,
          attachmentName: dto.attachmentName || null,
          attachmentSize: dto.attachmentSize || null,
        },
      })
      .returning();

    // 5. Fetch all active users in account (excluding the sender)
    const recipients = await this.db.query.users.findMany({
      where: and(eq(users.accountId, accountId), eq(users.status, 'active')),
    });
    const targetRecipients = recipients.filter((u) => u.id !== senderId);

    const now = new Date();
    const receiptsToInsert: any[] = [];
    const onlineRecipientIds: string[] = [];

    for (const recipient of targetRecipients) {
      const isOnline = await this.presenceService.isUserOnline(recipient.id);
      if (isOnline) {
        receiptsToInsert.push({
          messageId: newMessage.id,
          userId: recipient.id,
          deliveredAt: now,
          readAt: null,
        });
        onlineRecipientIds.push(recipient.id);
      } else {
        receiptsToInsert.push({
          messageId: newMessage.id,
          userId: recipient.id,
          deliveredAt: null,
          readAt: null,
        });
      }
    }

    if (receiptsToInsert.length > 0) {
      await this.db.insert(messageReceipts).values(receiptsToInsert);
    }

    // 6. Fetch sender details
    const sender = await this.db.query.users.findFirst({
      where: eq(users.id, senderId),
    });

    const formattedMessage = {
      id: newMessage.id,
      conversationId: newMessage.conversationId,
      senderId: newMessage.senderId,
      type: newMessage.type,
      content: newMessage.content,
      metadata: newMessage.metadata,
      createdAt: newMessage.createdAt,
      sender: sender
        ? {
            id: sender.id,
            name: sender.name,
            email: sender.email,
            avatarUrl: sender.avatarUrl,
          }
        : undefined,
      receipts: receiptsToInsert,
    };

    // 7. Real-time WebSocket broadcasts
    if (this.io) {
      try {
        // Room for the "Comunicados" channel
        this.io.to(`conv:${broadcastConv.id}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);
        this.io
          .to(`conversation:${broadcastConv.id}`)
          .emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);

        // Room for the entire organization
        this.io.to(`account:${accountId}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);

        // Direct notifications to online recipients for badge updates
        for (const uid of onlineRecipientIds) {
          this.io.to(`user:${uid}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);
        }
      } catch (_) {}
    }

    return {
      message: formattedMessage,
      summary: {
        totalRecipients: targetRecipients.length,
        onlineDeliveredCount: onlineRecipientIds.length,
        offlineQueuedCount: targetRecipients.length - onlineRecipientIds.length,
      },
    };
  }

  /**
   * Generates delivery and read report for a broadcast message (Admin/Owner only - T-25)
   */
  async getBroadcastReport(
    accountId: string,
    userId: string,
    userRole: string,
    messageId: string
  ): Promise<BroadcastReportResponse> {
    // 1. Verify caller permission (must be admin or owner)
    if (userRole !== 'owner' && userRole !== 'admin') {
      throw new Error('Apenas administradores podem visualizar o relatório de transmissão.');
    }

    // 2. Fetch message and verify it belongs to this account's broadcast channel
    const message = await this.db.query.messages.findFirst({
      where: eq(messages.id, messageId),
      with: {
        sender: true,
        conversation: true,
      },
    });

    if (!message) {
      throw new Error('Mensagem de transmissão não encontrada.');
    }

    if (message.conversation.accountId !== accountId || message.conversation.type !== 'broadcast') {
      throw new Error('Esta mensagem não é um comunicado de transmissão desta organização.');
    }

    // 3. Fetch receipts with recipient user details
    const receipts = await this.db.query.messageReceipts.findMany({
      where: eq(messageReceipts.messageId, messageId),
      with: {
        user: true,
      },
    });

    const totalRecipients = receipts.length;
    let deliveredCount = 0;
    let readCount = 0;

    const formattedRecipients = receipts.map((r: any) => {
      const isRead = Boolean(r.readAt);
      const isDelivered = Boolean(r.deliveredAt) || isRead;

      if (isRead) readCount++;
      if (isDelivered) deliveredCount++;

      let status: 'sent' | 'delivered' | 'read' = 'sent';
      if (isRead) status = 'read';
      else if (isDelivered) status = 'delivered';

      return {
        userId: r.userId,
        name: r.user?.name || 'Usuário',
        email: r.user?.email || '',
        avatarUrl: r.user?.avatarUrl || null,
        status,
        deliveredAt: r.deliveredAt ? new Date(r.deliveredAt).toISOString() : null,
        readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
      };
    });

    const pendingCount = totalRecipients - deliveredCount;
    const deliveryRatePercent =
      totalRecipients > 0 ? Math.round((deliveredCount / totalRecipients) * 100) : 100;
    const readRatePercent =
      totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 100;

    return {
      messageId: message.id,
      conversationId: message.conversationId,
      content: message.content,
      sentAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender?.id || userId,
        name: message.sender?.name || 'Administrador',
        email: message.sender?.email || '',
      },
      summary: {
        totalRecipients,
        deliveredCount,
        readCount,
        pendingCount,
        deliveryRatePercent,
        readRatePercent,
      },
      recipients: formattedRecipients,
    };
  }
}

