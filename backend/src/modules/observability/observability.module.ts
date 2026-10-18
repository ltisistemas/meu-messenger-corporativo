import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { HealthService } from '../../services/health.service';
import { MetricsService, defaultMetricsService } from '../../services/metrics.service';
import { BackupService } from '../../services/backup.service';

@Module({
  controllers: [ObservabilityController],
  providers: [
    HealthService,
    {
      provide: MetricsService,
      useValue: defaultMetricsService,
    },
    BackupService,
  ],
  exports: [HealthService, MetricsService, BackupService],
})
export class ObservabilityModule {}
