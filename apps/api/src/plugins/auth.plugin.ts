import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

export interface JwtPayload {
  userId: string;
  accountId: string;
  role: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

const authPluginCallback: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-environment-12345';

  await fastify.register(fastifyJwt, {
    secret,
    sign: {
      expiresIn: '15m',
    },
  });

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Token de acesso inválido ou expirado.',
        });
      }
    }
  );
};

export const authPlugin = fp(authPluginCallback, {
  name: 'auth-plugin',
});
