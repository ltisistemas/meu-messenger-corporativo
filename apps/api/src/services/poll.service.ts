import { eq, and, inArray } from 'drizzle-orm';
import { Server } from 'socket.io';
import { db as defaultDb } from '../db/index';
import {
  polls,
  pollOptions,
  pollVotes,
  conversations,
  conversationMembers,
  messages,
  messageReceipts,
  users,
  accounts,
} from '../db/schema/index';
import {
  can,
  PlanType,
  CreatePollDto,
  CreatePollInput,
  VotePollDto,
  PollDetailsResponse,
  PollOptionResult,
} from '@corpchat/shared';
import { PresenceService } from './presence.service';
import { WS_EVENTS } from '../ws/events';

export class PollService {
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
   * Creates a new poll in a conversation (Pro/Enterprise only - T-26)
   */
  async createPoll(
    accountId: string,
    creatorId: string,
    rawDto: CreatePollInput | CreatePollDto
  ): Promise<PollDetailsResponse> {
    const dto: CreatePollDto = {
      allowMultiple: false,
      isAnonymous: false,
      ...rawDto,
    };
    // 1. Plan capability validation (Pro/Enterprise only)
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
    if (!can(plan, 'polls')) {
      throw new Error(
        'O recurso de enquetes não está disponível no plano Free. Faça upgrade para o plano Pro ou Enterprise.'
      );
    }

    // 2. Verify conversation membership and status
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

    const isMember = (conversation.members as any[]).some((m: any) => m.userId === creatorId);
    if (!isMember) {
      throw new Error('Você não é membro desta conversa.');
    }

    // 3. Expiration calculation
    let expiresAt: Date | null = null;
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
    } else if (dto.expiresInHours) {
      expiresAt = new Date(Date.now() + dto.expiresInHours * 3600 * 1000);
    }

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new Error('O prazo de votação da enquete deve ser no futuro.');
    }

    // 4. Create chat message of type 'poll'
    const [newMessage] = await this.db
      .insert(messages)
      .values({
        conversationId: dto.conversationId,
        senderId: creatorId,
        type: 'poll',
        content: dto.question.trim(),
        metadata: {
          pollQuestion: dto.question.trim(),
          allowMultiple: Boolean(dto.allowMultiple),
          isAnonymous: Boolean(dto.isAnonymous),
          optionsCount: dto.options.length,
        },
      })
      .returning();

    // 5. Insert poll record
    const [newPoll] = await this.db
      .insert(polls)
      .values({
        conversationId: dto.conversationId,
        messageId: newMessage.id,
        creatorId,
        question: dto.question.trim(),
        allowMultiple: Boolean(dto.allowMultiple),
        isAnonymous: Boolean(dto.isAnonymous),
        expiresAt,
        status: 'active',
      })
      .returning();

    // 6. Insert poll options
    const optionsToInsert = dto.options.map((optText, index) => ({
      pollId: newPoll.id,
      text: optText.trim(),
      orderIndex: index,
    }));

    await this.db.insert(pollOptions).values(optionsToInsert);

    // 7. Insert message receipts for conversation members
    const now = new Date();
    const otherMembers = (conversation.members as any[]).filter((m: any) => m.userId !== creatorId);
    const receiptsToInsert: any[] = [];
    const onlineRecipientIds: string[] = [];

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
      }
    }

    if (receiptsToInsert.length > 0) {
      await this.db.insert(messageReceipts).values(receiptsToInsert);
    }

    const pollDetails = await this.getPollDetails(accountId, creatorId, newPoll.id);

    // 8. WebSocket broadcasts
    if (this.io) {
      try {
        const creatorUser = await this.db.query.users.findFirst({
          where: eq(users.id, creatorId),
        });

        const formattedMessage = {
          id: newMessage.id,
          conversationId: newMessage.conversationId,
          senderId: newMessage.senderId,
          type: 'poll',
          content: newMessage.content,
          metadata: {
            ...((newMessage.metadata as Record<string, any>) || {}),
            poll: pollDetails,
          },
          createdAt: newMessage.createdAt,
          sender: creatorUser
            ? {
                id: creatorUser.id,
                name: creatorUser.name,
                avatarUrl: creatorUser.avatarUrl,
              }
            : undefined,
          receipts: receiptsToInsert,
        };

        this.io.to(`conv:${dto.conversationId}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);
        this.io
          .to(`conversation:${dto.conversationId}`)
          .emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);
        this.io.to(`conversation:${dto.conversationId}`).emit(WS_EVENTS.POLL_NEW, pollDetails);

        for (const uid of onlineRecipientIds) {
          this.io.to(`user:${uid}`).emit(WS_EVENTS.MESSAGE_NEW, formattedMessage);
        }
      } catch (_) {}
    }

    return pollDetails;
  }

  /**
   * Casts or changes vote on a poll (T-26)
   */
  async votePoll(
    accountId: string,
    userId: string,
    pollId: string,
    dto: VotePollDto
  ): Promise<PollDetailsResponse> {
    // 1. Fetch poll with conversation
    const poll = await this.db.query.polls.findFirst({
      where: eq(polls.id, pollId),
      with: {
        conversation: {
          with: {
            members: true,
          },
        },
        options: true,
      },
    });

    if (!poll) {
      throw new Error('Enquete não encontrada.');
    }

    if (poll.conversation.accountId !== accountId) {
      throw new Error('Enquete não pertence a esta organização.');
    }

    const isMember = (poll.conversation.members as any[]).some((m: any) => m.userId === userId);
    if (!isMember) {
      throw new Error('Você não é membro desta conversa.');
    }

    // 2. Check poll active status & deadline
    const isExpired =
      poll.status === 'closed' ||
      (Boolean(poll.expiresAt) && new Date(poll.expiresAt!) <= new Date());

    if (isExpired) {
      throw new Error('Esta enquete já está encerrada e não aceita novos votos.');
    }

    // 3. Option validity check
    const validOptionIds = new Set((poll.options as any[]).map((o: any) => o.id));
    const requestedOptionIds = Array.from(new Set(dto.optionIds));

    for (const optId of requestedOptionIds) {
      if (!validOptionIds.has(optId)) {
        throw new Error('Uma ou mais opções selecionadas não pertencem a esta enquete.');
      }
    }

    // 4. Single choice vs multiple choice enforcement
    if (!poll.allowMultiple && requestedOptionIds.length > 1) {
      throw new Error('Esta enquete permite apenas voto único.');
    }

    // 5. Replace existing votes by this user
    await this.db
      .delete(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));

    // 6. Insert new votes
    const votesToInsert = requestedOptionIds.map((optionId) => ({
      pollId,
      optionId,
      userId,
    }));

    if (votesToInsert.length > 0) {
      await this.db.insert(pollVotes).values(votesToInsert);
    }

    // 7. Get updated results
    const updatedDetails = await this.getPollDetails(accountId, userId, pollId);

    // 8. Broadcast real-time results
    if (this.io) {
      try {
        this.io
          .to(`conversation:${poll.conversationId}`)
          .emit(WS_EVENTS.POLL_UPDATED, updatedDetails);
        this.io.to(`conv:${poll.conversationId}`).emit(WS_EVENTS.POLL_UPDATED, updatedDetails);
      } catch (_) {}
    }

    return updatedDetails;
  }

  /**
   * Retrieves live poll details with percentage breakdown and anonymous/identified voter lists (T-26)
   */
  async getPollDetails(
    accountId: string,
    currentUserId: string,
    pollId: string
  ): Promise<PollDetailsResponse> {
    const poll = await this.db.query.polls.findFirst({
      where: eq(polls.id, pollId),
      with: {
        conversation: true,
        creator: true,
        options: {
          orderBy: (options, { asc }) => [asc(options.orderIndex)],
        },
        votes: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!poll) {
      throw new Error('Enquete não encontrada.');
    }

    if (poll.conversation.accountId !== accountId) {
      throw new Error('Acesso negado a esta enquete.');
    }

    const isExpired =
      poll.status === 'closed' ||
      (Boolean(poll.expiresAt) && new Date(poll.expiresAt!) <= new Date());
    const status: 'active' | 'closed' = isExpired ? 'closed' : 'active';

    const allVotes = (poll.votes as any[]) || [];
    const totalVotes = allVotes.length;
    const uniqueVoterIds = new Set(allVotes.map((v: any) => v.userId));
    const totalVotersCount = uniqueVoterIds.size;

    const userVotedOptionIds = allVotes
      .filter((v: any) => v.userId === currentUserId)
      .map((v: any) => v.optionId);
    const userHasVoted = userVotedOptionIds.length > 0;

    const optionsResults: PollOptionResult[] = (poll.options as any[]).map((opt: any) => {
      const votesForOption = allVotes.filter((v: any) => v.optionId === opt.id);
      const votesCount = votesForOption.length;
      const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
      const hasVoted = userVotedOptionIds.includes(opt.id);

      const voters = poll.isAnonymous
        ? undefined
        : votesForOption.map((v: any) => ({
            id: v.user?.id || v.userId,
            name: v.user?.name || 'Membro',
            avatarUrl: v.user?.avatarUrl || null,
          }));

      return {
        id: opt.id,
        text: opt.text,
        orderIndex: opt.orderIndex,
        votesCount,
        percentage,
        hasVoted,
        voters,
      };
    });

    return {
      id: poll.id,
      messageId: poll.messageId || null,
      conversationId: poll.conversationId,
      creatorId: poll.creatorId || null,
      creator: poll.creator
        ? {
            id: poll.creator.id,
            name: poll.creator.name,
          }
        : undefined,
      question: poll.question,
      allowMultiple: poll.allowMultiple,
      isAnonymous: poll.isAnonymous,
      expiresAt: poll.expiresAt ? new Date(poll.expiresAt).toISOString() : null,
      status,
      isExpired,
      totalVotes,
      totalVotersCount,
      userHasVoted,
      userVotedOptionIds,
      options: optionsResults,
      createdAt: poll.createdAt.toISOString(),
    };
  }

  /**
   * Manually closes a poll (Creator or Admin only - T-26)
   */
  async closePoll(
    accountId: string,
    userId: string,
    userRole: string,
    pollId: string
  ): Promise<PollDetailsResponse> {
    const poll = await this.db.query.polls.findFirst({
      where: eq(polls.id, pollId),
      with: {
        conversation: true,
      },
    });

    if (!poll) {
      throw new Error('Enquete não encontrada.');
    }

    if (poll.conversation.accountId !== accountId) {
      throw new Error('Enquete não pertence a esta organização.');
    }

    const isCreator = poll.creatorId === userId;
    const isAccountAdmin = userRole === 'owner' || userRole === 'admin';

    if (!isCreator && !isAccountAdmin) {
      throw new Error('Apenas o criador da enquete ou administradores podem encerrá-la.');
    }

    await this.db
      .update(polls)
      .set({
        status: 'closed',
        updatedAt: new Date(),
      })
      .where(eq(polls.id, pollId));

    const updatedDetails = await this.getPollDetails(accountId, userId, pollId);

    if (this.io) {
      try {
        this.io
          .to(`conversation:${poll.conversationId}`)
          .emit(WS_EVENTS.POLL_CLOSED, updatedDetails);
        this.io
          .to(`conversation:${poll.conversationId}`)
          .emit(WS_EVENTS.POLL_UPDATED, updatedDetails);
      } catch (_) {}
    }

    return updatedDetails;
  }
}
