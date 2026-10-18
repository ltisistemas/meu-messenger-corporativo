import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from '../../services/message.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  MarkMessagesReadDtoSchema,
  SendTextMessageDtoSchema,
  sanitizeMessageContent,
} from '@/shared';

@Controller('api/messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('conversation/:conversationId')
  async listMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    try {
      const messages = await this.messageService.listMessages(
        accountId,
        userId,
        conversationId,
        limit ? parseInt(limit, 10) : 50,
        offset ? parseInt(offset, 10) : 0
      );
      return { messages };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao carregar mensagens.');
    }
  }

  @Post()
  async sendMessage(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = SendTextMessageDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Mensagem inválida.');
    }
    try {
      const sanitized = sanitizeMessageContent(parse.data.content);
      return await this.messageService.sendMessage(accountId, userId, {
        ...parse.data,
        content: sanitized,
      });
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao enviar mensagem.');
    }
  }

  @Post('read')
  async markRead(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = MarkMessagesReadDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para confirmação de leitura.');
    }
    try {
      return await this.messageService.markConversationAsRead(
        accountId,
        userId,
        parse.data.conversationId,
        parse.data.messageIds
      );
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao marcar mensagens como lidas.');
    }
  }

  @Post('sync')
  async syncOffline(@CurrentUser('userId') userId: string) {
    const synced = await this.messageService.syncOfflineMessages(userId);
    return { syncedCount: synced.length, messages: synced };
  }
}
