import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SendBroadcastDtoSchema } from '@corpchat/shared';
import { BroadcastService } from '../services/broadcast.service';

export interface BroadcastRoutesOptions {
  broadcastService?: BroadcastService;
}

export const broadcastRoutes: FastifyPluginAsync<BroadcastRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const broadcastService = options.broadcastService || new BroadcastService();

  fastify.addHook('onReady', async () => {
    if (fastify.io) {
      broadcastService.setIoServer(fastify.io);
    }
  });

  // 1. GET /api/broadcasts/conversation - Get or initialize "Comunicados" broadcast channel
  fastify.get('/conversation', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { accountId, userId } = request.user;
    try {
      const conversation = await broadcastService.getOrCreateBroadcastConversation(
        accountId,
        userId
      );
      return reply.status(200).send(conversation);
    } catch (err: any) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: err.message || 'Falha ao acessar canal de transmissão.',
      });
    }
  });

  // 2. POST /api/broadcasts - Send broadcast to all account members (Admin/Owner Pro/Enterprise)
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { accountId, userId, role } = request.user;
    const parseResult = SendBroadcastDtoSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
      });
    }

    try {
      const result = await broadcastService.sendBroadcast(
        accountId,
        userId,
        role,
        parseResult.data
      );
      return reply.status(201).send(result);
    } catch (err: any) {
      fastify.log.error(err);
      const statusCode =
        err.message?.includes('plano Free') || err.message?.includes('Apenas administradores')
          ? 403
          : 400;

      return reply.status(statusCode).send({
        statusCode,
        error: statusCode === 403 ? 'Forbidden' : 'Bad Request',
        message: err.message || 'Falha ao enviar comunicado de transmissão.',
      });
    }
  });

  // 3. GET /api/broadcasts/:messageId/report - Get delivery & read receipts report (Admin/Owner only)
  fastify.get<{ Params: { messageId: string } }>(
    '/:messageId/report',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId, role } = request.user;
      const { messageId } = request.params;

      try {
        const report = await broadcastService.getBroadcastReport(
          accountId,
          userId,
          role,
          messageId
        );
        return reply.status(200).send(report);
      } catch (err: any) {
        const statusCode = err.message?.includes('Apenas administradores') ? 403 : 404;
        return reply.status(statusCode).send({
          statusCode,
          error: statusCode === 403 ? 'Forbidden' : 'Not Found',
          message: err.message || 'Falha ao obter relatório de transmissão.',
        });
      }
    }
  );
};
