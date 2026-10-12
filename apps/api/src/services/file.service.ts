import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db as defaultDb } from '../db/index';
import {
  accounts,
  users,
  fileTransfers,
  fileTransferDownloads,
  conversationMembers,
} from '../db/schema/index';
import {
  FileMetadataInput,
  validateFileLimits,
  validateOfflineRecipient,
  PlanType,
  PresignedUploadResponse,
  DownloadUrlResponse,
  FileTransferStatusResponse,
} from '@corpchat/shared';
import { PresenceService } from './presence.service';
import { StorageService } from './storage.service';

export interface FileValidationOptions {
  files: FileMetadataInput[];
  recipientUserId?: string;
  isRecipientOnline?: boolean;
  recipientName?: string;
  requireFiles?: boolean;
  allowZeroByte?: boolean;
}

export interface FileValidationResponse {
  valid: boolean;
  plan: PlanType;
  error?: string;
  code?: string;
  suggestCloudShare?: boolean;
  details?: any;
}

export interface RequestPresignedUploadOptions {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  conversationId?: string;
  totalRecipientsCount?: number;
}

export class FileService {
  constructor(
    private db = defaultDb,
    private presenceService = new PresenceService(),
    private storageService = new StorageService()
  ) {}

  /**
   * Validates file upload limits and offline recipient rules against the organization's plan
   */
  async validateFiles(
    accountId: string,
    options: FileValidationOptions
  ): Promise<FileValidationResponse> {
    const {
      files,
      recipientUserId,
      isRecipientOnline,
      recipientName,
      requireFiles = true,
      allowZeroByte = true,
    } = options;

    // 1. Fetch account and plan
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      return {
        valid: false,
        plan: 'free',
        code: 'ACCOUNT_NOT_FOUND',
        error: 'Organização não encontrada.',
      };
    }

    if (account.status === 'suspended') {
      return {
        valid: false,
        plan: account.plan as PlanType,
        code: 'ACCOUNT_SUSPENDED',
        error: 'Esta organização está suspensa.',
      };
    }

    if (account.status === 'over_quota') {
      return {
        valid: false,
        plan: account.plan as PlanType,
        code: 'ACCOUNT_OVER_QUOTA',
        error: 'A organização atingiu o limite do plano e está em modo somente leitura.',
      };
    }

    const plan = account.plan as PlanType;

    // 2. Validate file size and count limits
    const fileLimitsResult = validateFileLimits(plan, files, {
      requireFiles,
      allowZeroByte,
    });

    if (!fileLimitsResult.valid) {
      return {
        valid: false,
        plan,
        code: fileLimitsResult.code,
        error: fileLimitsResult.error,
        suggestCloudShare: fileLimitsResult.suggestCloudShare,
        details: fileLimitsResult.details,
      };
    }

    // 3. If recipient is specified or presence status is provided, validate offline rule for Free plan
    let recipientOnlineStatus = isRecipientOnline;
    let targetRecipientName = recipientName;

    if (recipientUserId && recipientOnlineStatus === undefined) {
      recipientOnlineStatus = await this.presenceService.isUserOnline(recipientUserId);
      if (!targetRecipientName) {
        const recipientUser = await this.db.query.users.findFirst({
          where: eq(users.id, recipientUserId),
        });
        targetRecipientName = recipientUser?.name || undefined;
      }
    }

    if (recipientOnlineStatus !== undefined) {
      const recipientCheck = validateOfflineRecipient(
        plan,
        recipientOnlineStatus,
        targetRecipientName
      );

      if (!recipientCheck.allowed) {
        return {
          valid: false,
          plan,
          code: recipientCheck.code,
          error: recipientCheck.error,
        };
      }
    }

