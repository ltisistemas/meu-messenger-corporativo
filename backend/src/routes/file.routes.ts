import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FileService } from '../services/file.service';
import {
  FileAttachmentItemSchema,
  RequestPresignedUploadDtoSchema,
  ConfirmUploadDtoSchema,
  RequestDownloadUrlDtoSchema,
  ConfirmDownloadDtoSchema,
} from '@/shared';

const ValidateFilesBodySchema = z.object({
  files: z.array(FileAttachmentItemSchema).min(1, 'Pelo menos um arquivo deve ser informado.'),
  recipientUserId: z.string().uuid().optional(),
  isRecipientOnline: z.boolean().optional(),
  recipientName: z.string().optional(),
});

export interface FileRoutesOptions {
  fileService?: FileService;
  fileExpirationService?: import('../jobs/file-expiration.job').FileExpirationService;
}

export const fileRoutes: FastifyPluginAsync<FileRoutesOptions> = async (server, opts) => {
  const fileService = opts.fileService || new FileService();
  const fileExpirationService =
    opts.fileExpirationService ||
    new (await import('../jobs/file-expiration.job')).FileExpirationService();

  // POST /api/files/validate - Validate file batch limits and presence against account plan
  server.post('/validate', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { accountId } = request.user;
    const parsed = ValidateFilesBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        valid: false,
        error: parsed.error.issues[0]?.message || 'Dados inválidos.',
        details: parsed.error.issues,
      });
    }

    const result = await fileService.validateFiles(accountId, {
      files: parsed.data.files,
      recipientUserId: parsed.data.recipientUserId,
      isRecipientOnline: parsed.data.isRecipientOnline,
      recipientName: parsed.data.recipientName,
      requireFiles: true,
    });

    if (!result.valid) {
      const statusCode =
        result.code === 'OFFLINE_RECIPIENT_NOT_ALLOWED' ||
        result.code === 'ACCOUNT_OVER_QUOTA' ||
        result.code === 'ACCOUNT_SUSPENDED'
          ? 403
          : 400;

      return reply.status(statusCode).send(result);
    }

    return reply.status(200).send(result);
  });

  // POST /api/files/upload-url & /api/files/presign-upload - Generate S3 / R2 presigned PUT URL (Pro/Enterprise) (T-19)
  const handlePresignedUpload = async (request: any, reply: any) => {
    const { accountId, userId } = request.user;
    const parsed = RequestPresignedUploadDtoSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error:
          parsed.error.issues[0]?.message || 'Dados inválidos para geração de URL pré-assinada.',
        details: parsed.error.issues,
      });
    }

    try {
      const response = await fileService.requestPresignedUpload(accountId, userId, parsed.data);
      return reply.status(200).send(response);
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === 'PRESIGN_NOT_ALLOWED_ON_FREE' ? 403 : 400);
      return reply.status(statusCode).send({
        error: err.message,
        code: err.code,
        suggestCloudShare: err.suggestCloudShare,
      });
    }
  };

  server.post(
    '/upload-url',
    {
      preHandler: [server.authenticate],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    handlePresignedUpload
  );
  server.post(
    '/presign-upload',
    {
      preHandler: [server.authenticate],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    handlePresignedUpload
  );

  // POST /api/files/confirm-upload - Confirm successful client direct upload (T-19/T-20)
  server.post('/confirm-upload', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { accountId } = request.user;
    const parsed = ConfirmUploadDtoSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message || 'Dados inválidos.',
        details: parsed.error.issues,
      });
    }

    try {
      const transfer = await fileService.confirmUpload(
        accountId,
        parsed.data.transferId,
        parsed.data.messageId
      );
      return reply.status(200).send({
        success: true,
        transfer,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      return reply.status(statusCode).send({
        error: err.message,
        code: err.code,
      });
    }
  });

  // POST /api/files/download-url - Request short-lived pre-signed download URL (T-20)
  server.post('/download-url', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { accountId, userId } = request.user;
    const parsed = RequestDownloadUrlDtoSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error:
          parsed.error.issues[0]?.message || 'Dados inválidos para geração de URL de download.',
        details: parsed.error.issues,
      });
    }

    try {
      const response = await fileService.requestDownloadUrl(
        accountId,
        userId,
        parsed.data.transferId
      );
      return reply.status(200).send(response);
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      return reply.status(statusCode).send({
        error: err.message,
        code: err.code,
      });
    }
  });

  // POST /api/files/confirm-download - Confirm download completion or report interrupted state (T-20/T-21)
  server.post(
    '/confirm-download',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const parsed = ConfirmDownloadDtoSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message || 'Dados inválidos para confirmação de download.',
          details: parsed.error.issues,
        });
      }

      try {
        const result = await fileService.confirmDownload(
          accountId,
          userId,
          parsed.data.transferId,
          {
            completed: parsed.data.completed,
            bytesDownloaded: parsed.data.bytesDownloaded,
          }
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return reply.status(statusCode).send({
          error: err.message,
          code: err.code,
        });
      }
    }
  );

  // GET /api/files/:transferId/status - Check file transfer availability and pending group count (T-21)
  server.get(
    '/:transferId/status',
    { preHandler: [server.authenticate] },
    async (request: any, reply) => {
      const { accountId, userId } = request.user;
      const { transferId } = request.params;

      if (!transferId) {
        return reply.status(400).send({
          error: 'ID da transferência é obrigatório.',
        });
      }

      try {
        const status = await fileService.getTransferStatus(accountId, userId, transferId);
        return reply.status(200).send(status);
      } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return reply.status(statusCode).send({
          error: err.message,
          code: err.code,
        });
      }
    }
  );

  // POST /api/files/sweep-expired - Trigger sweep and deletion of expired files (T-22)
  server.post(
    '/sweep-expired',
    { preHandler: [server.authenticate] },
    async (_request: any, reply) => {
      try {
        const result = await fileExpirationService.sweepExpiredTransfers();
        return reply.status(200).send({
          success: true,
          processedCount: result.processedCount,
          expiredTransferIds: result.expiredTransferIds,
        });
      } catch (err: any) {
        return reply.status(500).send({
          error: err.message || 'Erro ao executar varredura de arquivos expirados.',
        });
      }
    }
  );
};

