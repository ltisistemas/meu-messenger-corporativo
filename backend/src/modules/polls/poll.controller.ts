import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PollService } from '../../services/poll.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePollDtoSchema, VotePollDtoSchema, sanitizeText } from '@/shared';

@Controller('api/polls')
@UseGuards(JwtAuthGuard)
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Post()
  async createPoll(
    @CurrentUser('userId') userId: string,
    @CurrentUser('accountId') accountId: string,
    @Body() body: any
  ) {
    const parse = CreatePollDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para criação da enquete.');
    }
    try {
      const sanitized = {
        ...parse.data,
        question: sanitizeText(parse.data.question),
        options: parse.data.options.map((opt) => sanitizeText(opt)),
      };
      return await this.pollService.createPoll(accountId, userId, sanitized);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao criar enquete.');
    }
  }

  @Get(':pollId')
  async getPoll(
    @Param('pollId') pollId: string,
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string
  ) {
    try {
      return await this.pollService.getPollDetails(accountId, userId, pollId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao buscar enquete.');
    }
  }

  @Post(':pollId/vote')
  async vote(
    @Param('pollId') pollId: string,
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = VotePollDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados de votação inválidos.');
    }
    try {
      return await this.pollService.votePoll(accountId, userId, pollId, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao votar.');
    }
  }

  @Post(':pollId/close')
  async close(
    @Param('pollId') pollId: string,
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string
  ) {
    try {
      return await this.pollService.closePoll(accountId, userId, role, pollId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao encerrar enquete.');
    }
  }
}
