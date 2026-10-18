import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountModule } from './modules/account/account.module';
import { BillingModule } from './modules/billing/billing.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { MessageModule } from './modules/messages/message.module';
import { FileModule } from './modules/files/file.module';
import { InvitationModule } from './modules/invitations/invitation.module';
import { PollModule } from './modules/polls/poll.module';
import { SignatureModule } from './modules/signatures/signature.module';
import { BroadcastModule } from './modules/broadcasts/broadcast.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { EventsModule } from './modules/events/events.module';
import { AppController } from './app.controller';
import { HealthService } from './services/health.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    AuthModule,
    AccountModule,
    BillingModule,
    ConversationModule,
    MessageModule,
    FileModule,
    InvitationModule,
    PollModule,
    SignatureModule,
    BroadcastModule,
    LgpdModule,
    ObservabilityModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [HealthService],
})
export class AppModule {}
