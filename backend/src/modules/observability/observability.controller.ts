import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from '../../services/health.service';
import { MetricsService } from '../../services/metrics.service';
import { BackupService } from '../../services/backup.service';

@Controller('api')
export class ObservabilityController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly backupService: BackupService
  ) {}

  @Get('health')
  async health() {
    return this.healthService.checkHealth();
  }

  @Get('live')
  live() {
    return {
      status: 'alive',
      service: 'nextmsg-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    const health = await this.healthService.checkHealth();
    return {
      status: health.checks.database.status === 'up' ? 'ready' : 'not_ready',
      database: health.checks.database.status,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  metrics() {
    return this.metricsService.getMetrics();
  }

  @Get('metrics/prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  prometheus() {
    return this.metricsService.getPrometheusFormat();
  }
}
