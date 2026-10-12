import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { authPlugin } from './plugins/auth.plugin';
import { authRoutes } from './routes/auth.routes';
import { invitationRoutes } from './routes/invitation.routes';
import { conversationRoutes } from './routes/conversation.routes';
import { messageRoutes } from './routes/message.routes';
import { fileRoutes } from './routes/file.routes';
import { broadcastRoutes } from './routes/broadcast.routes';
import { pollRoutes } from './routes/poll.routes';
import { billingRoutes } from './routes/billing.routes';
import { accountRoutes } from './routes/account.routes';
import { signatureRoutes } from './routes/signature.routes';
import { lgpdRoutes } from './routes/lgpd.routes';
import { observabilityRoutes } from './routes/observability.routes';
import { defaultMetricsService, MetricsService } from './services/metrics.service';
import { HealthService } from './services/health.service';
import { BackupService } from './services/backup.service';
import { createWebSocketServer } from './ws/socket.server';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

export interface BuildServerOptions {
  fileService?: import('./services/file.service').FileService;
  fileExpirationService?: import('./jobs/file-expiration.job').FileExpirationService;
  conversationService?: import('./services/conversation.service').ConversationService;
  groupExpirationService?: import('./jobs/group-expiration.job').GroupExpirationService;
  broadcastService?: import('./services/broadcast.service').BroadcastService;
  pollService?: import('./services/poll.service').PollService;
  billingService?: import('./services/billing.service').BillingService;
  accountService?: import('./services/account.service').AccountService;
  signatureService?: import('./services/signature.service').SignatureService;
  lgpdService?: import('./services/lgpd.service').LgpdService;
  healthService?: HealthService;
  metricsService?: MetricsService;
  backupService?: BackupService;
  rateLimit?: {
    globalMax?: number;
    authMax?: number;
    messagesMax?: number;
    filesMax?: number;
    signaturesMax?: number;
    timeWindow?: string | number;
  };
}

export function buildServer(options?: BuildServerOptions): FastifyInstance {
  const metricsService = options?.metricsService || defaultMetricsService;

  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'body.password',
          'body.refreshToken',
          'body.content',
          '*.content',
          'password',
          'token',
          'refreshToken',
        ],
        censor: '[REDACTED]',
      },
    },
  });

  // 1. Security Headers (Helmet)
  server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // 2. Cross-Origin Resource Sharing (CORS)
  server.register(cors, {
    origin: true,
    credentials: true,
  });

  // 3. Global & Route Rate Limiting
  const globalMax = options?.rateLimit?.globalMax ?? (process.env.NODE_ENV === 'test' ? 1000 : 120);
  const timeWindow = options?.rateLimit?.timeWindow ?? '1 minute';

  server.register(rateLimit, {
    global: true,
    max: globalMax,
    timeWindow,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Limite de requisições excedido. Tente novamente em alguns instantes.',
      retryAfter: context.after,
    }),
    keyGenerator: (req) => {
      const user = (req as any).user;
      if (user && (user.userId || user.id)) {
        return `user:${user.userId || user.id}`;
      }
      return `ip:${req.ip}`;
    },
  });

  server.register(authPlugin);
  server.register(authRoutes, {
    prefix: '/api/auth',
    authMax: options?.rateLimit?.authMax,
  });
  server.register(accountRoutes, {
    prefix: '/api/accounts',
    accountService: options?.accountService,
  });
  server.register(invitationRoutes, { prefix: '/api/invitations' });
  server.register(conversationRoutes, {
    prefix: '/api/conversations',
    conversationService: options?.conversationService,
    groupExpirationService: options?.groupExpirationService,
  });
  server.register(messageRoutes, { prefix: '/api/messages' });
  server.register(broadcastRoutes, {
    prefix: '/api/broadcasts',
    broadcastService: options?.broadcastService,
  });
  server.register(pollRoutes, {
    prefix: '/api/polls',
    pollService: options?.pollService,
  });
  server.register(billingRoutes, {
    prefix: '/api/billing',
    billingService: options?.billingService,
  });
  server.register(signatureRoutes, {
    prefix: '/api/signatures',
    signatureService: options?.signatureService,
  });
  server.register(lgpdRoutes, {
    prefix: '/api/lgpd',
    lgpdService: options?.lgpdService,
  });
  server.register(fileRoutes, {
    prefix: '/api/files',
    fileService: options?.fileService,
    fileExpirationService: options?.fileExpirationService,
  });

  // Metrics collection hooks
  server.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  server.addHook('onResponse', async (request, reply) => {
    const start = (request as any).startTime || Date.now();
    const duration = Date.now() - start;
    metricsService.recordRequest(reply.statusCode, duration);
  });

  // Register Observability Routes (/health, /live, /ready, /metrics, /api/metrics, /api/backup)
  server.register(observabilityRoutes, {
    healthService: options?.healthService,
    metricsService,
    backupService: options?.backupService,
  });

  // Attach WebSocket server when Fastify is ready
  server.addHook('onReady', async () => {
    const io = createWebSocketServer(server.server, server);
    server.decorate('io', io);
  });

  // Gracefully close WebSocket server on Fastify shutdown
  server.addHook('onClose', async (instance) => {
    if (instance.io) {
      await new Promise<void>((resolve) => {
        instance.io.close(() => resolve());
      });
    }
  });

  return server;
}
