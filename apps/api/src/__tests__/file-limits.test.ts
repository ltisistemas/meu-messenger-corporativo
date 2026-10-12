import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileService } from '../services/file.service';
import { buildServer } from '../server';
import { BYTES_IN_MB, BYTES_IN_KB, CLOUD_SHARE_SUGGESTION_MESSAGE } from '@corpchat/shared';

describe('File Limits Validation Service & Route (T-15)', () => {
  const MB = BYTES_IN_MB;
  const freeAccountId = 'acc-free-111';
  const proAccountId = 'acc-pro-222';
  const entAccountId = 'acc-ent-333';
  const overQuotaAccountId = 'acc-oq-444';
  const suspendedAccountId = 'acc-susp-555';

  const recipientUserId = 'usr-target-999';

  let mockDb: any;
  let mockPresence: any;
  let fileService: FileService;

  beforeEach(() => {
    mockPresence = {
      isUserOnline: vi.fn(async (uid: string) => uid === recipientUserId),
    };

    const accountsMap: Record<string, any> = {
      [freeAccountId]: { id: freeAccountId, name: 'Free Account', plan: 'free', status: 'active' },
      [proAccountId]: { id: proAccountId, name: 'Pro Account', plan: 'pro', status: 'active' },
      [entAccountId]: { id: entAccountId, name: 'Ent Account', plan: 'enterprise', status: 'active' },
      [overQuotaAccountId]: { id: overQuotaAccountId, name: 'Over Quota Acc', plan: 'free', status: 'over_quota' },
      [suspendedAccountId]: { id: suspendedAccountId, name: 'Suspended Acc', plan: 'pro', status: 'suspended' },
    };

    mockDb = {
      query: {
        accounts: {
          findFirst: vi.fn(async ({ where }: any) => {
            // Find account from where condition
            for (const acc of Object.values(accountsMap)) {
              return accountsMap[acc.id] || null;
            }
            return null;
          }),
        },
        users: {
          findFirst: vi.fn(async () => ({
            id: recipientUserId,
            name: 'Destinatário Teste',
          })),
        },
      },
    };

    // Override accounts.findFirst to correctly return matching account by id
    mockDb.query.accounts.findFirst = vi.fn(async (query: any) => {
      // In drizzle mock, query is called with `{ where: eq(accounts.id, accountId) }`
      // We can inspect args or match against our map
      for (const [id, acc] of Object.entries(accountsMap)) {
        if (query && JSON.stringify(query).includes(id)) {
          return acc;
        }
      }
      return accountsMap[freeAccountId];
    });

    fileService = new FileService(mockDb, mockPresence as any);
  });

  describe('FileService Unit Tests', () => {
    it('validates Free plan single file within 5 MB limit for online recipient', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: freeAccountId,
        plan: 'free',
        status: 'active',
      });

      const result = await fileService.validateFiles(freeAccountId, {
        files: [{ name: 'contrato.pdf', size: 4.5 * MB, mimeType: 'application/pdf' }],
        recipientUserId,
      });

      expect(result.valid).toBe(true);
      expect(result.plan).toBe('free');
    });

    it('rejects file larger than 5 MB on Free plan', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: freeAccountId,
        plan: 'free',
        status: 'active',
      });

      const result = await fileService.validateFiles(freeAccountId, {
        files: [{ name: 'video.mp4', size: 6 * MB, mimeType: 'video/mp4' }],
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('FILE_TOO_LARGE');
      expect(result.error).toContain('excede o limite de 5 MB do plano Free');
    });

    it('rejects more than 1 file on Free plan', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: freeAccountId,
        plan: 'free',
        status: 'active',
      });

      const result = await fileService.validateFiles(freeAccountId, {
        files: [
          { name: '1.pdf', size: 100 * BYTES_IN_KB },
          { name: '2.pdf', size: 100 * BYTES_IN_KB },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOO_MANY_FILES');
    });

    it('suggests cloud share when file > 25 MB', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: proAccountId,
        plan: 'pro',
        status: 'active',
      });

      const result = await fileService.validateFiles(proAccountId, {
        files: [{ name: 'banco.dump', size: 26 * MB }],
      });

      expect(result.valid).toBe(false);
      expect(result.suggestCloudShare).toBe(true);
      expect(result.error).toContain(CLOUD_SHARE_SUGGESTION_MESSAGE);
    });

    it('rejects offline recipient on Free plan', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: freeAccountId,
        plan: 'free',
        status: 'active',
      });
      mockPresence.isUserOnline.mockResolvedValueOnce(false);

      const result = await fileService.validateFiles(freeAccountId, {
        files: [{ name: 'doc.pdf', size: 1 * MB }],
        recipientUserId: 'usr-offline',
        recipientName: 'Carlos Offline',
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('OFFLINE_RECIPIENT_NOT_ALLOWED');
      expect(result.error).toContain('Carlos Offline está offline. No plano Free, arquivos só são enviados para quem está online.');
    });

    it('allows offline recipient on Pro plan (store-and-forward)', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: proAccountId,
        plan: 'pro',
        status: 'active',
      });
      mockPresence.isUserOnline.mockResolvedValueOnce(false);

      const result = await fileService.validateFiles(proAccountId, {
        files: [{ name: 'doc.pdf', size: 10 * MB }],
        recipientUserId: 'usr-offline',
      });

      expect(result.valid).toBe(true);
    });

    it('allows up to 5 files totaling 125 MB on Pro plan', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: proAccountId,
        plan: 'pro',
        status: 'active',
      });

      const result = await fileService.validateFiles(proAccountId, {
        files: Array.from({ length: 5 }, (_, i) => ({
          name: `anexo_${i + 1}.pdf`,
          size: 25 * MB,
        })),
      });

      expect(result.valid).toBe(true);
    });

    it('rejects batch exceeding 100 MB total ceiling on Enterprise plan', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: entAccountId,
        plan: 'enterprise',
        status: 'active',
      });

      const result = await fileService.validateFiles(entAccountId, {
        files: Array.from({ length: 5 }, (_, i) => ({
          name: `relatorio_${i + 1}.pdf`,
          size: 25 * MB, // 5 * 25 MB = 125 MB > 100 MB ceiling
        })),
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOTAL_SIZE_EXCEEDED');
      expect(result.error).toContain('excede o teto de 100 MB por envio no plano Enterprise');
    });

    it('allows 20 files of 5 MB (100 MB total) on Enterprise plan', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: entAccountId,
        plan: 'enterprise',
        status: 'active',
      });

      const result = await fileService.validateFiles(entAccountId, {
        files: Array.from({ length: 20 }, (_, i) => ({
          name: `recibo_${i + 1}.pdf`,
          size: 5 * MB,
        })),
      });

      expect(result.valid).toBe(true);
    });

    it('rejects sending files if account is in over_quota status', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: overQuotaAccountId,
        plan: 'free',
        status: 'over_quota',
      });

      const result = await fileService.validateFiles(overQuotaAccountId, {
        files: [{ name: 'teste.pdf', size: 1 * MB }],
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('ACCOUNT_OVER_QUOTA');
    });

    it('rejects sending files if account is suspended', async () => {
      mockDb.query.accounts.findFirst.mockResolvedValueOnce({
        id: suspendedAccountId,
        plan: 'pro',
        status: 'suspended',
      });

      const result = await fileService.validateFiles(suspendedAccountId, {
        files: [{ name: 'teste.pdf', size: 1 * MB }],
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('HTTP Route Integration: POST /api/files/validate', () => {
    it('requires authentication (401 without token)', async () => {
      const server = buildServer();
      const res = await server.inject({
        method: 'POST',
        url: '/api/files/validate',
        payload: {
          files: [{ name: 'doc.pdf', size: 1000 }],
        },
      });

      expect(res.statusCode).toBe(401);
      await server.close();
    });

    it('returns 400 for invalid payload (empty files array)', async () => {
      const server = buildServer();
      await server.ready();

      const token = server.jwt.sign({
        userId: '11111111-1111-1111-1111-111111111111',
        accountId: '22222222-2222-2222-2222-222222222222',
        role: 'member',
        email: 'user@corp.com',
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/files/validate',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          files: [],
        },
      });

      expect(res.statusCode).toBe(400);
      await server.close();
    });
  });
});
