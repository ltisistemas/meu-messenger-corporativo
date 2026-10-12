import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CreateSubscriptionDtoSchema, CancelSubscriptionDtoSchema } from '@corpchat/shared';
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
  fastify.post(
    '/subscribe',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
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
    }
  );

  // 2. GET /api/billing/summary - Get billing summary, current subscription, and invoice history
  fastify.get(
    '/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
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
    }
  );

  // 3. POST /api/billing/cancel - Cancel active subscription at period end (admin/owner only)
  fastify.post(
    '/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
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
    }
  );

  // 4. POST /api/billing/webhook/asaas - Public webhook endpoint from Asaas Gateway (T-28)
  fastify.post(
    '/webhook/asaas',
    async (request, reply) => {
      const webhookToken = (request.headers['asaas-access-token'] as string) || undefined;
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
          body.payment || body.subscription,
          webhookToken
        );
        return reply.status(200).send({
          received: true,
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
    }
  );
};
