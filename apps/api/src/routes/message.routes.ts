import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  SendTextMessageDtoSchema,
  MarkMessagesReadDtoSchema,
  sanitizeMessageContent,
} from '@corpchat/shared';
import { MessageService } from '../services/message.service';
import { z } from 'zod';

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const messageRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const messageService = new MessageService();

  // 1. POST /api/messages - Send a message
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const parseResult = SendTextMessageDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Mensagem inválida.',
        });
      }

      try {
        if (fastify.io) {
          messageService.setIoServer(fastify.io);
        }

        // Apply XSS sanitization to message content
        const sanitizedContent = sanitizeMessageContent(parseResult.data.content);

        const message = await messageService.sendMessage(accountId, userId, {
          ...parseResult.data,
          content: sanitizedContent,
        });
        return reply.status(201).send(message);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao enviar mensagem.',
        });
      }
    }
  );

  // 2. GET /api/messages/conversation/:conversationId - List messages for conversation
  fastify.get<{
    Params: { conversationId: string };
    Querystring: { limit?: number; offset?: number };
  }>(
    '/conversation/:conversationId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { conversationId } = request.params;
      const queryResult = PaginationQuerySchema.safeParse(request.query);

      const { limit, offset } = queryResult.success ? queryResult.data : { limit: 50, offset: 0 };

      try {
        const list = await messageService.listMessages(
          accountId,
          userId,
          conversationId,
          limit,
          offset
        );
        return reply.status(200).send({ messages: list });
      } catch (err: any) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: err.message || 'Acesso negado às mensagens.',
        });
      }
    }
  );

  // 3. POST /api/messages/read - Mark messages as read
  fastify.post('/read', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { accountId, userId } = request.user;
    const parseResult = MarkMessagesReadDtoSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
      });
    }

    try {
      if (fastify.io) {
        messageService.setIoServer(fastify.io);
      }
      const result = await messageService.markConversationAsRead(
        accountId,
        userId,
        parseResult.data.conversationId,
        parseResult.data.messageIds
      );
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Falha ao marcar mensagens como lidas.',
      });
    }
  });

  // 4. POST /api/messages/sync - Sync offline messages
  fastify.post('/sync', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    if (fastify.io) {
      messageService.setIoServer(fastify.io);
    }
    const synced = await messageService.syncOfflineMessages(userId);
    return reply.status(200).send({ syncedCount: synced.length, messages: synced });
  });
};
