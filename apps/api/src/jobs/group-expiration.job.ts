import { Queue, Worker, Job } from 'bullmq';
import { lte, and, eq } from 'drizzle-orm';
import { Server } from 'socket.io';
import { db as defaultDb } from '../db/index';
import { conversations } from '../db/schema/index';
import { getRedisConnectionOptions } from './connection';
import { WS_EVENTS } from '../ws/events';

export const GROUP_EXPIRATION_QUEUE_NAME = 'group-expiration-queue';

export interface GroupExpirationJobData {
  conversationId: string;
  accountId?: string;
}

export interface SweepGroupsResult {
  processedCount: number;
  expiredGroupIds: string[];
}

export class GroupExpirationService {
  private queue: Queue<GroupExpirationJobData> | null = null;
  private worker: Worker<GroupExpirationJobData> | null = null;

  constructor(
    private db = defaultDb,
    private io?: Server,
    enableBullMQ = false
  ) {
    if (enableBullMQ && process.env.NODE_ENV !== 'test') {
      this.initQueue();
    }
  }

  setIoServer(io: Server) {
    this.io = io;
  }

  private initQueue() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const connection = getRedisConnectionOptions();
      this.queue = new Queue(GROUP_EXPIRATION_QUEUE_NAME, {
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
   * Starts a BullMQ worker to process scheduled group expiration jobs (T-24)
   */
  startWorker(): Worker<GroupExpirationJobData> {
    const connection = getRedisConnectionOptions();
    this.worker = new Worker<GroupExpirationJobData>(
      GROUP_EXPIRATION_QUEUE_NAME,
      async (job: Job<GroupExpirationJobData>) => {
        await this.expireSingleGroup(job.data.conversationId);
      },
      { connection }
    );

    return this.worker;
  }

  /**
   * Sweeps and archives all temporary groups that have reached or passed their expiration timestamp (T-24)
   */
  async sweepExpiredGroups(asOfDate: Date = new Date()): Promise<SweepGroupsResult> {
    const expiredList = await this.db.query.conversations.findMany({
      where: and(
        eq(conversations.isTemporary, true),
        eq(conversations.status, 'active'),
        lte(conversations.expiresAt, asOfDate)
      ),
    });

    const expiredGroupIds: string[] = [];

    for (const group of expiredList) {
      await this.expireSingleGroup(group.id);
      expiredGroupIds.push(group.id);
    }

    return {
      processedCount: expiredGroupIds.length,
      expiredGroupIds,
    };
  }

  /**
   * Expires a single temporary group: marks status as 'archived_readonly' and emits real-time WebSocket notification (T-24)
   */
  async expireSingleGroup(conversationId: string) {
    const group = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!group) {
      return { success: false, reason: 'CONVERSATION_NOT_FOUND' };
    }

    // If already archived as read-only, do not duplicate
    if (group.status === 'archived_readonly') {
      return {
        success: true,
        conversationId,
        alreadyProcessed: true,
        status: group.status,
      };
    }

    // Update conversation status to 'archived_readonly'
    const [updated] = await this.db
      .update(conversations)
      .set({
        status: 'archived_readonly',
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    // Broadcast WebSocket event to active conversation participants and account room
    if (this.io) {
      const payload = {
        conversationId,
        accountId: group.accountId,
        status: 'archived_readonly',
        isTemporary: true,
        expiresAt: group.expiresAt?.toISOString() || null,
        message: 'Este grupo temporário expirou e agora está em modo somente leitura.',
      };

      this.io.to(`conversation:${conversationId}`).emit(WS_EVENTS.CONVERSATION_ARCHIVED, payload);
      this.io.to(`account:${group.accountId}`).emit(WS_EVENTS.CONVERSATION_ARCHIVED, payload);
    }

    return {
      success: true,
      conversationId,
      status: updated?.status || 'archived_readonly',
      archivedAt: new Date(),
    };
  }

  /**
   * Schedules a delayed BullMQ job to expire a temporary group at the designated expiration date/time (T-24)
   */
  async scheduleGroupExpiration(
    conversationId: string,
    expiresAt: Date | string | number
  ): Promise<boolean> {
    const expirationDate = new Date(expiresAt);
    const delayMs = Math.max(0, expirationDate.getTime() - Date.now());

    if (!this.queue) {
      this.initQueue();
    }

    if (this.queue) {
      try {
        await this.queue.add(
          'expire-group-job',
          { conversationId },
          {
            delay: delayMs,
            jobId: `expire-group-${conversationId}`,
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
   * Closes BullMQ queue and worker gracefully
   */
  async close() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
