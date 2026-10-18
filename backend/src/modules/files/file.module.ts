import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from '../../services/file.service';
import { FileRelayService } from '../../services/file-relay.service';
import { StorageService } from '../../services/storage.service';

@Module({
  controllers: [FileController],
  providers: [FileService, FileRelayService, StorageService],
  exports: [FileService, FileRelayService, StorageService],
})
export class FileModule {}
