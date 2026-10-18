import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateSignatureRequestDtoSchema,
  SimulateSignerDtoSchema,
  VerifySignatureHashDtoSchema,
} from '@/shared';
import { SignatureService } from '../services/signature.service';

export interface SignatureRoutesOptions {
  signatureService?: SignatureService;
}

export const signatureRoutes: FastifyPluginAsync<SignatureRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const signatureService = options.signatureService || new SignatureService();

  fastify.addHook('onReady', async () => {
    if (fastify.io) {
      signatureService.setIoServer(fastify.io);
    }
  });

  // 1. POST /api/signatures - Create signature request (Enterprise only)
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const parseResult = CreateSignatureRequestDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message:
            parseResult.error.errors[0]?.message ||
            'Dados inválidos para solicitação de assinatura.',
        });
      }

      try {
        const result = await signatureService.createSignatureRequest(
          accountId,
          userId,
          parseResult.data
        );
        return reply.status(201).send(result);
      } catch (err: any) {
        const isForbidden =
          err.message?.includes('Enterprise') ||
          err.message?.includes('limite de membros') ||
          err.message?.includes('suspensa') ||
          err.message?.includes('não tem permissão');

        const statusCode = isForbidden ? 403 : 400;
        return reply.status(statusCode).send({
          statusCode,
          error: isForbidden ? 'Forbidden' : 'Bad Request',
          message: err.message || 'Falha ao solicitar assinatura.',
        });
      }
    }
  );

  // 2. GET /api/signatures/:id - Get signature request details
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      try {
        const result = await signatureService.getSignatureRequest(accountId, id);
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: err.message || 'Solicitação de assinatura não encontrada.',
        });
      }
    }
  );

  // 3. GET /api/signatures/conversation/:conversationId - List signatures in conversation
  fastify.get<{ Params: { conversationId: string } }>(
    '/conversation/:conversationId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { conversationId } = request.params;

      try {
        const list = await signatureService.listSignatureRequestsByConversation(
          accountId,
          conversationId
        );
        return reply.status(200).send({ signatures: list });
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Erro ao listar assinaturas da conversa.',
        });
      }
    }
  );

  // 4. POST /api/signatures/:id/signers/:signerId/simulate - Sandbox signing simulation
  fastify.post<{ Params: { id: string; signerId: string } }>(
    '/:id/signers/:signerId/simulate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id, signerId } = request.params;
      const parseResult = SimulateSignerDtoSchema.safeParse(request.body || {});

      try {
        const updated = await signatureService.simulateSign(
          accountId,
          id,
          signerId,
          parseResult.success ? parseResult.data : {}
        );
        return reply.status(200).send(updated);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao simular assinatura.',
        });
      }
    }
  );

  // 5. GET /api/signatures/:id/evidence - Get evidence report manifest (T-33)
  fastify.get<{ Params: { id: string } }>(
    '/:id/evidence',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      try {
        const evidence = await signatureService.getEvidenceReport(accountId, id);
        return reply.status(200).send(evidence);
      } catch (err: any) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: err.message || 'Manifesto de evidências não encontrado.',
        });
      }
    }
  );

  // 6. GET /api/signatures/:id/evidence/pdf - Download evidence certificate PDF (T-33)
  fastify.get<{ Params: { id: string } }>(
    '/:id/evidence/pdf',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      try {
        const file = await signatureService.generateEvidenceCertificatePdf(accountId, id);
        reply.header('Content-Type', file.contentType);
        reply.header('Content-Disposition', `attachment; filename="${file.filename}"`);
        reply.header('X-Certificate-Sha256', file.sha256);
        return reply.status(200).send(file.buffer);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Erro ao gerar certificado de evidências.',
        });
      }
    }
  );

  // 7. GET /api/signatures/:id/download - Download signed document PDF (T-33)
  fastify.get<{ Params: { id: string } }>(
    '/:id/download',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      try {
        const file = await signatureService.downloadSignedDocument(accountId, id);
        reply.header('Content-Type', file.contentType);
        reply.header('Content-Disposition', `attachment; filename="${file.filename}"`);
        reply.header('X-Document-Sha256', file.sha256);
        return reply.status(200).send(file.buffer);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Erro ao baixar documento assinado.',
        });
      }
    }
  );

  // 8. POST /api/signatures/:id/verify-hash - Verify document hash integrity (T-33)
  fastify.post<{ Params: { id: string } }>(
    '/:id/verify-hash',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;
      const parseResult = VerifySignatureHashDtoSchema.safeParse(request.body || {});

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message:
            parseResult.error.errors[0]?.message || 'Dados inválidos para verificação de hash.',
        });
      }

      try {
        const result = await signatureService.verifyDocumentHash(accountId, id, parseResult.data);
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Erro ao verificar hash do documento.',
        });
      }
    }
  );

  // 9. POST /api/signatures/webhooks/clicksign - Clicksign Webhook receiver
  fastify.post('/webhooks/clicksign', async (request, reply) => {
    const rawPayload =
      typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const signatureHeader =
      (request.headers['x-clicksign-signature'] as string) ||
      (request.headers['content-hmac-sha256'] as string) ||
      '';

    try {
      const result = await signatureService.handleClicksignWebhook(rawPayload, signatureHeader);
      return reply.status(200).send({
        status: 'ok',
        received: true,
        ...result,
      });
    } catch (err: any) {
      return reply.status(400).send({
        status: 'error',
        message: err.message || 'Erro ao processar webhook da Clicksign.',
      });
    }
  });
};