    return {
      valid: true,
      plan,
      details: {
        filesCount: files.length,
        totalSize: files.reduce((acc, f) => acc + (f.size || 0), 0),
      },
    };
  }

  /**
   * Generates a pre-signed S3 / R2 upload URL for Pro and Enterprise plans (T-19)
   * Enforces plan restrictions (blocks Free accounts), SSE encryption, and size limit <= 25 MB
   */
  async requestPresignedUpload(
    accountId: string,
    uploaderId: string,
    options: RequestPresignedUploadOptions
  ): Promise<PresignedUploadResponse> {
    const {
      fileName,
      fileSize,
      mimeType = 'application/octet-stream',
      conversationId,
      totalRecipientsCount,
    } = options;

    // 1. Fetch account and verify plan
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      const err: any = new Error('Organização não encontrada.');
      err.statusCode = 404;
      err.code = 'ACCOUNT_NOT_FOUND';
      throw err;
    }

    if (account.status === 'suspended') {
      const err: any = new Error('Esta organização está suspensa.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_SUSPENDED';
      throw err;
    }

    if (account.status === 'over_quota') {
      const err: any = new Error('A organização atingiu o limite de usuários e está em modo somente leitura.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_OVER_QUOTA';
      throw err;
    }

    // Free plan is strictly forbidden from S3 direct uploads
    if (account.plan === 'free') {
      const err: any = new Error(
        'Plano Free utiliza relay em memória via WebSocket. Faça upgrade para Pro/Enterprise para upload em nuvem.'
      );
      err.statusCode = 403;
      err.code = 'PRESIGN_NOT_ALLOWED_ON_FREE';
      throw err;
    }

    const plan = account.plan as PlanType;

    // 2. Validate file limits
    const limitCheck = validateFileLimits(plan, [{ name: fileName, size: fileSize, mimeType }]);
    if (!limitCheck.valid) {
      const err: any = new Error(limitCheck.error || 'Arquivo não permitido.');
      err.statusCode = 400;
      err.code = limitCheck.code;
      err.suggestCloudShare = limitCheck.suggestCloudShare;
      throw err;
    }

    // 3. Determine pending downloads count based on conversation active members
    let pendingDownloads = totalRecipientsCount || 1;
    if (conversationId) {
      const members = await this.db.query.conversationMembers.findMany({
        where: eq(conversationMembers.conversationId, conversationId),
      });

      if (members.length > 0) {
        const otherMembers = members.filter((m) => m.userId !== uploaderId);
        pendingDownloads = otherMembers.length > 0 ? otherMembers.length : 1;
      }
    }

    // 4. Create transfer record & expiration (5 days)
    const transferId = crypto.randomUUID();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `accounts/${accountId}/transfers/${transferId}/${sanitizedFileName}`;
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days retention

    // 5. Generate pre-signed PUT URL with SSE
    const presigned = await this.storageService.generatePresignedUploadUrl({
      storageKey,
      mimeType,
      fileSize,
      expiresInSeconds: 900, // 15 minutes
    });

    // 6. Save in DB with total recipients and pending counts
    await this.db.insert(fileTransfers).values({
      id: transferId,
      accountId,
      conversationId: conversationId || null,
      uploaderId,
      fileName,
      fileSize,
      mimeType,
      storageKey,
      expiresAt,
      totalRecipientsCount: pendingDownloads,
      pendingDownloadsCount: pendingDownloads,
      status: 'pending',
    });

    return {
      transferId,
      uploadUrl: presigned.uploadUrl,
      storageKey,
      expiresAt: presigned.expiresAt.toISOString(),
      headers: presigned.headers,
      maxSizeBytes: 25 * 1024 * 1024,
    };
  }

  /**
   * Confirms client has finished direct S3 upload (T-19/T-20)
   */
  async confirmUpload(
    accountId: string,
    transferId: string,
    messageId?: string
  ) {
    const transfer = await this.db.query.fileTransfers.findFirst({
      where: and(
        eq(fileTransfers.id, transferId),
        eq(fileTransfers.accountId, accountId)
      ),
    });

    if (!transfer) {
      const err: any = new Error('Transferência de arquivo não encontrada.');
      err.statusCode = 404;
      err.code = 'FILE_TRANSFER_NOT_FOUND';
      throw err;
    }

    const [updated] = await this.db
      .update(fileTransfers)
      .set({
        status: 'uploaded',
        messageId: messageId || transfer.messageId,
        updatedAt: new Date(),
      })
      .where(eq(fileTransfers.id, transferId))
      .returning();

    return updated;
  }

  /**
   * Generates a short-lived pre-signed GET URL (5 to 15 min) for downloading a file (T-20)
   */
  async requestDownloadUrl(
    accountId: string,
    userId: string,
    transferId: string
  ): Promise<DownloadUrlResponse> {
    const transfer = await this.db.query.fileTransfers.findFirst({
      where: and(
        eq(fileTransfers.id, transferId),
        eq(fileTransfers.accountId, accountId)
      ),
    });

    if (!transfer) {
      const err: any = new Error('Arquivo não encontrado nesta organização.');
      err.statusCode = 404;
      err.code = 'FILE_NOT_FOUND';
      throw err;
    }

    if (transfer.status === 'deleted' || (transfer.status === 'completed' && transfer.pendingDownloadsCount === 0)) {
      const err: any = new Error('Este arquivo já foi baixado por todos os destinatários ou foi excluído.');
      err.statusCode = 410;
      err.code = 'FILE_ALREADY_DELETED';
      throw err;
    }

    if (transfer.status === 'expired' || (transfer.expiresAt && new Date(transfer.expiresAt) < new Date())) {
      const err: any = new Error('Este arquivo expirou após o prazo de retenção de 5 dias.');
      err.statusCode = 410;
      err.code = 'FILE_EXPIRED';
      throw err;
    }

    // Verify conversation access if transfer is associated with a conversation
    if (transfer.conversationId) {
      const isMember = await this.db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, transfer.conversationId),
          eq(conversationMembers.userId, userId)
        ),
      });

      if (!isMember && transfer.uploaderId !== userId) {
        const err: any = new Error('Você não tem permissão para acessar este arquivo.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_FILE_ACCESS';
        throw err;
      }
    }

    // Generate short-lived download URL (15 minutes = 900 seconds)
    const downloadUrl = await this.storageService.generatePresignedDownloadUrl(
      transfer.storageKey,
      900
    );

    const expiresAt = new Date(Date.now() + 900 * 1000).toISOString();

    return {
      transferId: transfer.id,
      downloadUrl,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      mimeType: transfer.mimeType,
      expiresAt,
    };
  }

  /**
   * Confirms client download status: tracks recipient downloads in groups (T-21) and deletes object
   * only when the last pending recipient finishes download (T-20/T-21).
   * Interrupted downloads or duplicate confirmations from the same user do NOT delete or double-decrement.
   */
  async confirmDownload(
    accountId: string,
    userId: string,
    transferId: string,
    options: { completed?: boolean; bytesDownloaded?: number } = { completed: true }
  ) {
    const { completed = true } = options;

    const transfer = await this.db.query.fileTransfers.findFirst({
      where: and(
        eq(fileTransfers.id, transferId),
        eq(fileTransfers.accountId, accountId)
      ),
    });

    if (!transfer) {
      const err: any = new Error('Transferência de arquivo não encontrada.');
      err.statusCode = 404;
      err.code = 'FILE_TRANSFER_NOT_FOUND';
      throw err;
    }

    // If download was interrupted or failed on client, keep file in bucket intact
    if (!completed) {
      return {
        success: true,
        transferId: transfer.id,
        status: transfer.status,
        pendingDownloadsCount: transfer.pendingDownloadsCount,
        deletedFromStorage: false,
        interrupted: true,
      };
    }

    // If already deleted/completed with 0 pending
    if (transfer.status === 'deleted' || (transfer.status === 'completed' && transfer.pendingDownloadsCount <= 0)) {
      return {
        success: true,
        transferId: transfer.id,
        status: transfer.status,
        pendingDownloadsCount: 0,
        deletedFromStorage: true,
      };
    }

    // Check if user has already confirmed download for this transfer (deduplication in groups - T-21)
    const existingDownload = this.db.query.fileTransferDownloads
      ? await this.db.query.fileTransferDownloads.findFirst({
          where: and(
            eq(fileTransferDownloads.transferId, transferId),
            eq(fileTransferDownloads.userId, userId)
          ),
        })
      : null;

    if (existingDownload) {
      return {
        success: true,
        transferId: transfer.id,
        alreadyDownloaded: true,
        status: transfer.status,
        pendingDownloadsCount: transfer.pendingDownloadsCount,
        deletedFromStorage: transfer.status === 'completed' || transfer.pendingDownloadsCount <= 0,
      };
    }

    // Record user download in fileTransferDownloads
    try {
      await this.db.insert(fileTransferDownloads).values({
        transferId,
        userId,
        downloadedAt: new Date(),
      });
    } catch (_) {}

    const nextPendingCount = Math.max(0, transfer.pendingDownloadsCount - 1);

    // If all recipients have downloaded, delete object from bucket (T-20/T-21)
    if (nextPendingCount === 0) {
      await this.storageService.deleteObject(transfer.storageKey);

      const [updated] = await this.db
        .update(fileTransfers)
        .set({
          status: 'completed',
          pendingDownloadsCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(fileTransfers.id, transferId))
        .returning();

      return {
        success: true,
        transferId: transfer.id,
        status: updated?.status || 'completed',
        pendingDownloadsCount: 0,
        deletedFromStorage: true,
      };
    }

    // Multiple recipients pending in group (T-21): decrement counter, keep object in bucket
    const [updated] = await this.db
      .update(fileTransfers)
      .set({
        pendingDownloadsCount: nextPendingCount,
        updatedAt: new Date(),
      })
      .where(eq(fileTransfers.id, transferId))
      .returning();

    return {
      success: true,
      transferId: transfer.id,
      status: updated?.status || transfer.status,
      pendingDownloadsCount: nextPendingCount,
      deletedFromStorage: false,
    };
  }

  /**
   * Retrieves live status of a file transfer including group pending counts (T-21)
   */
  async getTransferStatus(
    accountId: string,
    userId: string,
    transferId: string
  ): Promise<FileTransferStatusResponse> {
    const transfer = await this.db.query.fileTransfers.findFirst({
      where: and(
        eq(fileTransfers.id, transferId),
        eq(fileTransfers.accountId, accountId)
      ),
    });

    if (!transfer) {
      const err: any = new Error('Transferência de arquivo não encontrada.');
      err.statusCode = 404;
      err.code = 'FILE_TRANSFER_NOT_FOUND';
      throw err;
    }

    if (transfer.conversationId) {
      const isMember = await this.db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, transfer.conversationId),
          eq(conversationMembers.userId, userId)
        ),
      });

      if (!isMember && transfer.uploaderId !== userId) {
        const err: any = new Error('Você não tem permissão para consultar este arquivo.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_FILE_ACCESS';
        throw err;
      }
    }

    const downloadedCount = Math.max(0, transfer.totalRecipientsCount - transfer.pendingDownloadsCount);
    const isAvailable =
      (transfer.status === 'uploaded' || transfer.status === 'pending') &&
      transfer.pendingDownloadsCount > 0 &&
      new Date(transfer.expiresAt) > new Date();

    return {
      transferId: transfer.id,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      mimeType: transfer.mimeType,
      status: transfer.status as any,
      totalRecipientsCount: transfer.totalRecipientsCount,
      pendingDownloadsCount: transfer.pendingDownloadsCount,
      downloadedCount,
      isAvailable,
      expiresAt: transfer.expiresAt.toISOString(),
    };
  }
}
