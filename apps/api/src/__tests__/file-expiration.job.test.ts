import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileExpirationService } from '../jobs/file-expiration.job';
import { buildServer } from '../server';

describe('File Expiration Job & 5-Day Lifecycle (T-22)', () => {
  const accountId = 'acc-pro-222';
  const uploaderId = 'usr-uploader-111';
  const conversationId = 'c0000000-0000-0000-0000-000000000001';

  const expiredTransferId1 = 'e0000000-0000-0000-0000-000000000001';
  const expiredTransferId2 = 'e0000000-0000-0000-0000-000000000002';
  const activeTransferId = 'e0000000-0000-0000-0000-000000000003';
  const completedTransferId = 'e0000000-0000-0000-0000-000000000004';

  let mockDb: any;
  let mockStorageService: any;
  let fileExpirationService: FileExpirationService;
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
    const now = Date.now();
    const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000);
    const fiveDaysAndHourAgo = new Date(now - (5 * 24 * 60 * 60 * 1000 + 3600 * 1000));
    const twoDaysFromNow = new Date(now + 2 * 24 * 60 * 60 * 1000);

    transfersMap = {
      [expiredTransferId1]: {
        id: expiredTransferId1,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'arquivo-esquecido-1.pdf',
        fileSize: 2 * 1024 * 1024,
        mimeType: 'application/pdf',
        storageKey: `accounts/${accountId}/transfers/${expiredTransferId1}/arquivo-esquecido-1.pdf`,
        expiresAt: sixDaysAgo,
        pendingDownloadsCount: 2,
        status: 'uploaded',
        createdAt: sixDaysAgo,
        updatedAt: sixDaysAgo,
      },
      [expiredTransferId2]: {
        id: expiredTransferId2,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'planilha-expirada-2.xlsx',
        fileSize: 1024 * 1024,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        storageKey: `accounts/${accountId}/transfers/${expiredTransferId2}/planilha-expirada-2.xlsx`,
        expiresAt: fiveDaysAndHourAgo,
        pendingDownloadsCount: 1,
        status: 'pending',
        createdAt: fiveDaysAndHourAgo,
        updatedAt: fiveDaysAndHourAgo,
      },
      [activeTransferId]: {
        id: activeTransferId,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'documento-recente.pdf',
        fileSize: 3 * 1024 * 1024,
        mimeType: 'application/pdf',
        storageKey: `accounts/${accountId}/transfers/${activeTransferId}/documento-recente.pdf`,
        expiresAt: twoDaysFromNow,
        pendingDownloadsCount: 3,
        status: 'uploaded',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [completedTransferId]: {
        id: completedTransferId,
        accountId,
        conversationId,
        uploaderId,
        fileName: 'ja-baixado.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: `accounts/${accountId}/transfers/${completedTransferId}/ja-baixado.pdf`,
        expiresAt: sixDaysAgo,
        pendingDownloadsCount: 0,
        status: 'completed',
        createdAt: sixDaysAgo,
        updatedAt: sixDaysAgo,
      },
    };

    mockDb = {
      query: {
        fileTransfers: {
          findMany: vi.fn(async (_opts: any) => {
            const nowTime = Date.now();
            return Object.values(transfersMap).filter(
              (t) =>
                new Date(t.expiresAt).getTime() <= nowTime &&
                ['pending', 'uploaded'].includes(t.status)
            );
          }),
          findFirst: vi.fn(async (opts: any) => {
            const strings = getStringsFrom(opts);
            for (const [id, transfer] of Object.entries(transfersMap)) {
              if (strings.includes(id)) {
                return transfer;
              }
            }
            return null;
          }),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn((setValues: any) => ({
          where: vi.fn((whereClause: any) => {
            const strings = getStringsFrom(whereClause);
            let updatedTransfer: any = null;
            for (const [id, transfer] of Object.entries(transfersMap)) {
              if (strings.includes(id)) {
                Object.assign(transfer, setValues);
                updatedTransfer = { ...transfer };
                break;
              }
            }
            return {
              returning: () => [updatedTransfer || { id: 'mock-id', ...setValues }],
            };
          }),
        })),
      })),
    };

    mockStorageService = {
      deleteObject: vi.fn(async () => {}),
    };

    fileExpirationService = new FileExpirationService(
      mockDb,
      mockStorageService as any,
      false // test mode
    );
  });

  describe('Sweep Expired Transfers (T-22)', () => {
    it('deletes storage objects and expires files that passed their 5-day retention deadline', async () => {
      const result = await fileExpirationService.sweepExpiredTransfers();

      expect(result.processedCount).toBe(2);
      expect(result.expiredTransferIds).toContain(expiredTransferId1);
      expect(result.expiredTransferIds).toContain(expiredTransferId2);
      expect(result.expiredTransferIds).not.toContain(activeTransferId);
      expect(result.expiredTransferIds).not.toContain(completedTransferId);

      // Verify S3/R2 deleteObject was invoked for both expired files
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        `accounts/${accountId}/transfers/${expiredTransferId1}/arquivo-esquecido-1.pdf`
      );
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        `accounts/${accountId}/transfers/${expiredTransferId2}/planilha-expirada-2.xlsx`
      );

      // Active and completed transfers must NOT be touched
      expect(transfersMap[activeTransferId].status).toBe('uploaded');
      expect(transfersMap[completedTransferId].status).toBe('completed');

      // Expired transfers updated in DB
      expect(transfersMap[expiredTransferId1].status).toBe('expired');
      expect(transfersMap[expiredTransferId1].pendingDownloadsCount).toBe(0);
      expect(transfersMap[expiredTransferId2].status).toBe('expired');
      expect(transfersMap[expiredTransferId2].pendingDownloadsCount).toBe(0);
    });
  });

  describe('Single Transfer Expiration with Reduced Expiry Timer (Aceite: testar com prazo reduzido)', () => {
    it('expires single transfer immediately and removes from bucket', async () => {
      const result = await fileExpirationService.expireSingleTransfer(expiredTransferId1);

      expect(result.success).toBe(true);
      expect(result.deletedFromStorage).toBe(true);
      expect(transfersMap[expiredTransferId1].status).toBe('expired');
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        `accounts/${accountId}/transfers/${expiredTransferId1}/arquivo-esquecido-1.pdf`
      );
    });

    it('is idempotent and does not re-delete already completed/deleted transfers', async () => {
      const result = await fileExpirationService.expireSingleTransfer(completedTransferId);

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });
  });

  describe('S3 / Cloudflare R2 Lifecycle Policy Configuration', () => {
    it('generates 5-day backup bucket retention lifecycle rule', () => {
      const policy = fileExpirationService.getBucketLifecyclePolicyConfig();

      expect(policy.Rules).toBeDefined();
      expect(policy.Rules[0].ID).toBe('NextMsg-5-Day-File-Retention-Backup');
      expect(policy.Rules[0].Status).toBe('Enabled');
      expect(policy.Rules[0].Expiration.Days).toBe(5);
      expect(policy.Rules[0].Filter.Prefix).toBe('accounts/');
    });
  });

  describe('HTTP Route Integration: POST /api/files/sweep-expired', () => {
    it('executes sweep and returns 200 with summary', async () => {
      const app = buildServer({ fileExpirationService });
      await app.ready();

      const token = app.jwt.sign({
        userId: uploaderId,
        accountId,
        role: 'admin',
        email: 'admin@corp.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/files/sweep-expired',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.processedCount).toBe(2);
      expect(json.expiredTransferIds).toHaveLength(2);
    });
  });
});
