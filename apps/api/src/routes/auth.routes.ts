import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RegisterAccountDtoSchema, LoginDtoSchema } from '@corpchat/shared';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';

const RefreshDtoSchema = z.object({
  refreshToken: z.string().min(1),
});

export interface AuthRoutesOptions {
  authMax?: number;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const authService = new AuthService();
  const authMax = options.authMax ?? 15;

  // 1. POST /api/auth/register
  fastify.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: authMax,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = RegisterAccountDtoSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados de registro inválidos.',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const result = await authService.registerAccount(parseResult.data);

        const accessToken = fastify.jwt.sign({
          userId: result.rawUser.id,
          accountId: result.account.id,
          role: result.rawUser.role,
          email: result.rawUser.email,
        });

        const refreshToken = await authService.createRefreshToken(result.rawUser.id);

        return reply.status(201).send({
          user: result.user,
          account: result.account,
          accessToken,
          refreshToken,
        });
      } catch (err: any) {
        const isDbError =
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('connect') ||
          err.message?.includes('timeout') ||
          err.code === 'ECONNREFUSED';

        if (isDbError) {
          fastify.log.error(err);
          return reply.status(503).send({
            statusCode: 503,
            error: 'Service Unavailable',
            message:
              'Banco de dados indisponível ou não configurado. Verifique a variável DATABASE_URL na Vercel.',
          });
        }

        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao registrar conta.',
        });
      }
    }
  );

  // 2. POST /api/auth/login
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: authMax,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = LoginDtoSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Dados de login inválidos.',
        });
      }

      try {
        const result = await authService.login(parseResult.data);

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
        const isDbError =
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('connect') ||
          err.message?.includes('timeout') ||
          err.code === 'ECONNREFUSED';

        if (isDbError) {
          fastify.log.error(err);
          return reply.status(503).send({
            statusCode: 503,
            error: 'Service Unavailable',
            message:
              'Banco de dados indisponível ou não configurado. Verifique a variável DATABASE_URL na Vercel.',
          });
        }

        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: err.message || 'Falha na autenticação.',
        });
      }
    }
  );

  // 3. POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const parseResult = RefreshDtoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Refresh token é obrigatório.',
      });
    }

    try {
      const result = await authService.rotateRefreshToken(parseResult.data.refreshToken);

      const accessToken = fastify.jwt.sign({
        userId: result.rawUser.id,
        accountId: result.account.id,
        role: result.rawUser.role,
        email: result.rawUser.email,
      });

      return reply.status(200).send({
        user: result.user,
        account: result.account,
        accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message || 'Token expirado ou inválido.',
      });
    }
  });

  // 4. POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    const parseResult = RefreshDtoSchema.safeParse(request.body);
    if (parseResult.success) {
      await authService.revokeRefreshToken(parseResult.data.refreshToken);
    }
    return reply.status(200).send({ success: true });
  });

  // 5. GET /api/auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const user = await authService['db'].query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      with: {
        account: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Usuário não encontrado.',
      });
    }

    return reply.status(200).send({
      user: authService.sanitizeUser(user),
      account: user.account,
    });
  });
};
