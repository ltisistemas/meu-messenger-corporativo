import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BroadcastService } from '../../services/broadcast.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SendBroadcastDtoSchema } from '@/shared';

@Controller('api/broadcasts')
@UseGuards(JwtAuthGuard)
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get('conversation')
  async getBroadcastConversation(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string
  ) {
    try {
      return await this.broadcastService.getOrCreateBroadcastConversation(accountId, userId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Falha ao acessar canal de transmissão.');
    }
  }

  @Post()
  async sendBroadcast(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Body() body: any
  ) {
    const parse = SendBroadcastDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para transmissão.');
    }
    try {
      return await this.broadcastService.sendBroadcast(accountId, userId, role, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao enviar transmissão.');
    }
  }
}
