import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CreatePollDtoSchema, VotePollDtoSchema, sanitizeText } from '@/shared';
import { PollService } from '../services/poll.service';

export interface PollRoutesOptions {
  pollService?: PollService;
}

export const pollRoutes: FastifyPluginAsync<PollRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const pollService = options.pollService || new PollService();

  fastify.addHook('onReady', async () => {
    if (fastify.io) {
      pollService.setIoServer(fastify.io);
    }
  });

  // 1. POST /api/polls - Create a new poll (Pro/Enterprise only - T-26)
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const parseResult = CreatePollDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message:
            parseResult.error.errors[0]?.message || 'Dados inválidos para criação da enquete.',
        });
      }

      try {
        // Sanitize poll question and options to prevent XSS injection
        const sanitizedData = {
          ...parseResult.data,
          question: sanitizeText(parseResult.data.question),
          options: parseResult.data.options.map((opt) => sanitizeText(opt)),
        };

        const poll = await pollService.createPoll(accountId, userId, sanitizedData);
        return reply.status(201).send(poll);
      } catch (err: any) {
        const statusCode = err.message?.includes('plano Free') ? 403 : 400;
        return reply.status(statusCode).send({
          statusCode,
          error: statusCode === 403 ? 'Forbidden' : 'Bad Request',
          message: err.message || 'Falha ao criar enquete.',
        });
      }
    }
  );

  // 2. GET /api/polls/:pollId - Get poll details & live results
  fastify.get<{ Params: { pollId: string } }>(
    '/:pollId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { pollId } = request.params;

      try {
        const poll = await pollService.getPollDetails(accountId, userId, pollId);
        return reply.status(200).send(poll);
      } catch (err: any) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: err.message || 'Enquete não encontrada.',
        });
      }
    }
  );

  // 3. POST /api/polls/:pollId/vote - Vote on a poll (single or multiple choice)
  fastify.post<{ Params: { pollId: string } }>(
    '/:pollId/vote',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { pollId } = request.params;
      const parseResult = VotePollDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados de votação inválidos.',
        });
      }

      try {
        const updated = await pollService.votePoll(accountId, userId, pollId, parseResult.data);
        return reply.status(200).send(updated);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao registrar voto na enquete.',
        });
      }
    }
  );

  // 4. POST /api/polls/:pollId/close - Close a poll
  fastify.post<{ Params: { pollId: string } }>(
    '/:pollId/close',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId, role } = request.user;
      const { pollId } = request.params;

      try {
        const closed = await pollService.closePoll(accountId, userId, role, pollId);
        return reply.status(200).send(closed);
      } catch (err: any) {
        const statusCode = err.message?.includes('Apenas') ? 403 : 400;
        return reply.status(statusCode).send({
          statusCode,
          error: statusCode === 403 ? 'Forbidden' : 'Bad Request',
          message: err.message || 'Falha ao encerrar enquete.',
        });
      }
    }
  );
};

