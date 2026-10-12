import { Queue, Worker, Job } from 'bullmq';
import { lte, and, inArray, eq } from 'drizzle-orm';
import { db as defaultDb } from '../db/index';
import { fileTransfers } from '../db/schema/index';
import { StorageService } from '../services/storage.service';
import { getRedisConnectionOptions } from './connection';

export const FILE_EXPIRATION_QUEUE_NAME = 'file-expiration-queue';

export interface FileExpirationJobData {
  transferId: string;
  accountId?: string;
}

export interface SweepResult {
  processedCount: number;
  expiredTransferIds: string[];
}

export class FileExpirationService {
  private queue: Queue<FileExpirationJobData> | null = null;
  private worker: Worker<FileExpirationJobData> | null = null;

  constructor(
    private db = defaultDb,
    private storageService = new StorageService(),
    enableBullMQ = false
  ) {
    if (enableBullMQ && process.env.NODE_ENV !== 'test') {
      this.initQueue();
    }
  }

  private initQueue() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const connection = getRedisConnectionOptions();
      this.queue = new Queue(FILE_EXPIRATION_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 1000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      });
    } catch (_) {}
  }

  /**
   * Starts a BullMQ worker to process scheduled delayed file expirations
   */
  startWorker(): Worker<FileExpirationJobData> {
    const connection = getRedisConnectionOptions();
    this.worker = new Worker<FileExpirationJobData>(
      FILE_EXPIRATION_QUEUE_NAME,
      async (job: Job<FileExpirationJobData>) => {
        await this.expireSingleTransfer(job.data.transferId);
      },
      { connection }
    );

    return this.worker;
  }

  /**
   * Sweeps and expires all files that have reached or passed their expiration timestamp (T-22)
   */
  async sweepExpiredTransfers(asOfDate: Date = new Date()): Promise<SweepResult> {
    // 1. Find all active or pending transfers where expiresAt <= asOfDate
    const expiredList = await this.db.query.fileTransfers.findMany({
      where: and(
        lte(fileTransfers.expiresAt, asOfDate),
        inArray(fileTransfers.status, ['pending', 'uploaded'])
      ),
    });

    const expiredIds: string[] = [];

    // 2. Delete storage objects and update status to expired
    for (const transfer of expiredList) {
      try {
        await this.storageService.deleteObject(transfer.storageKey);
      } catch (_) {}

      await this.db
        .update(fileTransfers)
        .set({
          status: 'expired',
          pendingDownloadsCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(fileTransfers.id, transfer.id));

      expiredIds.push(transfer.id);
    }

    return {
      processedCount: expiredIds.length,
      expiredTransferIds: expiredIds,
    };
  }

  /**
   * Expires a single file transfer by ID and deletes its object from S3/R2 storage (T-22)
   */
  async expireSingleTransfer(transferId: string) {
    const transfer = await this.db.query.fileTransfers.findFirst({
      where: eq(fileTransfers.id, transferId),
    });

    if (!transfer) {
      return { success: false, reason: 'FILE_TRANSFER_NOT_FOUND' };
    }

    // If already deleted, completed or expired, do not double-process
    if (['completed', 'deleted', 'expired'].includes(transfer.status)) {
      return {
        success: true,
        transferId,
        alreadyProcessed: true,
        status: transfer.status,
      };
    }

    // Delete object from S3/R2 bucket
    await this.storageService.deleteObject(transfer.storageKey);

    // Update status in DB
    const [updated] = await this.db
      .update(fileTransfers)
      .set({
        status: 'expired',
        pendingDownloadsCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(fileTransfers.id, transferId))
      .returning();

    return {
      success: true,
      transferId,
      deletedFromStorage: true,
      status: updated?.status || 'expired',
    };
  }

  /**
   * Schedules a delayed job via BullMQ to expire a file transfer after delayMs (T-22)
   * Default: 5 days = 5 * 24 * 60 * 60 * 1000 ms
   */
  async scheduleExpirationJob(
    transferId: string,
    delayMs = 5 * 24 * 60 * 60 * 1000
  ): Promise<boolean> {
    if (!this.queue) {
      this.initQueue();
    }

    if (this.queue) {
      try {
        await this.queue.add(
          'expire-file-job',
          { transferId },
          {
            delay: delayMs,
            jobId: `expire-${transferId}`,
          }
        );
        return true;
      } catch (_) {
        return false;
      }
    }

    return false;
  }

  /**
   * S3 / Cloudflare R2 bucket lifecycle policy definition as a backup retention layer (T-22)
   */
  getBucketLifecyclePolicyConfig() {
    return {
      Rules: [
        {
          ID: 'NextMsg-5-Day-File-Retention-Backup',
          Status: 'Enabled',
          Filter: {
            Prefix: 'accounts/',
          },
          Expiration: {
            Days: 5,
          },
        },
      ],
    };
  }

  /**
   * Closes queue and worker connections gracefully
   */
  async close() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
