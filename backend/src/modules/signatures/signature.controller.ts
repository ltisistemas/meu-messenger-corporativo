import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SignatureService } from '../../services/signature.service';
import { ClicksignProviderService } from '../../services/clicksign.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateSignatureRequestDtoSchema,
  SimulateSignerDtoSchema,
} from '@/shared';

@Controller('api/signatures')
export class SignatureController {
  constructor(
    private readonly signatureService: SignatureService,
    private readonly clicksignProvider: ClicksignProviderService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @CurrentUser('userId') userId: string,
    @CurrentUser('accountId') accountId: string,
    @Body() body: any
  ) {
    const parse = CreateSignatureRequestDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para solicitação de assinatura.');
    }
    try {
      return await this.signatureService.createSignatureRequest(accountId, userId, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao criar solicitação de assinatura.');
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getDetails(
    @Param('id') id: string,
    @CurrentUser('accountId') accountId: string
  ) {
    try {
      return await this.signatureService.getSignatureRequest(accountId, id);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao consultar documento de assinatura.');
    }
  }

  @Post(':id/signers/:signerId/simulate')
  @UseGuards(JwtAuthGuard)
  async simulateSigner(
    @Param('id') id: string,
    @Param('signerId') signerId: string,
    @CurrentUser('accountId') accountId: string,
    @Body() body: any
  ) {
    const parse = SimulateSignerDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para simulação.');
    }
    try {
      return await this.signatureService.simulateSign(accountId, id, signerId, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro na simulação de assinatura.');
    }
  }

  @Post('webhook/clicksign')
  async handleWebhook(
    @Body() body: any,
    @Headers('content-hmac') hmac?: string
  ) {
    try {
      return await this.signatureService.handleClicksignWebhook(body, hmac || '');
    } catch (err: any) {
      return { received: true, error: err.message };
    }
  }
}
