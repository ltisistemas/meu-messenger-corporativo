import { Controller, Get } from '@nestjs/common';
import { HealthService } from './services/health.service';

@Controller()
export class AppController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'nextmsg-backend',
      message: 'NextMsg NestJS API Server is running.',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  getHealth() {
    return this.healthService.checkHealth();
  }
}
