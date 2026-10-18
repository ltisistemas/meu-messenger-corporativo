import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsaasGatewayService } from '../services/asaas.service';
import { StorageService } from '../services/storage.service';
import { getRedisConnectionOptions, createRedisClient } from '../jobs/connection';
import { pool } from '../db/index';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: async () => 'https://s3.amazonaws.com/mock-signed-url-test',
}));

describe('AsaasGatewayService Adapter Deep Coverage', () => {
  const originalEnv = process.env.NODE_ENV;
  let service: AsaasGatewayService;

  beforeEach(() => {
    // Set NODE_ENV to production to avoid mock bypass and test real HTTP logic
    process.env.NODE_ENV = 'production';
    service = new AsaasGatewayService('live_secret_key_123', 'https://api.asaas.com/v3');
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('createOrGetCustomer handles success, API error and network rejection', async () => {
    // 1. Success
    const mockCustomer = { id: 'cus_1', name: 'Corp', email: 'c@corp.com', cpfCnpj: '123' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockCustomer,
    } as any);

    const result = await service.createOrGetCustomer({
      name: 'Corp',
      email: 'c@corp.com',
      cpfCnpj: '123',
    });
    expect(result.id).toBe('cus_1');

    // 2. API 400 Error
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: [{ description: 'CPF inválido.' }] }),
    } as any);

    await expect(
      service.createOrGetCustomer({ name: 'Corp', email: 'c@corp.com', cpfCnpj: 'invalid' })
    ).rejects.toThrow('Falha no Asaas: CPF inválido.');

    // 3. Network rejection
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection reset'));
    await expect(
      service.createOrGetCustomer({ name: 'Corp', email: 'c@corp.com', cpfCnpj: '123' })
    ).rejects.toThrow('Falha no Asaas: Connection reset');
  });

  it('createSubscription handles PIX, Credit Card, Boleto and error paths', async () => {
    const mockSub = {
      id: 'sub_123',
      customer: 'cus_1',
      billingType: 'PIX',
      value: 79.9,
      nextDueDate: '2026-11-01',
      cycle: 'MONTHLY',
      status: 'PENDING',
    };
    const mockPayment = {
      id: 'pay_123',
      customer: 'cus_1',
      value: 79.9,
      billingType: 'PIX',
      status: 'PENDING',
      dueDate: '2026-11-01',
    };
    const mockQr = {
      encodedImage: 'imgbase64',
      payload: 'pixcopypaste',
      expirationDate: '2026-11-02',
    };

    // 1. PIX Subscription with payments and QR code
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSub,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockPayment] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQr,
      } as any);

    const subResult = await service.createSubscription({
      customerId: 'cus_1',
      billingType: 'PIX',
      value: 79.9,
      nextDueDate: '2026-11-01',
      cycle: 'MONTHLY',
      description: 'Plano Pro',
    });
    expect(subResult.subscription.id).toBe('sub_123');
    expect(subResult.initialPayment?.id).toBe('pay_123');
    expect(subResult.pixQrCode?.payload).toBe('pixcopypaste');

    // 2. Subscription API 400 error
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: [{ description: 'Cartão recusado' }] }),
    } as any);

    await expect(
      service.createSubscription({
        customerId: 'cus_1',
        billingType: 'CREDIT_CARD',
        value: 79.9,
        nextDueDate: '2026-11-01',
        cycle: 'MONTHLY',
        description: 'Plano Pro',
      })
    ).rejects.toThrow('Falha ao criar assinatura no Asaas: Cartão recusado');

    // 3. Subscription Network rejection
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));
    await expect(
      service.createSubscription({
        customerId: 'cus_1',
        billingType: 'BOLETO',
        value: 79.9,
        nextDueDate: '2026-11-01',
        cycle: 'MONTHLY',
        description: 'Plano Pro',
      })
    ).rejects.toThrow('Falha ao criar assinatura no Asaas: Network failure');
  });

  it('cancelSubscription and getPixQrCode handle success and errors', async () => {
    // 1. cancelSubscription success
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true }),
    } as any);
    expect(await service.cancelSubscription('sub_123')).toBe(true);

    // 2. cancelSubscription API error
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: [{ description: 'Assinatura inexistente' }] }),
    } as any);
    await expect(service.cancelSubscription('sub_unknown')).rejects.toThrow(
      'Falha ao cancelar assinatura no Asaas: Assinatura inexistente'
    );

    // 3. cancelSubscription network error
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Timeout'));
    await expect(service.cancelSubscription('sub_err')).rejects.toThrow(
      'Falha ao cancelar assinatura no Asaas: Timeout'
    );

    // 4. getPixQrCode error
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as any);
    await expect(service.getPixQrCode('pay_invalid')).rejects.toThrow(
      'Erro ao obter QR code Pix no Asaas.'
    );
  });
});

