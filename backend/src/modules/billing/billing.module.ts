import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from '../../services/billing.service';
import { AsaasGatewayService } from '../../services/asaas.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, AsaasGatewayService],
  exports: [BillingService, AsaasGatewayService],
})
export class BillingModule {}
