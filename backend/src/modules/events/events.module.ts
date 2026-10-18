import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { PresenceService } from '../../services/presence.service';
import { MessageService } from '../../services/message.service';
import { FileRelayService } from '../../services/file-relay.service';

@Module({
  providers: [EventsGateway, PresenceService, MessageService, FileRelayService],
  exports: [EventsGateway, PresenceService],
})
export class EventsModule {}
