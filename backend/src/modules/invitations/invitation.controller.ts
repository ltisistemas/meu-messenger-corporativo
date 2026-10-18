import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InvitationService } from '../../services/invitation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AcceptInvitationDtoSchema, CreateInvitationDtoSchema } from '@/shared';

@Controller('api/invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createInvitation(
    @CurrentUser('userId') userId: string,
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('role') role: string,
    @Body() body: any
  ) {
    const parse = CreateInvitationDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException(parse.error.errors[0]?.message || 'Dados inválidos.');
    }
    try {
      return await this.invitationService.createInvitation(accountId, userId, role, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao criar convite.');
    }
  }

  @Get('verify/:token')
  async verifyInvitation(@Param('token') token: string) {
    try {
      return await this.invitationService.getInvitationByToken(token);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Convite inválido ou expirado.');
    }
  }

  @Post('accept')
  async acceptInvitation(@Body() body: any) {
    const parse = AcceptInvitationDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException(parse.error.errors[0]?.message || 'Dados inválidos.');
    }
    try {
      return await this.invitationService.acceptInvitation(parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao aceitar convite.');
    }
  }
}
