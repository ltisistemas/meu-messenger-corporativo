import { Module } from '@nestjs/common';
import { SignatureController } from './signature.controller';
import { SignatureService } from '../../services/signature.service';
import { ClicksignProviderService } from '../../services/clicksign.service';

@Module({
  controllers: [SignatureController],
  providers: [SignatureService, ClicksignProviderService],
  exports: [SignatureService, ClicksignProviderService],
})
export class SignatureModule {}
