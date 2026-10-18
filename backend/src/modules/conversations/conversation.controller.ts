import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConversationService } from '../../services/conversation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateDirectConversationDtoSchema,
  CreateGroupConversationDtoSchema,
} from '@/shared';

@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async listUserConversations(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string
  ) {
    const conversations = await this.conversationService.listUserConversations(accountId, userId);
    return { conversations };
  }

  @Post('direct')
  async createDirect(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = CreateDirectConversationDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para conversa direta.');
    }
    try {
      return await this.conversationService.getOrCreateDirectConversation(
        accountId,
        userId,
        parse.data.targetUserId
      );
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Falha ao iniciar conversa direta.');
    }
  }

  @Post('group')
  async createGroup(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = CreateGroupConversationDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para criação do grupo.');
    }
    try {
      return await this.conversationService.createGroup(accountId, userId, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Falha ao criar grupo.');
    }
  }

  @Get(':conversationId')
  async getDetails(
    @Param('conversationId') conversationId: string,
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string
  ) {
    try {
      return await this.conversationService.getConversationDetails(
        accountId,
        userId,
        conversationId
      );
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao buscar conversa.');
    }
  }
}
