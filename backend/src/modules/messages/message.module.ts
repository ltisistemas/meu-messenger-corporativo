import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from '../../services/message.service';

@Module({
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
