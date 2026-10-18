import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from '../../services/billing.service';
import { AsaasGatewayService } from '../../services/asaas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CancelSubscriptionDtoSchema,
  CreateSubscriptionDtoSchema,
  SimulateCheckoutStatusDtoSchema,
} from '@/shared';

@Controller('api/billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly asaasService: AsaasGatewayService
  ) {}

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@CurrentUser() user: any, @Body() body: any) {
    const parse = CreateSubscriptionDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException(parse.error.errors[0]?.message || 'Dados de assinatura inválidos.');
    }
    try {
      return await this.billingService.createSubscription(
        user.accountId,
        user.userId,
        user.role,
        parse.data
      );
    } catch (err: any) {
      if (err.message?.includes('Apenas administradores')) {
        throw new ForbiddenException(err.message);
      }
      throw new BadRequestException(err.message || 'Falha ao criar assinatura.');
    }
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async summary(@CurrentUser('accountId') accountId: string) {
    try {
      return await this.billingService.getAccountBillingSummary(accountId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Falha ao carregar faturamento.');
    }
  }

  @Get('checkout/status')
  @UseGuards(JwtAuthGuard)
  async getCheckoutStatus(
    @CurrentUser('accountId') accountId: string,
    @Query('chargeId') chargeId: string
  ) {
    if (!chargeId) {
      throw new BadRequestException('Parâmetro chargeId obrigatório.');
    }
    try {
      return await this.billingService.getCheckoutStatus(accountId, chargeId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao consultar status do checkout.');
    }
  }

  @Post('checkout/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async simulateCheckoutStatus(
    @CurrentUser('accountId') accountId: string,
    @Body() body: any
  ) {
    const parse = SimulateCheckoutStatusDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Parâmetro chargeId obrigatório no corpo.');
    }
    try {
      return await this.billingService.simulateCheckoutStatus(accountId, parse.data.chargeId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao simular confirmação.');
    }
  }

  @Post('subscriptions/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@CurrentUser() user: any, @Body() body: any) {
    const parse = CancelSubscriptionDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException(parse.error.errors[0]?.message || 'Dados de cancelamento inválidos.');
    }
    try {
      return await this.billingService.cancelSubscription(
        user.accountId,
        user.userId,
        user.role,
        parse.data
      );
    } catch (err: any) {
      if (err.message?.includes('Apenas administradores')) {
        throw new ForbiddenException(err.message);
      }
      throw new BadRequestException(err.message || 'Falha ao cancelar assinatura.');
    }
  }

  @Post('webhook/asaas')
  @HttpCode(HttpStatus.OK)
  async handleAsaasWebhook(
    @Body() body: any,
    @Headers('asaas-access-token') webhookToken?: string
  ) {
    if (!body || !body.event) {
      throw new BadRequestException('Payload de webhook inválido.');
    }
    try {
      return await this.billingService.handleWebhook(
        body.event,
        body.payment || body.subscription || body,
        webhookToken,
        body.id
      );
    } catch (err: any) {
      return { received: true, error: err.message };
    }
  }

  @Get('admin/webhooks')
  @UseGuards(JwtAuthGuard)
  async listWebhookLogs(
    @CurrentUser('role') role: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenException('Apenas administradores têm acesso aos logs financeiros.');
    }
    return this.billingService.listWebhookEvents({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
