import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { LgpdDeleteAccountDtoSchema } from '@corpchat/shared';
import { LgpdService } from '../services/lgpd.service';

export interface LgpdRoutesOptions {
  lgpdService?: LgpdService;
}

export const lgpdRoutes: FastifyPluginAsync<LgpdRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const lgpdService = options.lgpdService || new LgpdService();

  fastify.addHook('onReady', async () => {
    if (fastify.io) {
      lgpdService.setIoServer(fastify.io);
    }
  });

  // 1. GET /api/lgpd/privacy-policy - Public privacy policy & DPO information
  fastify.get('/privacy-policy', async (_request, reply) => {
    const policy = lgpdService.getPrivacyPolicy();
    return reply.status(200).send(policy);
  });

  // 2. GET /api/lgpd/export - Export all personal data (LGPD Art. 18, V)
  fastify.get(
    '/export',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { accountId, userId } = request.user;

      try {
        const exportedData = await lgpdService.exportUserData(accountId, userId);
        return reply.status(200).send(exportedData);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao exportar dados pessoais.',
        });
      }
    }
  );

  // 3. POST /api/lgpd/delete-account - Anonymize & delete user account (LGPD Art. 18, VI)
  fastify.post(
    '/delete-account',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const parseResult = LgpdDeleteAccountDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos para exclusão.',
        });
      }

      try {
        const result = await lgpdService.deleteAndAnonymizeUser(
          accountId,
          userId,
          parseResult.data
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        const isForbidden =
          err.message?.includes('único Proprietário') || err.message?.includes('Senha incorreta');

        const statusCode = isForbidden ? 403 : 400;
        return reply.status(statusCode).send({
          statusCode,
          error: isForbidden ? 'Forbidden' : 'Bad Request',
          message: err.message || 'Falha ao excluir conta.',
        });
      }
    }
  );
};
