import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from '../../services/invitation.service';

@Module({
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
