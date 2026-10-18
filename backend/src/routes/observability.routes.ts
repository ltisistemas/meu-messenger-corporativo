import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { HealthService } from '../services/health.service';
import { MetricsService } from '../services/metrics.service';
import { BackupService } from '../services/backup.service';

export interface ObservabilityRoutesOptions {
  healthService?: HealthService;
  metricsService?: MetricsService;
  backupService?: BackupService;
}

export const observabilityRoutes: FastifyPluginAsync<ObservabilityRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const healthService = options.healthService || new HealthService();
  const metricsService = options.metricsService || new MetricsService();
  const backupService = options.backupService || new BackupService();

  // 1. Health check endpoint (Kubernetes liveness / general monitoring)
  fastify.get('/health', async (_request, reply) => {
    const health = await healthService.checkHealth();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    return reply.status(statusCode).send(health);
  });

  // 2. Liveness probe (shallow ping)
  fastify.get('/live', async (_request, reply) => {
    return reply.status(200).send({
      status: 'alive',
      service: 'nextmsg-api',
      timestamp: new Date().toISOString(),
    });
  });

  // 3. Readiness probe (checks DB readiness)
  fastify.get('/ready', async (_request, reply) => {
    const health = await healthService.checkHealth();
    const isReady = health.checks.database.status === 'up';
    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not_ready',
      database: health.checks.database.status,
      timestamp: new Date().toISOString(),
    });
  });

  // 4. JSON Metrics Endpoint
  fastify.get('/api/metrics', async (_request, reply) => {
    const metrics = metricsService.getMetrics();
    return reply.status(200).send(metrics);
  });

  // 5. Prometheus Metrics Format Endpoint (/metrics)
  fastify.get('/metrics', async (_request, reply) => {
    const prometheusData = metricsService.getPrometheusFormat();
    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .status(200)
      .send(prometheusData);
  });

  // 6. Automated / On-demand Backup Endpoint (Protected: Owner only)
  fastify.post(
    '/api/backup',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { role } = request.user;
      if (role !== 'owner' && role !== 'admin') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Apenas Administradores ou Proprietários podem gerar backups da base.',
        });
      }

      try {
        const backup = await backupService.createBackup();
        return reply.status(200).send(backup);
      } catch (err: any) {
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message || 'Falha ao gerar backup.',
        });
      }
    }
  );

  // 7. Backup Restore Endpoint (Protected: Owner only)
  fastify.post(
    '/api/backup/restore',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { role } = request.user;
      if (role !== 'owner') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Apenas o Proprietário da organização pode restaurar backups.',
        });
      }

      try {
        const result = await backupService.restoreFromBackup(request.body as any);
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Falha ao restaurar backup.',
        });
      }
    }
  );
};
