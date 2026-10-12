import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateDirectConversationDtoSchema,
  CreateGroupConversationDtoSchema,
  AddMembersDtoSchema,
} from '@corpchat/shared';
import { ConversationService } from '../services/conversation.service';
import { GroupExpirationService } from '../jobs/group-expiration.job';

export interface ConversationRoutesOptions {
  conversationService?: ConversationService;
  groupExpirationService?: GroupExpirationService;
}

export const conversationRoutes: FastifyPluginAsync<ConversationRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const groupExpirationService =
    options.groupExpirationService || new GroupExpirationService();
  const conversationService =
    options.conversationService || new ConversationService(undefined, groupExpirationService);

  // Hook WebSocket server if available on Fastify instance
  fastify.addHook('onReady', async () => {
    if (fastify.io) {
      conversationService.setIoServer(fastify.io);
      groupExpirationService.setIoServer(fastify.io);
    }
  });

  // 1. GET /api/conversations - List user conversations
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const list = await conversationService.listUserConversations(accountId, userId);
      return reply.status(200).send({ conversations: list });
    }
  );

  // 2. POST /api/conversations/direct - Get or create direct 1:1 conversation
  fastify.post(
    '/direct',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const parseResult = CreateDirectConversationDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
        });
      }

      try {
        const conversation = await conversationService.getOrCreateDirectConversation(
          accountId,
          userId,
          parseResult.data.targetUserId
        );
        return reply.status(200).send(conversation);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao iniciar conversa direta.',
        });
      }
    }
  );

  // 3. POST /api/conversations/group - Create a group conversation (fixed or temporary - T-24)
  fastify.post(
    '/group',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const parseResult = CreateGroupConversationDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
        });
      }

      try {
        const conversation = await conversationService.createGroup(
          accountId,
          userId,
          parseResult.data
        );
        return reply.status(201).send(conversation);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao criar grupo.',
        });
      }
    }
  );

  // 4. POST /api/conversations/sweep-expired - Sweep all expired temporary groups (T-24)
  fastify.post(
    '/sweep-expired',
    { preHandler: [fastify.authenticate] },
    async (_request, reply) => {
      try {
        const result = await groupExpirationService.sweepExpiredGroups();
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message || 'Falha ao executar varredura de grupos expirados.',
        });
      }
    }
  );

  // 5. GET /api/conversations/:id - Get conversation details
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { id } = request.params;

      try {
        const conversation = await conversationService.getConversationDetails(
          accountId,
          userId,
          id
        );
        return reply.status(200).send(conversation);
      } catch (err: any) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: err.message || 'Conversa não encontrada.',
        });
      }
    }
  );

  // 6. POST /api/conversations/:id/expire - Manually expire a temporary group (T-24)
  fastify.post<{ Params: { id: string } }>(
    '/:id/expire',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      try {
        const result = await groupExpirationService.expireSingleGroup(id);
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao expirar grupo.',
        });
      }
    }
  );

  // 7. POST /api/conversations/:id/members - Add members to group
  fastify.post<{ Params: { id: string } }>(
    '/:id/members',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId, role } = request.user;
      const { id } = request.params;
      const parseResult = AddMembersDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
        });
      }

      try {
        const updated = await conversationService.addMembersToGroup(
          accountId,
          userId,
          role,
          id,
          parseResult.data.userIds
        );
        return reply.status(200).send(updated);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao adicionar membros.',
        });
      }
    }
  );

  // 8. DELETE /api/conversations/:id/members/:userId - Remove member or leave group
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/:id/members/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId: callerId, role } = request.user;
      const { id, userId: targetUserId } = request.params;

      try {
        const result = await conversationService.removeMemberFromGroup(
          accountId,
          callerId,
          role,
          id,
          targetUserId
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao remover membro.',
        });
      }
    }
  );

  // 9. DELETE /api/conversations/:id - Delete group by admin/creator (T-24)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId: callerId, role } = request.user;
      const { id } = request.params;

      try {
        const result = await conversationService.deleteGroup(
          accountId,
          callerId,
          role,
          id
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao excluir grupo.',
        });
      }
    }
  );
};
