import { eq, and } from 'drizzle-orm';
import { Server } from 'socket.io';
import { db as defaultDb } from '../db/index';
import {
  accounts,
  conversations,
  conversationMembers,
  messages,
  messageReceipts,
  users,
} from '../db/schema/index';
import { PresenceService } from './presence.service';
import { WS_EVENTS } from '../ws/events';
import {
  FileRelayInitDto,
  FileRelayChunkDto,
  FileRelayCompleteDto,
  validateFileLimits,
  validateOfflineRecipient,
  PlanType,
} from '@/shared';

export interface FileRelaySession {
  transferId: string;
  accountId: string;
  conversationId: string;
  senderId: string;
  senderSocketId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  chunksRelayed: number;
  recipientUserIds: string[];
  totalRecipientsCount: number;
  isGroup: boolean;
  createdAt: number;
}

export class FileRelayService {
  private sessions = new Map<string, FileRelaySession>();

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
   * Initializes a streaming file relay session in memory for the Free plan (zero disk/heap persistence)
   */
  async initRelay(
    accountId: string,
    senderId: string,
    senderSocketId: string,
    dto: FileRelayInitDto
  ): Promise<{
    success: boolean;
    transferId: string;
    recipientCount: number;
    totalRecipientsCount: number;
    recipientUserIds: string[];
    deliverySummary: string;
  }> {
    // 1. Check account status & plan limits
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    if (account.status === 'suspended') {
      throw new Error('Esta organização está suspensa.');
    }

    if (account.status === 'over_quota') {
      throw new Error('A organização atingiu o limite do plano e está em modo somente leitura.');
    }

    const plan = account.plan as PlanType;

    // Validate limits
    const validation = validateFileLimits(
      plan,
      [{ name: dto.fileName, size: dto.fileSize, mimeType: dto.mimeType }],
      { requireFiles: true }
    );

    if (!validation.valid) {
      const error: any = new Error(validation.error || 'Arquivo não atende aos limites do plano.');
      error.code = validation.code;
      error.suggestCloudShare = validation.suggestCloudShare;
      throw error;
    }

    // 2. Check conversation membership & status
    const conversation = await this.db.query.conversations.findFirst({
      where: and(eq(conversations.id, dto.conversationId), eq(conversations.accountId, accountId)),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada.');
    }

    if (conversation.status === 'archived_readonly') {
      throw new Error('Esta conversa expirou e está em modo somente leitura.');
    }

    const members = conversation.members as any[];
    const senderMember = members.find((m) => m.userId === senderId);
    if (!senderMember) {
      throw new Error('Você não é membro desta conversa.');
    }

    const senderUser = await this.db.query.users.findFirst({
      where: eq(users.id, senderId),
    });
    const senderName = senderUser?.name || 'Membro da equipe';

    // 3. Find other members and check online presence
    const otherMembers = members.filter((m) => m.userId !== senderId);

    if (otherMembers.length === 0) {
      throw new Error('A conversa não possui outros participantes.');
    }

    const onlineRecipientIds: string[] = [];

    for (const member of otherMembers) {
      const isOnline = await this.presenceService.isUserOnline(member.userId);
      if (isOnline) {
        onlineRecipientIds.push(member.userId);
      }
    }

    // Free plan requires recipient to be online
    if (conversation.type === 'direct') {
      const recipientMember = otherMembers[0];
      const recipientName = recipientMember?.user?.name || 'O destinatário';
      const isRecipientOnline = onlineRecipientIds.includes(recipientMember.userId);

      const recipientCheck = validateOfflineRecipient(plan, isRecipientOnline, recipientName);
      if (!recipientCheck.allowed) {
        const err: any = new Error(recipientCheck.error);
        err.code = recipientCheck.code;
        throw err;
      }
    } else {
      // Group conversation in Free plan: at least 1 member must be online to receive streaming relay
      if (onlineRecipientIds.length === 0) {
        const recipientCheck = validateOfflineRecipient(plan, false, 'Nenhum membro');
        const err: any = new Error(
          'Nenhum participante da conversa está online para receber o arquivo no plano Free.'
        );
        err.code = recipientCheck.code;
        throw err;
      }
    }

    // 4. Create relay session
    const isGroup = conversation.type !== 'direct';
    const totalRecipientsCount = otherMembers.length;

    const session: FileRelaySession = {
      transferId: dto.transferId,
      accountId,
      conversationId: dto.conversationId,
      senderId,
      senderSocketId,
      senderName,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType || 'application/octet-stream',
      totalChunks: dto.totalChunks,
      chunkSize: dto.chunkSize,
      chunksRelayed: 0,
      recipientUserIds: onlineRecipientIds,
      totalRecipientsCount,
      isGroup,
      createdAt: Date.now(),
    };

    this.sessions.set(dto.transferId, session);

    // 5. Notify online recipients about incoming file streaming relay
    if (this.io) {
      const incomingPayload = {
        transferId: dto.transferId,
        conversationId: dto.conversationId,
        senderId,
        senderName,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: session.mimeType,
        totalChunks: dto.totalChunks,
        chunkSize: dto.chunkSize,
        deliveredToCount: onlineRecipientIds.length,
        totalRecipientsCount,
        deliverySummary: `Entregue a ${onlineRecipientIds.length} de ${totalRecipientsCount}`,
      };

      for (const recipientId of onlineRecipientIds) {
        this.io.to(`user:${recipientId}`).emit(WS_EVENTS.FILE_RELAY_INCOMING, incomingPayload);
        this.io.to(`user:${recipientId}`).emit(WS_EVENTS.FILE_RELAY_INIT, incomingPayload);
      }
    }

    return {
      success: true,
      transferId: dto.transferId,
      recipientCount: onlineRecipientIds.length,
      totalRecipientsCount,
      recipientUserIds: onlineRecipientIds,
      deliverySummary: `Entregue a ${onlineRecipientIds.length} de ${totalRecipientsCount}`,
    };
  }

  /**
   * Forwards a single binary chunk directly to online recipients (zero disk/heap retention)
   */
  async relayChunk(
    senderId: string,
    dto: FileRelayChunkDto
  ): Promise<{ success: boolean; chunkIndex: number }> {
    const session = this.sessions.get(dto.transferId);

    if (!session) {
      throw new Error('Sessão de transferência de arquivo não encontrada ou expirada.');
    }

    if (session.senderId !== senderId) {
      throw new Error('Acesso negado à sessão de transferência.');
    }

    session.chunksRelayed++;

    // Forward chunk directly to recipients with zero persistence
    if (this.io) {
      const chunkPayload = {
        transferId: dto.transferId,
        chunkIndex: dto.chunkIndex,
        data: dto.data,
      };

      for (const recipientId of session.recipientUserIds) {
        this.io.to(`user:${recipientId}`).emit(WS_EVENTS.FILE_RELAY_CHUNK, chunkPayload);
      }
    }

    return {
      success: true,
      chunkIndex: dto.chunkIndex,
    };
  }

  /**
   * Completes the relay session, notifies recipients and persists the file message metadata in database
   */
  async completeRelay(
    senderId: string,
    dto: FileRelayCompleteDto
  ): Promise<{ success: boolean; messageId: string; deliverySummary: string }> {
    const session = this.sessions.get(dto.transferId);

    if (!session) {
      throw new Error('Sessão de transferência não encontrada.');
    }

    if (session.senderId !== senderId) {
      throw new Error('Acesso negado à sessão de transferência.');
    }

    const deliverySummary = `Entregue a ${session.recipientUserIds.length} de ${session.totalRecipientsCount}`;

    // 1. Notify recipients that streaming transfer finished
    if (this.io) {
      for (const recipientId of session.recipientUserIds) {
        this.io.to(`user:${recipientId}`).emit(WS_EVENTS.FILE_RELAY_COMPLETE, {
          transferId: dto.transferId,
          fileName: session.fileName,
          fileSize: session.fileSize,
          deliveredToCount: session.recipientUserIds.length,
          totalRecipientsCount: session.totalRecipientsCount,
          deliverySummary,
        });
      }
    }

    // 2. Persist message record in database
    const now = new Date();
    const [newMessage] = await this.db
      .insert(messages)
      .values({
        conversationId: session.conversationId,
        senderId: session.senderId,
        type: 'file',
        content: session.fileName,
        metadata: {
          fileName: session.fileName,
          fileSize: session.fileSize,
          mimeType: session.mimeType,
          transferMethod: 'relay_memory',
          deliveredToCount: session.recipientUserIds.length,
          totalRecipientsCount: session.totalRecipientsCount,
          deliveredToUserIds: session.recipientUserIds,
          deliverySummary,
          isGroup: session.isGroup,
        },
      })
      .returning();

    // 3. Create delivery receipts for recipients who received the file
    const receiptsToInsert = session.recipientUserIds.map((userId) => ({
      messageId: newMessage.id,
      userId,
      deliveredAt: now,
      readAt: null,
    }));

    if (receiptsToInsert.length > 0) {
      await this.db.insert(messageReceipts).values(receiptsToInsert);
    }

    // 4. Broadcast standard message:new event to keep chat history synced
    if (this.io) {
      const formattedMessage = {
        id: newMessage.id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        type: newMessage.type,
        content: newMessage.content,
        metadata: newMessage.metadata,
        createdAt: newMessage.createdAt,
        sender: {
          id: session.senderId,
          name: session.senderName,
          avatarUrl: null,
        },
        receipts: receiptsToInsert,
      };

      this.io.to(`conv:${session.conversationId}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);

      for (const recipientId of session.recipientUserIds) {
        this.io.to(`user:${recipientId}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);
      }
    }

    // 5. Clean up session from memory
    this.sessions.delete(dto.transferId);

    return {
      success: true,
      messageId: newMessage.id,
      deliverySummary,
    };
  }

  /**
   * Cancels or errors out a relay session and alerts participants
   */
  cancelOrErrorRelay(transferId: string, senderId?: string, reason?: string) {
    const session = this.sessions.get(transferId);
    if (!session) return;

    if (this.io) {
      const payload = {
        transferId,
        reason: reason || 'Transferência de arquivo interrompida.',
      };

      if (session.senderSocketId) {
        this.io.to(session.senderSocketId).emit(WS_EVENTS.FILE_RELAY_ERROR, payload);
      }

      for (const recipientId of session.recipientUserIds) {
        this.io.to(`user:${recipientId}`).emit(WS_EVENTS.FILE_RELAY_ERROR, payload);
      }
    }

    this.sessions.delete(transferId);
  }

  getSession(transferId: string): FileRelaySession | undefined {
    return this.sessions.get(transferId);
  }

  getActiveSessionsCount(): number {
    return this.sessions.size;
  }
}

