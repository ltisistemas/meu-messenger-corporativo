import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileService } from '../services/file.service';
import { buildServer } from '../server';

describe('File Download with Confirmation and Deletion (T-20)', () => {
  const accountId = 'acc-pro-222';
  const otherAccountId = 'acc-other-999';
  const uploaderId = 'usr-uploader-111';
  const recipientId = 'usr-recipient-222';
  const outsiderId = 'usr-outsider-333';
  const conversationId = 'c0000000-0000-0000-0000-000000000001';

  const transferValidId = 'd0000000-0000-0000-0000-000000000001';
  const transferGroupId = 'd0000000-0000-0000-0000-000000000002';
  const transferDeletedId = 'd0000000-0000-0000-0000-000000000003';
  const transferExpiredId = 'd0000000-0000-0000-0000-000000000004';
  const transferUnknownId = 'd0000000-0000-0000-0000-000000000999';

  let mockDb: any;
  let mockPresence: any;
  let mockStorageService: any;
  let fileService: FileService;
  let transfersMap: Record<string, any> = {};

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
    transfersMap = {
      [transferValidId]: {
        id: transferValidId,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'proposta-comercial.pdf',
        fileSize: 2 * 1024 * 1024,
        mimeType: 'application/pdf',
        storageKey: `accounts/${accountId}/transfers/${transferValidId}/proposta-comercial.pdf`,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        pendingDownloadsCount: 1,
        status: 'uploaded',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [transferGroupId]: {
        id: transferGroupId,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'planilha-squad.xlsx',
        fileSize: 4 * 1024 * 1024,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        storageKey: `accounts/${accountId}/transfers/${transferGroupId}/planilha-squad.xlsx`,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        pendingDownloadsCount: 3,
        status: 'uploaded',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [transferDeletedId]: {
        id: transferDeletedId,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'documento-antigo.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: `accounts/${accountId}/transfers/${transferDeletedId}/documento-antigo.pdf`,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        pendingDownloadsCount: 0,
        status: 'deleted',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [transferExpiredId]: {
        id: transferExpiredId,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'foto-expirada.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `accounts/${accountId}/transfers/${transferExpiredId}/foto-expirada.png`,
        expiresAt: new Date(Date.now() - 1000), // in the past
        pendingDownloadsCount: 1,
        status: 'expired',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    mockDb = {
      query: {
        accounts: {
          findFirst: vi.fn(async () => ({
            id: accountId,
            name: 'Corp Pro',
            plan: 'pro',
            status: 'active',
          })),
        },
        conversationMembers: {
          findFirst: vi.fn(async (opts: any) => {
            const strings = getStringsFrom(opts);
            if (strings.includes(outsiderId)) {
              return null; // outsider is not a member
            }
            return { conversationId, userId: recipientId };
          }),
        },
        fileTransfers: {
          findFirst: vi.fn(async (opts: any) => {
            const strings = getStringsFrom(opts);
            for (const [id, transfer] of Object.entries(transfersMap)) {
              if (strings.includes(id)) {
                if (strings.includes(otherAccountId) && transfer.accountId !== otherAccountId) {
                  return null;
                }
                return transfer;
              }
            }
            return null;
          }),
        },
        fileTransferDownloads: {
          findFirst: vi.fn(async () => null),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => Promise.resolve()),
      })),
      update: vi.fn(() => ({
        set: vi.fn((setValues: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => {
              // Update in-memory map
              for (const transfer of Object.values(transfersMap)) {
                Object.assign(transfer, setValues);
                return [transfer];
              }
              return [{ id: 'mock-id', ...setValues }];
            }),
          })),
        })),
      })),
    };

    mockPresence = {
      isUserOnline: vi.fn(async () => true),
    };

    mockStorageService = {
      generatePresignedDownloadUrl: vi.fn(
        async (key: string) => `https://r2.storage.corpchat.com/${key}?token=download-signature-123`
      ),
      deleteObject: vi.fn(async () => {}),
    };

    fileService = new FileService(mockDb, mockPresence as any, mockStorageService as any);
  });

  describe('FileService.requestDownloadUrl', () => {
    it('generates short-lived download URL with metadata for authorized conversation member', async () => {
      const result = await fileService.requestDownloadUrl(accountId, recipientId, transferValidId);

      expect(result.transferId).toBe(transferValidId);
      expect(result.fileName).toBe('proposta-comercial.pdf');
      expect(result.fileSize).toBe(2 * 1024 * 1024);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.downloadUrl).toContain('proposta-comercial.pdf');
      expect(result.downloadUrl).toContain('download-signature-123');
      expect(mockStorageService.generatePresignedDownloadUrl).toHaveBeenCalledWith(
        `accounts/${accountId}/transfers/${transferValidId}/proposta-comercial.pdf`,
        900
      );
    });

    it('rejects if file transfer does not exist or belongs to another organization', async () => {
      await expect(
        fileService.requestDownloadUrl(otherAccountId, recipientId, transferValidId)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'FILE_NOT_FOUND',
      });
    });

    it('rejects with 410 if file has already been deleted or downloaded by all recipients', async () => {
      await expect(
        fileService.requestDownloadUrl(accountId, recipientId, transferDeletedId)
      ).rejects.toMatchObject({
        statusCode: 410,
        code: 'FILE_ALREADY_DELETED',
      });
    });

    it('rejects with 410 if file has expired after 5 days', async () => {
      await expect(
        fileService.requestDownloadUrl(accountId, recipientId, transferExpiredId)
      ).rejects.toMatchObject({
        statusCode: 410,
        code: 'FILE_EXPIRED',
      });
    });

    it('rejects with 403 if requester is not a member of the conversation', async () => {
      await expect(
        fileService.requestDownloadUrl(accountId, outsiderId, transferValidId)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN_FILE_ACCESS',
      });
    });
  });

  describe('FileService.confirmDownload (Acceptance: Interrupted does NOT delete; Complete deletes)', () => {
    it('does NOT delete file from bucket when download is interrupted (completed: false)', async () => {
      const result = await fileService.confirmDownload(accountId, recipientId, transferValidId, {
        completed: false,
      });

      expect(result.success).toBe(true);
      expect(result.interrupted).toBe(true);
      expect(result.deletedFromStorage).toBe(false);
      expect(result.pendingDownloadsCount).toBe(1);

      // Verify deleteObject was NOT called
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });

    it('deletes file from bucket and marks completed when last recipient finishes download (completed: true)', async () => {
      const result = await fileService.confirmDownload(accountId, recipientId, transferValidId, {
        completed: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedFromStorage).toBe(true);
      expect(result.pendingDownloadsCount).toBe(0);

      // Verify deleteObject was called on the bucket storage key
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        `accounts/${accountId}/transfers/${transferValidId}/proposta-comercial.pdf`
      );
    });

    it('decrements pending count without deleting from bucket when other recipients are still pending (T-21 foundation)', async () => {
      const result = await fileService.confirmDownload(accountId, recipientId, transferGroupId, {
        completed: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedFromStorage).toBe(false);
      expect(result.pendingDownloadsCount).toBe(2); // 3 -> 2

      // Verify deleteObject was NOT called yet
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });

    it('throws 404 when confirming download for non-existent transfer', async () => {
      await expect(
        fileService.confirmDownload(accountId, recipientId, transferUnknownId, {
          completed: true,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'FILE_TRANSFER_NOT_FOUND',
      });
    });
  });

  describe('HTTP Route Integration for Downloads (T-20)', () => {
    let app: any;
    let recipientToken: string;

    beforeEach(async () => {
      app = buildServer({ fileService });
      await app.ready();

      recipientToken = app.jwt.sign({
        userId: recipientId,
        accountId,
        role: 'member',
      });
    });

    it('POST /api/files/download-url returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/download-url',
        payload: {
          transferId: transferValidId,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('POST /api/files/download-url returns 200 with presigned download URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/download-url',
        headers: {
          Authorization: `Bearer ${recipientToken}`,
        },
        payload: {
          transferId: transferValidId,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.downloadUrl).toBeDefined();
      expect(json.fileName).toBe('proposta-comercial.pdf');
    });

    it('POST /api/files/confirm-download handles interrupted download without deletion', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/confirm-download',
        headers: {
          Authorization: `Bearer ${recipientToken}`,
        },
        payload: {
          transferId: transferValidId,
          completed: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.deletedFromStorage).toBe(false);
      expect(json.interrupted).toBe(true);
    });

    it('POST /api/files/confirm-download handles complete download with bucket deletion', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/confirm-download',
        headers: {
          Authorization: `Bearer ${recipientToken}`,
        },
        payload: {
          transferId: transferValidId,
          completed: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.deletedFromStorage).toBe(true);
      expect(json.pendingDownloadsCount).toBe(0);
    });
  });
});
