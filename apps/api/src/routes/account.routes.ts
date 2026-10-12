import { FastifyPluginAsync } from 'fastify';
import { AccountService } from '../services/account.service';
import {
  UpdateMemberStatusDtoSchema,
  UpdateMemberRoleDtoSchema,
  ChangePlanDtoSchema,
} from '@corpchat/shared';

export interface AccountRoutesOptions {
  accountService?: AccountService;
}

export const accountRoutes: FastifyPluginAsync<AccountRoutesOptions> = async (
  fastify,
  opts
) => {
  const accountService = opts.accountService || new AccountService();

  /**
   * GET /api/accounts/me
   * Returns current account details, active plan, limits, and over_quota info (T-29)
   */
  fastify.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token inválido ou ausente' });
    }

    const { accountId } = request.user as { accountId: string; userId: string; role: string };

    try {
      const details = await accountService.getAccountDetails(accountId);
      return reply.status(200).send(details);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Erro ao obter informações da organização',
      });
    }
  });

  /**
   * GET /api/accounts/members
   * Lists all members of current account (T-29)
   */
  fastify.get('/members', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token inválido ou ausente' });
    }

    const { accountId } = request.user as { accountId: string };

    try {
      const members = await accountService.listMembers(accountId);
      return reply.status(200).send({ members });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Erro ao listar membros',
      });
    }
  });

  /**
   * PATCH /api/accounts/members/:id/status
   * Activates or deactivates a member and reconciles over_quota status (T-29)
   */
  fastify.patch('/members/:id/status', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token inválido ou ausente' });
    }

    const { accountId, userId, role } = request.user as {
      accountId: string;
      userId: string;
      role: string;
    };
    const { id: targetUserId } = request.params as { id: string };

    const parseResult = UpdateMemberStatusDtoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Status inválido.',
        issues: parseResult.error.format(),
      });
    }

    try {
      const updatedMember = await accountService.updateMemberStatus(
        accountId,
        userId,
        role,
        targetUserId,
        parseResult.data.status
      );
      return reply.status(200).send({ member: updatedMember });
    } catch (err: any) {
      const isForbidden = err.message?.includes('Apenas Administradores');
      const statusCode = isForbidden ? 403 : 400;
      return reply.status(statusCode).send({
        statusCode,
        error: isForbidden ? 'Forbidden' : 'Bad Request',
        message: err.message || 'Erro ao alterar status do membro',
      });
    }
  });

  /**
   * PATCH /api/accounts/members/:id/role
   * Updates a member's role (owner/admin only)
   */
  fastify.patch('/members/:id/role', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token inválido ou ausente' });
    }

    const { accountId, userId, role } = request.user as {
      accountId: string;
      userId: string;
      role: string;
    };
    const { id: targetUserId } = request.params as { id: string };

    const parseResult = UpdateMemberRoleDtoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Papel inválido.',
        issues: parseResult.error.format(),
      });
    }

    try {
      const updatedMember = await accountService.updateMemberRole(
        accountId,
        userId,
        role,
        targetUserId,
        parseResult.data.role
      );
      return reply.status(200).send({ member: updatedMember });
    } catch (err: any) {
      const isForbidden = err.message?.includes('Apenas');
      const statusCode = isForbidden ? 403 : 400;
      return reply.status(statusCode).send({
        statusCode,
        error: isForbidden ? 'Forbidden' : 'Bad Request',
        message: err.message || 'Erro ao alterar papel do membro',
      });
    }
  });

  /**
   * POST /api/accounts/downgrade
   * Downgrades or changes plan directly and evaluates over_quota rules (T-29)
   */
  fastify.post('/downgrade', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token inválido ou ausente' });
    }

    const { accountId, role } = request.user as { accountId: string; role: string };

    const parseResult = ChangePlanDtoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Plano inválido.',
        issues: parseResult.error.format(),
      });
    }

    try {
      const updatedDetails = await accountService.changePlan(
        accountId,
        role,
        parseResult.data.plan
      );
      return reply.status(200).send(updatedDetails);
    } catch (err: any) {
      const isForbidden = err.message?.includes('Apenas Administradores');
      const statusCode = isForbidden ? 403 : 400;
      return reply.status(statusCode).send({
        statusCode,
        error: isForbidden ? 'Forbidden' : 'Bad Request',
        message: err.message || 'Erro ao alterar plano',
      });
    }
  });

  /**
   * POST /api/accounts/check-quota
   * Evaluates and updates over_quota status for current account (T-29)
   */
  fastify.post('/check-quota', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token inválido ou ausente' });
    }

    const { accountId } = request.user as { accountId: string };

    try {
      const result = await accountService.checkAndEnforceQuota(accountId);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Erro ao verificar quota',
      });
    }
  });

  /**
   * POST /api/accounts/cron/process-trials
   * Processes expired trials across accounts (T-29)
   */
  fastify.post('/cron/process-trials', async (request, reply) => {
    try {
      const result = await accountService.processTrialExpirations();
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Erro ao processar expiração de trials',
      });
    }
  });

  /**
   * POST /api/accounts/cron/process-overdue
   * Processes delinquent overdue accounts and applies grace period suspensions (T-29)
   */
  fastify.post('/cron/process-overdue', async (request, reply) => {
    try {
      const result = await accountService.processOverdueInvoices();
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Erro ao processar contas inadimplentes',
      });
    }
  });
};
