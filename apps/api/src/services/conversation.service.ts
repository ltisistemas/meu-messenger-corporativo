import { eq, and, inArray, desc } from 'drizzle-orm';
import { Server } from 'socket.io';
import { db as defaultDb } from '../db/index';
import { conversations, conversationMembers, users, messages } from '../db/schema/index';
import { CreateGroupConversationDto } from '@corpchat/shared';
import { GroupExpirationService } from '../jobs/group-expiration.job';
import { WS_EVENTS } from '../ws/events';

export interface FormattedMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    lastSeenAt: Date | null;
  };
}

export interface FormattedConversation {
  id: string;
  accountId: string;
  type: string;
  title: string | null;
  isTemporary: boolean;
  expiresAt: Date | null;
  status: string;
  createdAt: Date;
  members: FormattedMember[];
  lastMessage: any;
}

export class ConversationService {
  constructor(
    private db = defaultDb,
    private groupExpirationService?: GroupExpirationService,
    private io?: Server
  ) {}

  setIoServer(io: Server) {
    this.io = io;
    if (this.groupExpirationService) {
      this.groupExpirationService.setIoServer(io);
    }
  }

  /**
   * Finds or creates a 1:1 direct conversation between two users in the same account
   */
  async getOrCreateDirectConversation(
    accountId: string,
    userId: string,
    targetUserId: string
  ): Promise<FormattedConversation> {
    if (userId === targetUserId) {
      throw new Error('Não é possível criar uma conversa direta consigo mesmo.');
    }

    // 1. Verify target user exists and belongs to the SAME account (multi-tenant isolation)
    const targetUser = await this.db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.accountId, accountId)),
    });

    if (!targetUser || targetUser.status !== 'active') {
      throw new Error('Usuário destinatário não encontrado ou inativo nesta organização.');
    }

    // 2. Find if a direct conversation already exists between these 2 users in this account
    const userConversations = await this.db.query.conversationMembers.findMany({
      where: eq(conversationMembers.userId, userId),
      with: {
        conversation: {
          with: {
            members: {
              with: {
                user: true,
              },
            },
          },
        },
      },
    });

    const existing = userConversations.find(
      (m) =>
        m.conversation.accountId === accountId &&
        m.conversation.type === 'direct' &&
        m.conversation.members.some((member) => member.userId === targetUserId)
    );

    if (existing) {
      return this.formatConversation(existing.conversation, userId);
    }

    // 3. Create new direct conversation and add both members
    const [newConv] = await this.db
      .insert(conversations)
      .values({
        accountId,
        type: 'direct',
        status: 'active',
      })
      .returning();

    await this.db.insert(conversationMembers).values([
      { conversationId: newConv.id, userId, role: 'member' },
      { conversationId: newConv.id, userId: targetUserId, role: 'member' },
    ]);

    const created = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, newConv.id),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    return this.formatConversation(created!, userId);
  }

  /**
   * Creates a group conversation (fixed or temporary) with initial members in the account (T-08 / T-24)
   */
  async createGroup(
    accountId: string,
    creatorId: string,
    dto: CreateGroupConversationDto
  ): Promise<FormattedConversation> {
    const rawMemberIds = dto.memberUserIds || [];
    const memberIds = Array.from(new Set([creatorId, ...rawMemberIds]));

    // 1. Verify all member IDs belong to this account
    const validUsers = await this.db.query.users.findMany({
      where: and(inArray(users.id, memberIds), eq(users.accountId, accountId)),
    });

    if (validUsers.length !== memberIds.length) {
      throw new Error('Um ou mais membros selecionados não pertencem a esta organização.');
    }

    // 2. Handle expiration for temporary groups
    const isTemporary = Boolean(dto.isTemporary);
    let expiresAt: Date | null = null;

    if (isTemporary) {
      if (dto.expiresAt) {
        expiresAt = new Date(dto.expiresAt);
      } else if (dto.retentionHours) {
        expiresAt = new Date(Date.now() + dto.retentionHours * 60 * 60 * 1000);
      } else {
        // Default to 24 hours if unspecified
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      if (expiresAt.getTime() <= Date.now()) {
        throw new Error('A data de expiração do grupo temporário deve ser no futuro.');
      }
    }

    // 3. Insert conversation
    const [newConv] = await this.db
      .insert(conversations)
      .values({
        accountId,
        type: 'group',
        title: dto.title.trim(),
        isTemporary,
        expiresAt,
        status: 'active',
      })
      .returning();

    // 4. Insert members (creator is admin, others are members)
    const membersToInsert = memberIds.map((uid) => ({
      conversationId: newConv.id,
      userId: uid,
      role: uid === creatorId ? 'admin' : 'member',
    }));

    await this.db.insert(conversationMembers).values(membersToInsert);

    // 5. If temporary, schedule delayed expiration job via BullMQ
    if (isTemporary && expiresAt && this.groupExpirationService) {
      await this.groupExpirationService.scheduleGroupExpiration(newConv.id, expiresAt);
    }

    const created = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, newConv.id),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    return this.formatConversation(created!, creatorId);
  }

  /**
   * Lists all conversations for a user strictly within their account
   */
  async listUserConversations(accountId: string, userId: string): Promise<FormattedConversation[]> {
    const memberships = await this.db.query.conversationMembers.findMany({
      where: eq(conversationMembers.userId, userId),
      with: {
        conversation: {
          with: {
            members: {
              with: {
                user: true,
              },
            },
            messages: {
              limit: 1,
              orderBy: [desc(messages.createdAt)],
            },
          },
        },
      },
    });

    const now = new Date();

    return memberships
      .filter((m) => m.conversation.accountId === accountId)
      .map((m) => {
        const conv = m.conversation;
        // On-the-fly expiration check if job hasn't run yet
        if (
          conv.isTemporary &&
          conv.expiresAt &&
          new Date(conv.expiresAt) <= now &&
          conv.status === 'active'
        ) {
          conv.status = 'archived_readonly';
        }
        return this.formatConversation(conv, userId);
      });
  }

  /**
   * Gets conversation details ensuring account isolation, membership and fresh expiration status
   */
  async getConversationDetails(
    accountId: string,
    userId: string,
    conversationId: string
  ): Promise<FormattedConversation> {
    const conversation = await this.db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.accountId, accountId)),
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

    const isMember = (conversation.members as any[]).some((m: any) => m.userId === userId);
    if (!isMember) {
      throw new Error('Acesso negado a esta conversa.');
    }

    // Check if temporary group has expired
    if (
      conversation.isTemporary &&
      conversation.expiresAt &&
      new Date(conversation.expiresAt) <= new Date() &&
      conversation.status === 'active'
    ) {
      if (this.groupExpirationService) {
        await this.groupExpirationService.expireSingleGroup(conversationId);
      }
      conversation.status = 'archived_readonly';
    }

    return this.formatConversation(conversation, userId);
  }

  /**
   * Adds new members to a group
   */
  async addMembersToGroup(
    accountId: string,
    callerId: string,
    callerRole: string,
    conversationId: string,
    userIds: string[]
  ): Promise<FormattedConversation> {
    const conversation = await this.getConversationDetails(accountId, callerId, conversationId);

    if (conversation.type !== 'group') {
      throw new Error('Apenas conversas em grupo permitem adicionar membros.');
    }

    if (conversation.status === 'archived_readonly') {
      throw new Error('Este grupo temporário expirou e não permite novos membros.');
    }

    // Check caller permission: must be group admin or account owner/admin
    const callerMembership = conversation.members.find(
      (m: FormattedMember) => m.userId === callerId
    );
    const isGroupAdmin = callerMembership?.role === 'admin';
    const isAccountAdmin = callerRole === 'owner' || callerRole === 'admin';

    if (!isGroupAdmin && !isAccountAdmin) {
      throw new Error('Apenas administradores do grupo ou da organização podem adicionar membros.');
    }

    // Verify users belong to account
    const validUsers = await this.db.query.users.findMany({
      where: and(inArray(users.id, userIds), eq(users.accountId, accountId)),
    });

    if (validUsers.length !== userIds.length) {
      throw new Error('Um ou mais usuários informados não pertencem a esta organização.');
    }

    const existingMemberIds = new Set(conversation.members.map((m: FormattedMember) => m.userId));
    const newMembers = userIds.filter((id) => !existingMemberIds.has(id));

    if (newMembers.length === 0) {
      return conversation;
    }

    await this.db.insert(conversationMembers).values(
      newMembers.map((uid) => ({
        conversationId,
        userId: uid,
        role: 'member',
      }))
    );

    return this.getConversationDetails(accountId, callerId, conversationId);
  }

  /**
   * Removes a member from a group or allows a user to leave
   */
  async removeMemberFromGroup(
    accountId: string,
    callerId: string,
    callerRole: string,
    conversationId: string,
    targetUserId: string
  ) {
    const conversation = await this.getConversationDetails(accountId, callerId, conversationId);

    if (conversation.type !== 'group') {
      throw new Error('Apenas conversas em grupo permitem gerenciar membros.');
    }

    const isSelf = callerId === targetUserId;
    const callerMembership = conversation.members.find(
      (m: FormattedMember) => m.userId === callerId
    );
    const isGroupAdmin = callerMembership?.role === 'admin';
    const isAccountAdmin = callerRole === 'owner' || callerRole === 'admin';

    if (!isSelf && !isGroupAdmin && !isAccountAdmin) {
      throw new Error('Apenas administradores podem remover outros membros do grupo.');
    }

    await this.db
      .delete(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, targetUserId)
        )
      );

    return { success: true };
  }

  /**
   * Deletes a group permanently (fixed or expired temporary group) by Admin/Owner (T-24)
   */
  async deleteGroup(
    accountId: string,
    callerId: string,
    callerRole: string,
    conversationId: string
  ) {
    const conversation = await this.getConversationDetails(accountId, callerId, conversationId);

    if (conversation.type !== 'group') {
      throw new Error('Apenas conversas em grupo podem ser excluídas.');
    }

    const callerMembership = conversation.members.find(
      (m: FormattedMember) => m.userId === callerId
    );
    const isGroupAdmin = callerMembership?.role === 'admin';
    const isAccountAdmin = callerRole === 'owner' || callerRole === 'admin';

    if (!isGroupAdmin && !isAccountAdmin) {
      throw new Error('Apenas administradores do grupo ou da organização podem excluir o grupo.');
    }

    await this.db
      .delete(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.accountId, accountId)));

    if (this.io) {
      this.io.to(`conversation:${conversationId}`).emit(WS_EVENTS.CONVERSATION_DELETED, {
        conversationId,
        accountId,
      });
    }

    return { success: true, conversationId };
  }

  private formatConversation(conv: any, currentUserId: string): FormattedConversation {
    const members: FormattedMember[] = (conv.members || []).map((m: any) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user
        ? {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl || null,
            lastSeenAt: m.user.lastSeenAt || null,
          }
        : undefined,
    }));

    // For direct conversations, dynamic title is the other participant's name
    let title = conv.title;
    if (conv.type === 'direct') {
      const otherMember = members.find((m: FormattedMember) => m.userId !== currentUserId);
      title = otherMember?.user?.name || 'Conversa Direta';
    }

    return {
      id: conv.id,
      accountId: conv.accountId,
      type: conv.type,
      title,
      isTemporary: conv.isTemporary,
      expiresAt: conv.expiresAt,
      status: conv.status,
      createdAt: conv.createdAt,
      members,
      lastMessage: conv.messages?.[0] || null,
    };
  }
}
