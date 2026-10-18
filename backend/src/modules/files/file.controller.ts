import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FileService } from '../../services/file.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ConfirmDownloadDtoSchema,
  ConfirmUploadDtoSchema,
  RequestDownloadUrlDtoSchema,
  RequestPresignedUploadDtoSchema,
} from '@/shared';

@Controller('api/files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('presign-upload')
  async presignUpload(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = RequestPresignedUploadDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para upload.');
    }
    try {
      return await this.fileService.requestPresignedUpload(accountId, userId, parse.data);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao gerar URL de upload.');
    }
  }

  @Post('confirm-upload')
  async confirmUpload(
    @CurrentUser('accountId') accountId: string,
    @Body() body: any
  ) {
    const parse = ConfirmUploadDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para confirmação de upload.');
    }
    try {
      const transfer = await this.fileService.confirmUpload(
        accountId,
        parse.data.transferId,
        parse.data.messageId
      );
      return { success: true, transfer };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao confirmar upload.');
    }
  }

  @Post('download-url')
  async downloadUrl(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = RequestDownloadUrlDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para download.');
    }
    try {
      return await this.fileService.requestDownloadUrl(
        accountId,
        userId,
        parse.data.transferId
      );
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao obter link de download.');
    }
  }

  @Post('confirm-download')
  async confirmDownload(
    @CurrentUser('accountId') accountId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any
  ) {
    const parse = ConfirmDownloadDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException('Dados inválidos para confirmação de download.');
    }
    try {
      return await this.fileService.confirmDownload(
        accountId,
        userId,
        parse.data.transferId,
        {
          completed: parse.data.completed,
          bytesDownloaded: parse.data.bytesDownloaded,
        }
      );
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao confirmar download.');
    }
  }
}
