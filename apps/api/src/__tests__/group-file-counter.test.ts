import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileService } from '../services/file.service';
import { buildServer } from '../server';

describe('Group File Transfer Pending Counter & Last Recipient Deletion (T-21)', () => {
  const accountId = 'acc-pro-222';
  const uploaderId = 'usr-uploader-000';
  const member1Id = 'usr-member-001';
  const member2Id = 'usr-member-002';
  const member3Id = 'usr-member-003';
  const member4Id = 'usr-member-004';
  const conversationId = 'c0000000-0000-0000-0000-000000000005';

  const transferId = 'd0000000-0000-0000-0000-000000000055';

  let mockDb: any;
  let mockPresence: any;
  let mockStorageService: any;
  let fileService: FileService;
  let currentTransfer: any;
  let recordedDownloads: Array<{ transferId: string; userId: string }> = [];

  const getStringsFrom = (obj: any, visited = new Set()): string[] => {
    if (!obj || visited.has(obj)) return [];
    visited.add(obj);
    const results: string[] = [];
    if (typeof obj === 'string') {
      results.push(obj);
      return results;
    }
    if (typeof obj === 'object') {
      for (const key of Object.getOwnPropertyNames(obj)) {
        try {
          results.push(...getStringsFrom(obj[key], visited));
        } catch (_) {}
      }
      for (const sym of Object.getOwnPropertySymbols(obj)) {
        try {
          results.push(...getStringsFrom((obj as any)[sym], visited));
        } catch (_) {}
      }
    }
    return results;
  };

  beforeEach(() => {
    recordedDownloads = [];
    currentTransfer = {
      id: transferId,
      accountId,
      conversationId,
      uploaderId,
      fileName: 'relatorio-estrategico-squad.pdf',
      fileSize: 5 * 1024 * 1024,
      mimeType: 'application/pdf',
      storageKey: `accounts/${accountId}/transfers/${transferId}/relatorio-estrategico-squad.pdf`,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      totalRecipientsCount: 4, // 5 total group members minus uploader = 4
      pendingDownloadsCount: 4,
      status: 'uploaded',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb = {
      query: {
        accounts: {
          findFirst: vi.fn(async () => ({
            id: accountId,
            name: 'Pro Corp',
            plan: 'pro',
            status: 'active',
          })),
        },
        conversationMembers: {
          findMany: vi.fn(async () => [
            { conversationId, userId: uploaderId },
            { conversationId, userId: member1Id },
            { conversationId, userId: member2Id },
            { conversationId, userId: member3Id },
            { conversationId, userId: member4Id },
          ]),
          findFirst: vi.fn(async (opts: any) => {
            const strings = getStringsFrom(opts);
            if (strings.includes('usr-stranger')) return null;
            return { conversationId, userId: member1Id };
          }),
        },
        fileTransfers: {
          findFirst: vi.fn(async (opts: any) => {
            const strings = getStringsFrom(opts);
            if (strings.includes(transferId)) {
              return currentTransfer;
            }
            return null;
          }),
        },
        fileTransferDownloads: {
          findFirst: vi.fn(async (opts: any) => {
            const strings = getStringsFrom(opts);
            const found = recordedDownloads.find(
              (d) => strings.includes(d.transferId) && strings.includes(d.userId)
            );
            return found || null;
          }),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          if (vals.transferId && vals.userId) {
            recordedDownloads.push(vals);
          } else if (vals.fileName) {
            Object.assign(currentTransfer, vals);
          }
          return Promise.resolve();
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((setValues: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => {
              Object.assign(currentTransfer, setValues);
              return [currentTransfer];
            }),
          })),
        })),
      })),
    };

    mockPresence = {
      isUserOnline: vi.fn(async () => true),
    };

    mockStorageService = {
      generatePresignedUploadUrl: vi.fn(async ({ storageKey }: any) => ({
        uploadUrl: `https://r2.storage.corpchat.com/${storageKey}?put=1`,
        storageKey,
        expiresAt: new Date(Date.now() + 900 * 1000),
        headers: { 'x-amz-server-side-encryption': 'AES256' },
      })),
      generatePresignedDownloadUrl: vi.fn(
        async (key: string) => `https://r2.storage.corpchat.com/${key}?get=1`
      ),
      deleteObject: vi.fn(async () => {}),
    };

    fileService = new FileService(mockDb, mockPresence as any, mockStorageService as any);
  });

  describe('Group Upload Initialization', () => {
    it('initializes pendingDownloadsCount to 4 for a group of 5 members', async () => {
      const result = await fileService.requestPresignedUpload(accountId, uploaderId, {
        fileName: 'ata-reuniao.pdf',
        fileSize: 1024 * 1024,
        conversationId,
      });

      expect(result.transferId).toBeDefined();
      expect(currentTransfer.totalRecipientsCount).toBe(4);
      expect(currentTransfer.pendingDownloadsCount).toBe(4);
      expect(currentTransfer.status).toBe('pending');
    });
  });

  describe('Sequential Multi-Recipient Group Downloads (Aceite: Arquivo some só após o último destinatário)', () => {
    it('Recipient 1 downloads: pending decrements to 3 and object remains in bucket', async () => {
      const res1 = await fileService.confirmDownload(accountId, member1Id, transferId, {
        completed: true,
      });

      expect(res1.success).toBe(true);
      expect(res1.pendingDownloadsCount).toBe(3);
      expect(res1.deletedFromStorage).toBe(false);
      expect(currentTransfer.pendingDownloadsCount).toBe(3);

      // Object MUST NOT be deleted yet
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });

    it('Recipient 1 attempts duplicate download: deduplication prevents double-decrement', async () => {
      // First download
      await fileService.confirmDownload(accountId, member1Id, transferId, { completed: true });
      expect(currentTransfer.pendingDownloadsCount).toBe(3);

      // Duplicate download by same user
      const duplicateRes = await fileService.confirmDownload(accountId, member1Id, transferId, {
        completed: true,
      });

      expect(duplicateRes.success).toBe(true);
      expect(duplicateRes.alreadyDownloaded).toBe(true);
      expect(duplicateRes.pendingDownloadsCount).toBe(3); // Still 3!
      expect(currentTransfer.pendingDownloadsCount).toBe(3);
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });

    it('Recipient 2 downloads with completed: false (interrupted): pending count stays at 3', async () => {
      // Recipient 1 finished
      await fileService.confirmDownload(accountId, member1Id, transferId, { completed: true });

      // Recipient 2 interrupted
      const interruptedRes = await fileService.confirmDownload(accountId, member2Id, transferId, {
        completed: false,
      });

      expect(interruptedRes.success).toBe(true);
      expect(interruptedRes.interrupted).toBe(true);
      expect(interruptedRes.pendingDownloadsCount).toBe(3);
      expect(currentTransfer.pendingDownloadsCount).toBe(3);
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });

    it('Full Group Lifecycle: File disappears ONLY after the 4th (last) recipient downloads', async () => {
      // 1. Recipient 1 downloads -> 3 pending
      const res1 = await fileService.confirmDownload(accountId, member1Id, transferId, { completed: true });
      expect(res1.pendingDownloadsCount).toBe(3);
      expect(res1.deletedFromStorage).toBe(false);
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();

      // 2. Recipient 2 downloads -> 2 pending
      const res2 = await fileService.confirmDownload(accountId, member2Id, transferId, { completed: true });
      expect(res2.pendingDownloadsCount).toBe(2);
      expect(res2.deletedFromStorage).toBe(false);
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();

      // 3. Recipient 3 downloads -> 1 pending
      const res3 = await fileService.confirmDownload(accountId, member3Id, transferId, { completed: true });
      expect(res3.pendingDownloadsCount).toBe(1);
      expect(res3.deletedFromStorage).toBe(false);
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();

      // 4. Recipient 4 (LAST RECIPIENT) downloads -> 0 pending & DELETED
      const res4 = await fileService.confirmDownload(accountId, member4Id, transferId, { completed: true });
      expect(res4.pendingDownloadsCount).toBe(0);
      expect(res4.deletedFromStorage).toBe(true);
      expect(res4.status).toBe('completed');
      expect(currentTransfer.status).toBe('completed');

      // Storage deleteObject MUST BE CALLED NOW
      expect(mockStorageService.deleteObject).toHaveBeenCalledTimes(1);
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        `accounts/${accountId}/transfers/${transferId}/relatorio-estrategico-squad.pdf`
      );
    });
  });

  describe('getTransferStatus & API endpoint (T-21)', () => {
    it('returns progressive download count and availability in group', async () => {
      // Initial status before any download
      const initialStatus = await fileService.getTransferStatus(accountId, member1Id, transferId);
      expect(initialStatus.totalRecipientsCount).toBe(4);
      expect(initialStatus.pendingDownloadsCount).toBe(4);
      expect(initialStatus.downloadedCount).toBe(0);
      expect(initialStatus.isAvailable).toBe(true);

      // After 2 members download
      await fileService.confirmDownload(accountId, member1Id, transferId, { completed: true });
      await fileService.confirmDownload(accountId, member2Id, transferId, { completed: true });

      const midStatus = await fileService.getTransferStatus(accountId, member3Id, transferId);
      expect(midStatus.pendingDownloadsCount).toBe(2);
      expect(midStatus.downloadedCount).toBe(2);
      expect(midStatus.isAvailable).toBe(true);
    });

    it('GET /api/files/:transferId/status returns HTTP 200 with live group progress', async () => {
      const app = buildServer({ fileService });
      await app.ready();

      const token = app.jwt.sign({
        userId: member1Id,
        accountId,
        role: 'member',
        email: 'member1@corp.com',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/files/${transferId}/status`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.transferId).toBe(transferId);
      expect(json.totalRecipientsCount).toBe(4);
      expect(json.pendingDownloadsCount).toBe(4);
      expect(json.isAvailable).toBe(true);
    });
  });
});
