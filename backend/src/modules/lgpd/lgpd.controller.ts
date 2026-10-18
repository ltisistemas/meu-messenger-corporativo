import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LgpdService } from '../../services/lgpd.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LgpdDeleteAccountDtoSchema } from '@/shared';

@Controller('api/lgpd')
export class LgpdController {
  constructor(private readonly lgpdService: LgpdService) {}

  @Get('privacy-policy')
  getPrivacyPolicy() {
    return this.lgpdService.getPrivacyPolicy();
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  async exportData(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string
  ) {
    try {
      return await this.lgpdService.exportUserData(accountId, userId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Falha ao exportar dados pessoais.');
    }
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = LgpdDeleteAccountDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Confirmação inválida para exclusão de dados.');
    }
    try {
      return await this.lgpdService.deleteAndAnonymizeUser(accountId, userId, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao processar exclusão de conta.');
    }
  }
}
