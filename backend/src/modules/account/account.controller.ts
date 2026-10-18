import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from '../../services/account.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ChangePlanDtoSchema,
  UpdateMemberRoleDtoSchema,
  UpdateMemberStatusDtoSchema,
} from '@/shared';

@Controller('api/accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('me')
  async getMe(@CurrentUser('accountId') accountId: string) {
    try {
      return await this.accountService.getAccountDetails(accountId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao obter informações da organização.');
    }
  }

  @Get('members')
  async getMembers(@CurrentUser('accountId') accountId: string) {
    try {
      return await this.accountService.listMembers(accountId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao listar membros.');
    }
  }

  @Patch('members/:userId/status')
  async updateMemberStatus(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') requesterId: string,
    @CurrentUser('role') role: string,
    @Param('userId') targetUserId: string,
    @Body() body: any
  ) {
    const parse = UpdateMemberStatusDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Status inválido.');
    }
    try {
      const member = await this.accountService.updateMemberStatus(
        accountId,
        requesterId,
        role,
        targetUserId,
        parse.data.status
      );
      return { member };
    } catch (err: any) {
      if (err.message?.includes('Apenas Administradores') || err.message?.includes('Apenas')) {
        throw new ForbiddenException(err.message);
      }
      throw new BadRequestException(err.message || 'Erro ao atualizar status do membro.');
    }
  }

  @Patch('members/:userId/role')
  async updateMemberRole(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') requesterId: string,
    @CurrentUser('role') role: string,
    @Param('userId') targetUserId: string,
    @Body() body: any
  ) {
    const parse = UpdateMemberRoleDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Papel inválido.');
    }
    try {
      const member = await this.accountService.updateMemberRole(
        accountId,
        requesterId,
        role,
        targetUserId,
        parse.data.role
      );
      return { member };
    } catch (err: any) {
      if (err.message?.includes('Apenas')) {
        throw new ForbiddenException(err.message);
      }
      throw new BadRequestException(err.message || 'Erro ao atualizar papel do membro.');
    }
  }

  @Post('downgrade')
  @HttpCode(HttpStatus.OK)
  async changePlan(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('role') role: string,
    @Body() body: any
  ) {
    const parse = ChangePlanDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Plano inválido.');
    }
    try {
      return await this.accountService.changePlan(accountId, role, parse.data.plan);
    } catch (err: any) {
      if (err.message?.includes('Apenas Administradores')) {
        throw new ForbiddenException(err.message);
      }
      throw new BadRequestException(err.message || 'Erro ao alterar plano.');
    }
  }
}