describe('StorageService Adapter Deep Coverage', () => {
  it('generates mock URLs when S3 credentials are not configured', async () => {
    const unconfigured = new StorageService({});
    const uploadRes = await unconfigured.generatePresignedUploadUrl({
      storageKey: 'tenant/file.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
    });
    expect(uploadRes.uploadUrl).toContain('/api/files/storage-mock/');
    expect(uploadRes.storageKey).toBe('tenant/file.pdf');

    const downloadRes = await unconfigured.generatePresignedDownloadUrl('tenant/file.pdf');
    expect(downloadRes).toContain('download=true');

    // deleteObject and objectExists do nothing/return true
    await unconfigured.deleteObject('tenant/file.pdf');
    expect(await unconfigured.objectExists('tenant/file.pdf')).toBe(true);
  });

  it('interacts with custom S3 client correctly', async () => {
    const mockSend = vi.fn();
    const mockS3Client: any = {
      send: mockSend,
    };

    const storage = new StorageService({ bucket: 'my-bucket' }, mockS3Client);

    // deleteObject sends DeleteObjectCommand
    mockSend.mockResolvedValueOnce({});
    await storage.deleteObject('some/key.png');
    expect(mockSend).toHaveBeenCalledTimes(1);

    // objectExists succeeds
    mockSend.mockResolvedValueOnce({});
    expect(await storage.objectExists('some/key.png')).toBe(true);

    // objectExists returns false on NotFound error
    mockSend.mockRejectedValueOnce({ name: 'NotFound' });
    expect(await storage.objectExists('notfound.png')).toBe(false);

    // objectExists returns false on 404 httpStatusCode
    mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
    expect(await storage.objectExists('notfound404.png')).toBe(false);

    // objectExists throws unexpected errors (500)
    mockSend.mockRejectedValueOnce(new Error('AWS S3 Internal Error'));
    await expect(storage.objectExists('err.png')).rejects.toThrow('AWS S3 Internal Error');
  });

  it('instantiates S3Client when accessKeyId and secretAccessKey are provided', () => {
    const s3Service = new StorageService({
      bucket: 'custom-bucket',
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'SECRET_TEST',
      endpoint: 'https://s3.custom.endpoint',
      region: 'us-east-1',
    });
    expect(s3Service).toBeDefined();
  });

  it('generates presigned upload and download URLs using S3Client and presigner', async () => {
    const mockS3Client: any = { send: vi.fn() };
    const storage = new StorageService({ bucket: 'custom-s3-bucket' }, mockS3Client);

    const uploadRes = await storage.generatePresignedUploadUrl({
      storageKey: 'tenant/doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      expiresInSeconds: 600,
    });
    expect(uploadRes.uploadUrl).toBe('https://s3.amazonaws.com/mock-signed-url-test');
    expect(uploadRes.storageKey).toBe('tenant/doc.pdf');
    expect(uploadRes.headers['Content-Type']).toBe('application/pdf');

    const downloadRes = await storage.generatePresignedDownloadUrl('tenant/doc.pdf', 300);
    expect(downloadRes).toBe('https://s3.amazonaws.com/mock-signed-url-test');
  });
});

describe('Jobs & DB Connection Deep Coverage', () => {
  it('getRedisConnectionOptions parses REDIS_URL with credentials', () => {
    const origRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://:mypassword@cache.internal:6380';

    const opts: any = getRedisConnectionOptions();
    expect(opts.host).toBe('cache.internal');
    expect(opts.port).toBe(6380);
    expect(opts.password).toBe('mypassword');
    expect(opts.maxRetriesPerRequest).toBeNull();

    process.env.REDIS_URL = origRedisUrl;
  });

  it('createRedisClient instantiates ioredis client', () => {
    const client = createRedisClient();
    expect(client).toBeDefined();
    client.disconnect();
  });

  it('handles database pool error event gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pool.emit('error', new Error('Simulated PG connection pool drop'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[PG Pool Error]'));
    warnSpy.mockRestore();
  });
});
