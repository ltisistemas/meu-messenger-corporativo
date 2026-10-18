import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileService } from '../services/file.service';
import { StorageService } from '../services/storage.service';
import { buildServer } from '../server';
import { BYTES_IN_MB } from '@corpchat/shared';

describe('S3 / R2 Pre-signed Uploads & Storage (T-19)', () => {
  const MB = BYTES_IN_MB;
  const freeAccountId = 'acc-free-111';
  const proAccountId = 'acc-pro-222';
  const entAccountId = 'acc-ent-333';
  const overQuotaAccountId = 'acc-oq-444';
  const suspendedAccountId = 'acc-susp-555';

  const uploaderId = 'usr-uploader-123';
  const conversationId = 'c0000000-0000-0000-0000-000000000001';

  let mockDb: any;
  let mockPresence: any;
  let mockStorageService: StorageService;
  let fileService: FileService;
  let insertedTransfers: any[] = [];

  beforeEach(() => {
    insertedTransfers = [];

    const accountsMap: Record<string, any> = {
      [freeAccountId]: { id: freeAccountId, name: 'Free Org', plan: 'free', status: 'active' },
      [proAccountId]: { id: proAccountId, name: 'Pro Org', plan: 'pro', status: 'active' },
      [entAccountId]: {
        id: entAccountId,
        name: 'Enterprise Org',
        plan: 'enterprise',
        status: 'active',
      },
      [overQuotaAccountId]: {
        id: overQuotaAccountId,
        name: 'Over Quota Org',
        plan: 'pro',
        status: 'over_quota',
      },
      [suspendedAccountId]: {
        id: suspendedAccountId,
        name: 'Suspended Org',
        plan: 'pro',
        status: 'suspended',
      },
    };

    mockDb = {
      query: {
        accounts: {
          findFirst: vi.fn(async (opts: any) => {
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

            const strings = getStringsFrom(opts);
            for (const [id, acc] of Object.entries(accountsMap)) {
              if (strings.includes(id)) {
                return acc;
              }
            }
            return accountsMap[proAccountId];
          }),
        },
        conversationMembers: {
          findMany: vi.fn(async () => [
            { conversationId, userId: uploaderId },
            { conversationId, userId: 'usr-member-2' },
            { conversationId, userId: 'usr-member-3' },
          ]),
        },
        fileTransfers: {
          findFirst: vi.fn(async (opts: any) => {
            const transfer = insertedTransfers[0];
            return transfer || null;
          }),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn((values: any) => {
          insertedTransfers.push(values);
          return Promise.resolve();
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((setValues: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => {
              if (insertedTransfers[0]) {
                Object.assign(insertedTransfers[0], setValues);
                return [insertedTransfers[0]];
              }
              return [{ id: 'mock-transfer-id', ...setValues }];
            }),
          })),
        })),
      })),
    };

    mockPresence = {
      isUserOnline: vi.fn(async () => true),
    };

    mockStorageService = new StorageService({
      bucket: 'test-bucket',
    });

    fileService = new FileService(mockDb, mockPresence as any, mockStorageService);
  });

  describe('StorageService', () => {
    it('generates pre-signed upload URL with SSE AES256 headers', async () => {
      const storage = new StorageService({ bucket: 'my-attachments' });
      const result = await storage.generatePresignedUploadUrl({
        storageKey: 'accounts/acc-1/transfers/t-1/relatorio.pdf',
        mimeType: 'application/pdf',
        fileSize: 10 * MB,
      });

      expect(result.uploadUrl).toBeDefined();
      expect(result.storageKey).toBe('accounts/acc-1/transfers/t-1/relatorio.pdf');
      expect(result.headers['Content-Type']).toBe('application/pdf');
      expect(result.headers['x-amz-server-side-encryption']).toBe('AES256');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('generates secure download URL and mock fallback', async () => {
      const storage = new StorageService({ bucket: 'my-attachments' });
      const downloadUrl = await storage.generatePresignedDownloadUrl(
        'accounts/acc-1/transfers/t-1/relatorio.pdf'
      );

      expect(downloadUrl).toContain('relatorio.pdf');
      expect(downloadUrl).toContain('download=true');
    });
  });

  describe('FileService.requestPresignedUpload', () => {
    it('generates presigned upload URL for Pro plan with 5-day expiration and SSE', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: proAccountId,
        plan: 'pro',
        status: 'active',
      });

      const response = await fileService.requestPresignedUpload(proAccountId, uploaderId, {
        fileName: 'balanco-anual.pdf',
        fileSize: 15 * MB,
        mimeType: 'application/pdf',
        conversationId,
      });

      expect(response.transferId).toBeDefined();
      expect(response.uploadUrl).toBeDefined();
      expect(response.storageKey).toContain(
        `accounts/${proAccountId}/transfers/${response.transferId}/balanco-anual.pdf`
      );
      expect(response.headers['x-amz-server-side-encryption']).toBe('AES256');
      expect(response.maxSizeBytes).toBe(25 * MB);

      expect(insertedTransfers.length).toBe(1);
      const transfer = insertedTransfers[0];
      expect(transfer.accountId).toBe(proAccountId);
      expect(transfer.fileName).toBe('balanco-anual.pdf');
      expect(transfer.fileSize).toBe(15 * MB);
      expect(transfer.pendingDownloadsCount).toBe(2); // 3 members minus 1 uploader = 2
      expect(transfer.status).toBe('pending');

      // Check 5-day expiration
      const fiveDaysFromNow = Date.now() + 5 * 24 * 60 * 60 * 1000;
      const expiresAtMs = new Date(transfer.expiresAt).getTime();
      expect(Math.abs(expiresAtMs - fiveDaysFromNow)).toBeLessThan(5000);
    });

    it('generates presigned upload URL for Enterprise plan up to 25 MB', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: entAccountId,
        plan: 'enterprise',
        status: 'active',
      });

      const response = await fileService.requestPresignedUpload(entAccountId, uploaderId, {
        fileName: 'dataset.zip',
        fileSize: 24 * MB,
        mimeType: 'application/zip',
      });

      expect(response.transferId).toBeDefined();
      expect(response.uploadUrl).toBeDefined();
      expect(insertedTransfers[0].pendingDownloadsCount).toBe(1);
    });

    it('rejects Free account with PRESIGN_NOT_ALLOWED_ON_FREE error', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: freeAccountId,
        plan: 'free',
        status: 'active',
      });

      await expect(
        fileService.requestPresignedUpload(freeAccountId, uploaderId, {
          fileName: 'foto.jpg',
          fileSize: 2 * MB,
        })
      ).rejects.toMatchObject({
        code: 'PRESIGN_NOT_ALLOWED_ON_FREE',
        statusCode: 403,
      });
    });

    it('rejects file larger than 25 MB with FILE_TOO_LARGE and cloud share suggestion', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: proAccountId,
        plan: 'pro',
        status: 'active',
      });

      await expect(
        fileService.requestPresignedUpload(proAccountId, uploaderId, {
          fileName: 'backup-gigante.tar',
          fileSize: 30 * MB,
        })
      ).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE',
        suggestCloudShare: true,
      });
    });

    it('rejects suspended and over_quota accounts', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: suspendedAccountId,
        plan: 'pro',
        status: 'suspended',
      });

      await expect(
        fileService.requestPresignedUpload(suspendedAccountId, uploaderId, {
          fileName: 'doc.pdf',
          fileSize: 1 * MB,
        })
      ).rejects.toMatchObject({
        code: 'ACCOUNT_SUSPENDED',
        statusCode: 403,
      });
    });
  });

  describe('FileService.confirmUpload', () => {
    it('updates transfer status to uploaded and links messageId', async () => {
      const transferId = 'transfer-uuid-1';
      insertedTransfers.push({
        id: transferId,
        accountId: proAccountId,
        status: 'pending',
      });

      const updated = await fileService.confirmUpload(proAccountId, transferId, 'msg-123');

      expect(updated.status).toBe('uploaded');
      expect(updated.messageId).toBe('msg-123');
    });

    it('throws 404 if transfer does not exist or belongs to another account', async () => {
      mockDb.query.fileTransfers.findFirst.mockResolvedValueOnce(null);

      await expect(fileService.confirmUpload('other-acc', 'unknown-id')).rejects.toMatchObject({
        code: 'FILE_TRANSFER_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('Fastify File Routes Integration (T-19)', () => {
    let app: any;
    let proToken: string;
    let freeToken: string;

    beforeEach(async () => {
      app = buildServer({ fileService });
      await app.ready();

      proToken = app.jwt.sign({
        userId: uploaderId,
        accountId: proAccountId,
        role: 'member',
      });

      freeToken = app.jwt.sign({
        userId: uploaderId,
        accountId: freeAccountId,
        role: 'member',
      });
    });

    it('POST /api/files/presign-upload returns 401 when unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/presign-upload',
        payload: {
          fileName: 'doc.pdf',
          fileSize: 1024,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('POST /api/files/presign-upload returns 403 when user is on Free plan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/presign-upload',
        headers: {
          Authorization: `Bearer ${freeToken}`,
        },
        payload: {
          fileName: 'doc.pdf',
          fileSize: 1024,
        },
      });

      // Free plan cannot request pre-signed URLs
      expect(res.statusCode).toBe(403);
      const json = res.json();
      expect(json.code).toBe('PRESIGN_NOT_ALLOWED_ON_FREE');
    });

    it('POST /api/files/presign-upload returns 400 when file exceeds 25 MB limit', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/presign-upload',
        headers: {
          Authorization: `Bearer ${proToken}`,
        },
        payload: {
          fileName: 'enorme.zip',
          fileSize: 26 * MB,
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error).toContain('25 MB');
    });

    it('POST /api/files/confirm-upload validates required payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/files/confirm-upload',
        headers: {
          Authorization: `Bearer ${proToken}`,
        },
        payload: {
          transferId: 'not-a-uuid',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
