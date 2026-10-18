import Redis from 'ioredis';
import { Server } from 'socket.io';
import { eq } from 'drizzle-orm';
import { redis as defaultRedis } from '../db/redis';
import { db as defaultDb } from '../db/index';
import { users } from '../db/schema/index';
import { WS_EVENTS } from '../ws/events';

const PRESENCE_TTL_SECONDS = 35;

export class PresenceService {
  constructor(
    private redis: Redis = defaultRedis,
    private io?: Server,
    private db = defaultDb
  ) {}

  setIoServer(io: Server) {
    this.io = io;
  }

  private userSocketsKey(userId: string): string {
    return `user:sockets:${userId}`;
  }

  private presenceKey(userId: string): string {
    return `presence:${userId}`;
  }

  private accountOnlineKey(accountId: string): string {
    return `account:online:${accountId}`;
  }

  /**
   * Registers a socket connection as online for a user
   */
  async setUserOnline(accountId: string, userId: string, socketId: string) {
    const socketsKey = this.userSocketsKey(userId);
    const presenceKey = this.presenceKey(userId);
    const accountKey = this.accountOnlineKey(accountId);

    try {
      // Add socket to set
      await this.redis.sadd(socketsKey, socketId);
      await this.redis.expire(socketsKey, PRESENCE_TTL_SECONDS * 2);

      // Set online flag with TTL
      const wasOnline = await this.redis.exists(presenceKey);
      await this.redis.set(presenceKey, 'online', 'EX', PRESENCE_TTL_SECONDS);

      // Add to account online members
      await this.redis.sadd(accountKey, userId);

      // Broadcast online event to the organization if this is user's first active connection
      if (!wasOnline && this.io) {
        this.io.to(`account:${accountId}`).emit(WS_EVENTS.PRESENCE_ONLINE, {
          userId,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn(`[PresenceService] setUserOnline error: ${err.message}`);
    }
  }

  /**
   * Handles socket disconnection and sets user offline when all sockets close
   */
  async setUserOffline(accountId: string, userId: string, socketId: string) {
    const socketsKey = this.userSocketsKey(userId);
    const presenceKey = this.presenceKey(userId);
    const accountKey = this.accountOnlineKey(accountId);

    try {
      // Remove this socket
      await this.redis.srem(socketsKey, socketId);
      const remainingSockets = await this.redis.scard(socketsKey);

      // If user has no other open tabs/devices, mark as offline
      if (remainingSockets === 0) {
        await this.redis.del(presenceKey);
        await this.redis.srem(accountKey, userId);

        const now = new Date();

        // Update database lastSeenAt
        try {
          await this.db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId));
        } catch {
          // DB update failure during offline shouldn't break realtime
        }

        // Broadcast offline event to the organization
        if (this.io) {
          this.io.to(`account:${accountId}`).emit(WS_EVENTS.PRESENCE_OFFLINE, {
            userId,
            status: 'offline',
            lastSeenAt: now.toISOString(),
            timestamp: now.toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.warn(`[PresenceService] setUserOffline error: ${err.message}`);
    }
  }

  /**
   * Renews presence TTL on heartbeat ping
   */
  async heartbeat(userId: string) {
    try {
      await this.redis.expire(this.presenceKey(userId), PRESENCE_TTL_SECONDS);
      await this.redis.expire(this.userSocketsKey(userId), PRESENCE_TTL_SECONDS * 2);
    } catch (err: any) {
      console.warn(`[PresenceService] heartbeat error: ${err.message}`);
    }
  }

  /**
   * Checks if a single user is currently online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(this.presenceKey(userId));
      return exists === 1;
    } catch {
      return false;
    }
  }

  /**
   * Gets list of all user IDs currently online in an account
   */
  async getOnlineUsers(accountId: string): Promise<string[]> {
    try {
      return await this.redis.smembers(this.accountOnlineKey(accountId));
    } catch {
      return [];
    }
  }

  /**
   * Checks presence status for a batch of users
   */
  async getUsersPresence(userIds: string[]): Promise<Record<string, boolean>> {
    if (userIds.length === 0) return {};

    const result: Record<string, boolean> = {};

    try {
      const pipeline = this.redis.pipeline();
      for (const id of userIds) {
        pipeline.exists(this.presenceKey(id));
      }
      const responses = await pipeline.exec();

      if (responses) {
        userIds.forEach((id, index) => {
          const res = responses[index];
          const isOnline = Boolean(res && res[1] === 1);
          result[id] = isOnline;
        });
      }
    } catch {
      for (const id of userIds) {
        result[id] = false;
      }
    }

    return result;
  }
}
