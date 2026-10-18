import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateSubscriptionDtoSchema,
  CancelSubscriptionDtoSchema,
  SimulateCheckoutStatusDtoSchema,
} from '@corpchat/shared';
import { BillingService } from '../services/billing.service';

export interface BillingRoutesOptions {
  billingService?: BillingService;
}

export const billingRoutes: FastifyPluginAsync<BillingRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const billingService = options.billingService || new BillingService();

  // 1. POST /api/billing/subscribe - Create a subscription (admin/owner only - T-28)
  fastify.post('/subscribe', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { accountId, userId, role } = request.user;
    const parseResult = CreateSubscriptionDtoSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Dados de assinatura inválidos.',
      });
    }

    try {
      const result = await billingService.createSubscription(
        accountId,
        userId,
        role,
        parseResult.data
      );
      return reply.status(201).send(result);
    } catch (err: any) {
      const isForbidden = err.message?.includes('Apenas administradores');
      const statusCode = isForbidden ? 403 : 400;
      return reply.status(statusCode).send({
        statusCode,
        error: isForbidden ? 'Forbidden' : 'Bad Request',
        message: err.message || 'Falha ao criar assinatura.',
      });
    }
  });

  // 2. GET /api/billing/summary - Get billing summary, current subscription, and invoice history
  fastify.get('/summary', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { accountId } = request.user;

    try {
      const summary = await billingService.getAccountBillingSummary(accountId);
      return reply.status(200).send(summary);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Falha ao carregar informações de faturamento.',
      });
    }
  });

  // 3. GET /api/billing/checkout/status - Poll checkout confirmation status (T-28)
  fastify.get(
    '/checkout/status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { chargeId } = request.query as { chargeId?: string };

      if (!chargeId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Parâmetro chargeId obrigatório.',
        });
      }

      try {
        const status = await billingService.getCheckoutStatus(accountId, chargeId);
        return reply.status(200).send(status);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Erro ao consultar status do checkout.',
        });
      }
    }
  );

  // 4. POST /api/billing/checkout/status - Simulate payment confirmation for sandbox/dev testing
  fastify.post(
    '/checkout/status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const parseResult = SimulateCheckoutStatusDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos para simulação.',
        });
      }

      try {
        const status = await billingService.simulateCheckoutStatus(
          accountId,
          parseResult.data.chargeId
        );
        return reply.status(200).send({
          sucesso: true,
          ...status,
        });
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Erro ao simular pagamento.',
        });
      }
    }
  );

  // 5. POST /api/billing/cancel - Cancel active subscription or schedule at period end (admin/owner only)
  fastify.post('/cancel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { accountId, userId, role } = request.user;
    const parseResult = CancelSubscriptionDtoSchema.safeParse(request.body || {});

    try {
      const sub = await billingService.cancelSubscription(
        accountId,
        userId,
        role,
        parseResult.success ? parseResult.data : undefined
      );
      return reply.status(200).send(sub);
    } catch (err: any) {
      const isForbidden = err.message?.includes('Apenas administradores');
      const statusCode = isForbidden ? 403 : 400;
      return reply.status(statusCode).send({
        statusCode,
        error: isForbidden ? 'Forbidden' : 'Bad Request',
        message: err.message || 'Falha ao cancelar assinatura.',
      });
    }
  });

  // 6. POST /api/billing/webhook/asaas - Public webhook endpoint from Asaas Gateway (T-28)
  fastify.post('/webhook/asaas', async (request, reply) => {
    const webhookToken =
      (request.headers['asaas-access-token'] as string) ||
      (request.query as any)?.token ||
      undefined;
    const body = request.body as any;

    if (!body || !body.event) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Payload de webhook inválido: evento não especificado.',
      });
    }

    try {
      const result = await billingService.handleWebhook(
        body.event,
        body.payment || body.subscription || body,
        webhookToken,
        body.id
      );
      return reply.status(200).send({
        ok: true,
        received: true,
        id: body.id,
        event: body.event,
        ...result,
      });
    } catch (err: any) {
      const isUnauthorized = err.message?.includes('Token de webhook');
      const statusCode = isUnauthorized ? 401 : 400;
      return reply.status(statusCode).send({
        statusCode,
        error: isUnauthorized ? 'Unauthorized' : 'Bad Request',
        message: err.message || 'Falha no processamento do webhook.',
      });
    }
  });

  // 7. GET /api/billing/admin/webhooks - Observability log of received webhooks (Admin only)
  fastify.get('/admin/webhooks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (role !== 'admin' && role !== 'owner') {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Apenas administradores podem visualizar logs de auditoria financeira.',
      });
    }

    const query = request.query as any;
    const page = query?.page ? Number.parseInt(query.page, 10) : 1;
    const limit = query?.limit ? Number.parseInt(query.limit, 10) : 20;

    try {
      const logs = await billingService.listWebhookEvents({
        page,
        limit,
        status: query?.status,
        gateway: query?.gateway,
      });
      return reply.status(200).send(logs);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Erro ao listar eventos de webhook.',
      });
    }
  });
};
