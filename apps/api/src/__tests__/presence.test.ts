import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresenceService } from '../services/presence.service';
import { WS_EVENTS } from '../ws/events';

describe('Presence Online/Offline System (T-07)', () => {
  let mockRedis: any;
  let mockIo: any;
  let mockDb: any;
  let presenceService: PresenceService;

  const accountId = 'acc-test-123';
  const userId = 'usr-test-456';
  const socketId1 = 'socket-tab-1';
  const socketId2 = 'socket-tab-2';

  beforeEach(() => {
    const store = new Map<string, any>();

    mockRedis = {
      sadd: vi.fn(async (key: string, val: string) => {
        if (!store.has(key)) store.set(key, new Set<string>());
        store.get(key).add(val);
        return 1;
      }),
      srem: vi.fn(async (key: string, val: string) => {
        if (store.has(key)) {
          store.get(key).delete(val);
        }
        return 1;
      }),
      scard: vi.fn(async (key: string) => {
        return store.has(key) ? store.get(key).size : 0;
      }),
      set: vi.fn(async (key: string, val: string) => {
        store.set(key, val);
        return 'OK';
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
      exists: vi.fn(async (key: string) => {
        return store.has(key) ? 1 : 0;
      }),
      expire: vi.fn(async () => 1),
      smembers: vi.fn(async (key: string) => {
        return store.has(key) ? Array.from(store.get(key)) : [];
      }),
      pipeline: vi.fn(() => ({
        exists: vi.fn(),
        exec: vi.fn(async () => [
          [null, 1], // user 1 is online
          [null, 0], // user 2 is offline
        ]),
      })),
    };

    mockIo = {
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
    };

    mockDb = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({}),
        })),
      })),
    };

    presenceService = new PresenceService(mockRedis, mockIo, mockDb);
  });

  it('should set user online and broadcast presence:online to account room on first connection', async () => {
    await presenceService.setUserOnline(accountId, userId, socketId1);

    expect(mockRedis.sadd).toHaveBeenCalledWith(`user:sockets:${userId}`, socketId1);
    expect(mockRedis.set).toHaveBeenCalledWith(`presence:${userId}`, 'online', 'EX', 35);
    expect(mockIo.to).toHaveBeenCalledWith(`account:${accountId}`);
  });

  it('should not broadcast duplicate presence:online when user opens a second tab', async () => {
    // First connection
    await presenceService.setUserOnline(accountId, userId, socketId1);
    expect(mockIo.to).toHaveBeenCalledTimes(1);

    // Second connection from same user
    await presenceService.setUserOnline(accountId, userId, socketId2);
    // Should still have been called only once
    expect(mockIo.to).toHaveBeenCalledTimes(1);
  });

  it('should keep user online if only one of two tabs is closed', async () => {
    await presenceService.setUserOnline(accountId, userId, socketId1);
    await presenceService.setUserOnline(accountId, userId, socketId2);

    // Close first socket
    await presenceService.setUserOffline(accountId, userId, socketId1);

    // User should still be online because socketId2 remains
    expect(await presenceService.isUserOnline(userId)).toBe(true);
    expect(mockRedis.del).not.toHaveBeenCalledWith(`presence:${userId}`);
  });

  it('should set user offline, update DB lastSeenAt, and broadcast presence:offline when last socket disconnects', async () => {
    await presenceService.setUserOnline(accountId, userId, socketId1);

    // Close last socket
    await presenceService.setUserOffline(accountId, userId, socketId1);

    expect(mockRedis.del).toHaveBeenCalledWith(`presence:${userId}`);
    expect(mockRedis.srem).toHaveBeenCalledWith(`account:online:${accountId}`, userId);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockIo.to).toHaveBeenCalledWith(`account:${accountId}`);
  });

  it('heartbeat should renew presence TTL', async () => {
    await presenceService.heartbeat(userId);
    expect(mockRedis.expire).toHaveBeenCalledWith(`presence:${userId}`, 35);
  });

  it('getUsersPresence should query batch user presence in pipeline', async () => {
    const result = await presenceService.getUsersPresence(['user-1', 'user-2']);
    expect(result['user-1']).toBe(true);
    expect(result['user-2']).toBe(false);
  });
});
