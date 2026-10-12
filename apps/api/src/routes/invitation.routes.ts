import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CreateInvitationDtoSchema, AcceptInvitationDtoSchema } from '@corpchat/shared';
import { InvitationService } from '../services/invitation.service';
import { AuthService } from '../services/auth.service';

export const invitationRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const invitationService = new InvitationService();
  const authService = new AuthService();

  // 1. POST /api/invitations (Protected)
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, userId, role } = request.user;
      const parseResult = CreateInvitationDtoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados de convite inválidos.',
        });
      }

      try {
        const result = await invitationService.createInvitation(
          accountId,
          userId,
          role,
          parseResult.data
        );

        return reply.status(201).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao criar convite.',
        });
      }
    }
  );

  // 2. GET /api/invitations (Protected)
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId } = request.user;
      const list = await invitationService.listInvitations(accountId);
      return reply.status(200).send({ invitations: list });
    }
  );

  // 3. DELETE /api/invitations/:id (Protected)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { accountId, role } = request.user;
      const { id } = request.params;

      try {
        await invitationService.revokeInvitation(accountId, id, role);
        return reply.status(200).send({ success: true });
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao revogar convite.',
        });
      }
    }
  );

  // 4. GET /api/invitations/:token (Public)
  fastify.get<{ Params: { token: string } }>(
    '/:token',
    async (request, reply) => {
      const { token } = request.params;

      try {
        const invitation = await invitationService.getInvitationByToken(token);
        return reply.status(200).send({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          accountName: invitation.account.name,
          plan: invitation.account.plan,
          expiresAt: invitation.expiresAt,
        });
      } catch (err: any) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: err.message || 'Convite inválido ou expirado.',
        });
      }
    }
  );

  // 5. POST /api/invitations/:token/accept (Public)
  fastify.post<{ Params: { token: string } }>(
    '/:token/accept',
    async (request, reply) => {
      const { token } = request.params;
      const body = request.body as any;

      const parseResult = AcceptInvitationDtoSchema.safeParse({
        ...body,
        token,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
        });
      }

      try {
        const result = await invitationService.acceptInvitation(parseResult.data);

        const accessToken = fastify.jwt.sign({
          userId: result.rawUser.id,
          accountId: result.account.id,
          role: result.rawUser.role,
          email: result.rawUser.email,
        });

        const refreshToken = await authService.createRefreshToken(result.rawUser.id);

        return reply.status(200).send({
          user: result.user,
          account: result.account,
          accessToken,
          refreshToken,
        });
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao aceitar convite.',
        });
      }
    }
  );
};
